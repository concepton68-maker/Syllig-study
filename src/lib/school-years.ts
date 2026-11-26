import 'server-only';
import { sql } from './db';

// Dossier scolaire : années scolaires successives d'un élève (niveau, bilan).
// Les cours appartiennent à un niveau : cours évalués, acquis, moyenne et évaluations notées portent sur les cours du niveau
// depuis l'inscription (matières suivies seulement) ; le temps et les points, sur la période de l'année.

export type SchoolYear = {
  id: string; level_code: string; level_name: string; cycle: string | null; school_year: string;
  status: 'en_cours' | 'terminee'; started_at: Date; ended_at: Date | null; summary: YearSummary | null; note: string | null;
};
export type SubjectLine = { subject_id: number; subject: string; total: number; published: number; started: number; acquired: number; avg: number | null; followed: boolean };
export type YearSummary = {
  courses_total: number; published: number; started: number; acquired: number; mastered: number;
  avg: number | null; evaluations: number; active_minutes: number; points: number; subjects: SubjectLine[];
  evaluated?: number; avg_courses?: number;   // cours avec au moins une évaluation notée ; nombre de cours dans la moyenne (absents des bilans archivés avant le 26/11/2026)
};
export type Level = { code: string; name: string; cycle: string | null; position: number; courses: number };

export async function levels(): Promise<Level[]> {
  return sql<Level[]>`
    select l.code, l.name, l.cycle, l.position,
      (select count(*)::int from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id where s.level_code = l.code) as courses
    from levels l order by l.position, l.name`;
}

export async function yearsOf(studentId: string): Promise<SchoolYear[]> {
  return sql<SchoolYear[]>`
    select y.id, y.level_code, l.name as level_name, l.cycle, y.school_year, y.status, y.started_at, y.ended_at, y.summary, y.note
    from student_years y join levels l on l.code = y.level_code
    where y.student_id = ${studentId} order by y.started_at desc`;
}

// Matières suivies : liste d'identifiants de matières exclues dans les réglages de l'élève
export async function excludedSubjects(studentId: string): Promise<number[]> {
  const [r] = await sql<{ ex: unknown }[]>`select settings->'excluded_subjects' as ex from students where id = ${studentId}`;
  return Array.isArray(r?.ex) ? (r.ex as unknown[]).map(Number).filter(Number.isInteger) : [];
}

export async function yearSummary(studentId: string, levelCode: string, from: Date, to: Date | null): Promise<YearSummary> {
  const excluded = await excludedSubjects(studentId);
  const until = to ?? new Date('9999-12-31');
  const subjects = await sql<(Omit<SubjectLine, 'followed' | 'avg'> & { avg: string | null; mastered: number })[]>`
    select s.id as subject_id, s.name as subject, count(c.id)::int as total, count(v.id)::int as published,
      count(*) filter (where p.mastery >= 1)::int as started,
      count(*) filter (where p.mastery >= 4)::int as acquired,
      count(*) filter (where p.mastery >= 5)::int as mastered,
      round(avg(p.best_eval_score), 2) as avg
    from subjects s join chapters ch on ch.subject_id = s.id join courses c on c.chapter_id = ch.id
    left join course_versions v on v.course_id = c.id and v.status = 'published'
    left join course_progress p on p.course_id = c.id and p.student_id = ${studentId}
    where s.level_code = ${levelCode} group by s.id, s.name, s.position order by s.position`;
  const lines: SubjectLine[] = subjects.map(s => ({ subject_id: s.subject_id, subject: s.subject, total: s.total, published: s.published,
    started: s.started, acquired: s.acquired, avg: s.avg === null ? null : Number(s.avg), followed: !excluded.includes(s.subject_id) }));
  const followed = subjects.filter(s => !excluded.includes(s.subject_id));
  const [t] = await sql<{ minutes: number; points: number; evals: number; avg: string | null; evaluated: number; avg_courses: number }[]>`
    select
      (select coalesce(sum(active_seconds), 0)::int / 60 from work_sessions w where w.student_id = ${studentId} and w.started_at >= ${from} and w.started_at < ${until}) as minutes,
      (select coalesce(sum(amount), 0)::int from points_ledger pl where pl.student_id = ${studentId} and pl.at >= ${from} and pl.at < ${until}) as points,
      (select count(*)::int from eval_attempts a join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
        where a.student_id = ${studentId} and a.status = 'graded' and s.level_code = ${levelCode} and not (s.id = any(${excluded}::int[]))) as evals,
      (select round(avg(p.best_eval_score), 2) from course_progress p join courses c on c.id = p.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
        where p.student_id = ${studentId} and s.level_code = ${levelCode} and p.best_eval_score is not null and not (s.id = any(${excluded}::int[]))) as avg,
      (select count(*)::int from course_progress p join courses c on c.id = p.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
        where p.student_id = ${studentId} and s.level_code = ${levelCode} and p.best_eval_score is not null and not (s.id = any(${excluded}::int[]))) as avg_courses,
      (select count(distinct a.course_id)::int from eval_attempts a join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
        where a.student_id = ${studentId} and a.status = 'graded' and s.level_code = ${levelCode} and not (s.id = any(${excluded}::int[]))) as evaluated`;
  const sum = (k: 'total' | 'published' | 'started' | 'acquired' | 'mastered') => followed.reduce((a, s) => a + s[k], 0);
  return {
    courses_total: sum('total'), published: sum('published'), started: sum('started'), acquired: sum('acquired'), mastered: sum('mastered'),
    avg: t.avg === null ? null : Number(t.avg), evaluations: t.evals, active_minutes: t.minutes, points: t.points, subjects: lines,
    evaluated: t.evaluated, avg_courses: t.avg_courses,
  };
}

