import 'server-only';
import { sql } from './db';
import { evalQuestions } from './course-format';
import { versionById } from './progress';
import { subjectProgress } from './parent-data';

// Bilan « matière par matière » (maquette validée par le propriétaire le 26/11/2026) : uniquement des faits.
//  - notes : chaque copie notée depuis le 1er septembre de l'année scolaire, dans l'ordre (tentatives comprises) ;
//  - moyenne : moyenne arithmétique de ces notes, avec leur nombre ;
//  - cours acquis : cours au niveau « acquis » (évaluation à 14/20 ou plus) sur les cours disponibles ;
//  - à revoir : cours dont la dernière copie notée a au moins une question à 0 point ou sans réponse (lien vers cette copie).

export type SubjectSummary = {
  subject: string; notes: { id: string; at: string; note: number; title: string }[]; avg: number | null;
  acquired: number; published: number; review: { title: string; href: string; missed: number }[];
};

export async function schoolYearStart() {
  const [r] = await sql<{ d: string; start: Date }[]>`
    with t as (select (now() at time zone 'Europe/Paris')::date as today)
    select to_char(make_date(case when extract(month from today) >= 9 then extract(year from today)::int else extract(year from today)::int - 1 end, 9, 1), 'YYYY-MM-DD') as d,
      (make_date(case when extract(month from today) >= 9 then extract(year from today)::int else extract(year from today)::int - 1 end, 9, 1)::timestamp at time zone 'Europe/Paris') as start from t`;
  return r;
}

export async function subjectSummary(studentId: string, level: string): Promise<{ from: string; subjects: SubjectSummary[] }> {
  const { d: from, start } = await schoolYearStart();
  const progress = await subjectProgress(studentId, level);
  const atts = await sql<{ id: string; course_id: number; title: string; subject: string; note: string; at: Date; version_id: string; variant: number;
    answers: Record<string, string>; scores: Record<string, number> | null; auto_scores: Record<string, number> | null }[]>`
    select a.id, a.course_id, c.title, sj.name as subject, a.final_score as note, a.submitted_at as at, a.version_id, a.variant, a.answers, a.scores, a.auto_scores
    from eval_attempts a join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${studentId} and a.status = 'graded' and a.final_score is not null and a.submitted_at >= ${start} and sj.level_code = ${level} order by a.submitted_at`;
  const by = new Map<string, SubjectSummary>();
  const S = (name: string) => {
    if (!by.has(name)) { const p = progress.find(x => x.subject === name); by.set(name, { subject: name, notes: [], avg: null, acquired: p?.acquired ?? 0, published: p?.published ?? 0, review: [] }); }
    return by.get(name)!;
  };
  const followed = new Set(progress.map(p => p.subject));   // matières du niveau, sans les matières non suivies
  for (const a of atts.filter(a => followed.has(a.subject))) S(a.subject).notes.push({ id: a.id, at: a.at.toISOString(), note: Number(a.note), title: a.title });
  // dernière copie notée de chaque cours
  const last = new Map<number, (typeof atts)[number]>();
  for (const a of atts) last.set(a.course_id, a);
  for (const a of [...last.values()].filter(a => followed.has(a.subject))) {
    const doc = (await versionById(a.version_id))?.document;
    if (!doc) continue;
    const pts = { ...(a.auto_scores ?? {}), ...(a.scores ?? {}) };
    const missed = evalQuestions(doc, a.variant).filter(q => !(a.answers?.[q.id] ?? '').trim() || pts[q.id] === 0).length;
    if (missed) S(a.subject).review.push({ title: a.title, href: `/parent/revoir/copie/${a.id}`, missed });
  }
  for (const p of progress) if (p.started > 0 || p.acquired > 0) S(p.subject);
  const subjects = [...by.values()].map(s => ({ ...s, avg: s.notes.length ? Math.round((s.notes.reduce((n, x) => n + x.note, 0) / s.notes.length) * 10) / 10 : null }));
  const order = progress.map(p => p.subject);
  subjects.sort((a, b) => (order.indexOf(a.subject) + 1 || 999) - (order.indexOf(b.subject) + 1 || 999));
  return { from, subjects };
}