const nextSchoolYear = (y: string) => { const a = Number(y.slice(0, 4)); return Number.isFinite(a) ? `${a + 1}-${a + 2}` : y; };

export class LevelChangeRefused extends Error {}

// Passage dans l'année supérieure (ou redoublement, réorientation) : clôture de l'année en cours avec son bilan, ouverture d'une nouvelle
export async function startNewYear(studentId: string, levelCode: string, actorId: string, opts: { schoolYear?: string; note?: string }) {
  const [current] = await sql<{ id: string; level_code: string; school_year: string; started_at: Date }[]>`
    select id, level_code, school_year, started_at from student_years where student_id = ${studentId} and status = 'en_cours'`;
  const [lvl] = await sql`select 1 from levels where code = ${levelCode}`;
  if (!lvl) throw new LevelChangeRefused('Niveau inconnu.');
  const summary = current ? await yearSummary(studentId, current.level_code, current.started_at, new Date()) : null;
  const schoolYear = opts.schoolYear?.match(/^\d{4}-\d{4}$/) ? opts.schoolYear : current ? nextSchoolYear(current.school_year) : null;
  await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'student:' + studentId}))`;
    const [running] = await tx`select 1 from eval_attempts where student_id = ${studentId} and status = 'in_progress'`;
    if (running) throw new LevelChangeRefused('Une évaluation est en train d’être passée : attendez la fin avant de changer d’année.');
    if (current) await tx`update student_years set status = 'terminee', ended_at = now(), summary = ${tx.json(summary as never)} where id = ${current.id}`;
    await tx`insert into student_years (student_id, level_code, school_year, note, created_by)
      values (${studentId}, ${levelCode}, ${schoolYear ?? tx`school_year_of(now())`}, ${opts.note?.trim() || null}, ${actorId})`;
    await tx`update students set level_code = ${levelCode}, settings = settings - 'excluded_subjects' where id = ${studentId}`;
    await tx`insert into activity_log (student_id, event, actor_id, data, prev_hash, hash)
      values (${studentId}, 'annee_scolaire_commencee', ${actorId}, ${tx.json({ niveau: levelCode, annee: schoolYear, precedent: current?.level_code ?? null })}, '', '')`;
  });
}

// Correction du niveau de l'année en cours (erreur de saisie) : rien n'est clôturé
export async function correctLevel(studentId: string, levelCode: string, actorId: string) {
  const [lvl] = await sql`select 1 from levels where code = ${levelCode}`;
  if (!lvl) throw new LevelChangeRefused('Niveau inconnu.');
  await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'student:' + studentId}))`;
    const [prev] = await tx<{ level_code: string }[]>`select level_code from students where id = ${studentId}`;
    if (prev?.level_code === levelCode) return;
    await tx`update student_years set level_code = ${levelCode}, note = coalesce(note || ' · ', '') || 'niveau corrigé' where student_id = ${studentId} and status = 'en_cours'`;
    await tx`update students set level_code = ${levelCode}, settings = settings - 'excluded_subjects' where id = ${studentId}`;
    await tx`insert into activity_log (student_id, event, actor_id, data, prev_hash, hash)
      values (${studentId}, 'niveau_corrige', ${actorId}, ${tx.json({ avant: prev?.level_code ?? null, apres: levelCode })}, '', '')`;
  });
}

export async function setFollowedSubjects(studentId: string, levelCode: string, followed: number[]) {
  const all = await sql<{ id: number }[]>`select id from subjects where level_code = ${levelCode}`;
  const excluded = all.map(s => s.id).filter(id => !followed.includes(id));
  await sql`update students set settings = settings || ${sql.json({ excluded_subjects: excluded })} where id = ${studentId}`;
}
