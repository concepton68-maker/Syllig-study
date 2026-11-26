import 'server-only';
import { sql } from './db';
import { evalQuestions, type CourseDocument, type Question } from './course-format';
import { versionById } from './progress';

// Profil d'apprentissage d'un élève : uniquement des faits mesurés par la plateforme (temps actif, points de contrôle,
// exercices, évaluations). Ils sont montrés tels quels au parent et servent de base au bilan de l'IA.

export type Flag = { code: 'lecon_survolee' | 'controles_au_hasard' | 'evaluation_baclee' | 'copie_vide' | 'ecart_exercices_evaluation' | 'distraction' | 'temps_correct'; label: string };
export type EvalFact = {
  attempt_no: number; status: string; score: number | null; allowed_min: number; used_min: number | null;
  blank_ratio: number; focus_losses: number; auto_submitted: boolean;
  wrong: { prompt: string; reponse: string; corrige: string; points: number; max: number; competences?: string[] }[];
};
export type CourseFacts = {
  course_id: number; code: string; title: string; subject: string; level: string;
  lesson: { expected_min: number; active_min: number; done: boolean };
  checkpoints: { parts: number; first_try_ok: number; tries: number };
  exercises: { score: number | null; active_min: number };
  evaluations: EvalFact[];
  flags: Flag[];
};
export type PlacementFacts = { date: string; used_min: number | null; duration_min: number; score: number; total: number; blank: number;
  items: { matiere: string; notion: string; niveau_origine: string; correct: boolean; vide: boolean }[] };
export type Profile = {
  level: string; generated_at: string;
  global: { courses: number; active_min: number; sessions: number; days_active: number; eval_avg: number | null; evaluations: number };
  courses: CourseFacts[];
  placement: PlacementFacts[];
};

const min = (s: number) => Math.round(s / 60);
const cut = (s: string | undefined, n: number) => { const t = (s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export async function studentProfile(studentId: string): Promise<Profile> {
  const [st] = await sql<{ level: string }[]>`select l.name as level from students s join levels l on l.code = s.level_code where s.id = ${studentId}`;
  const courses = await sql<{ id: number; code: string; title: string; subject: string; level: string; doc: CourseDocument | null; lesson_done_at: Date | null; exercises_score: number | null }[]>`
    select c.id, c.code, c.title, s.name as subject, l.name as level,
      (select v.document from course_versions v where v.course_id = c.id and v.status = 'published' order by v.version desc limit 1) as doc,
      p.lesson_done_at, p.exercises_score
    from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    left join course_progress p on p.student_id = ${studentId} and p.course_id = c.id
    where c.id in (
      select course_id from course_progress where student_id = ${studentId} and (lesson_done_at is not null or exercises_done_at is not null or mastery > 0)
      union select course_id from eval_attempts where student_id = ${studentId}
      union select course_id from work_sessions where student_id = ${studentId} and course_id is not null
      union select course_id from checkpoint_answers where student_id = ${studentId})
    order by s.position, c.position`;
  const sessions = await sql<{ course_id: number | null; kind: string; active: number }[]>`
    select course_id, kind, coalesce(sum(active_seconds), 0)::int as active from work_sessions where student_id = ${studentId} group by course_id, kind`;
  const cps = await sql<{ course_id: number; part_index: number; first: boolean; tries: number }[]>`
    select course_id, part_index, (array_agg(correct order by answered_at))[1] as first, count(*)::int as tries
    from checkpoint_answers where student_id = ${studentId} group by course_id, part_index`;
  const attempts = await sql<{ id: string; course_id: number; version_id: string; variant: number; attempt_no: number; status: string; final_score: string | null;
    started_at: Date | null; submitted_at: Date | null; deadline_at: Date | null; answers: Record<string, string>; scores: Record<string, number> | null;
    auto_scores: Record<string, number> | null; focus_losses: number; late: boolean }[]>`
    select id, course_id, version_id, variant, attempt_no, status, final_score, started_at, submitted_at, deadline_at, answers, scores, auto_scores, focus_losses, late
    from eval_attempts where student_id = ${studentId} and status in ('submitted', 'graded') order by submitted_at`;
  const [g] = await sql<{ sessions: number; days: number; active: number }[]>`
    select count(*)::int as sessions, count(distinct (started_at at time zone 'Europe/Paris')::date)::int as days, coalesce(sum(active_seconds), 0)::int as active
    from work_sessions where student_id = ${studentId}`;

  const out: CourseFacts[] = [];
  for (const c of courses) {
    const act = (kind: string) => min(sessions.filter(x => x.course_id === c.id && x.kind === kind).reduce((n, x) => n + x.active, 0));
    const myCps = cps.filter(x => x.course_id === c.id);
    const evals: EvalFact[] = [];
    for (const a of attempts.filter(x => x.course_id === c.id)) {
      const doc = (await versionById(a.version_id))?.document;
      if (!doc) continue;
      const qs: Question[] = evalQuestions(doc, a.variant);
      const pts = a.scores ?? a.auto_scores ?? {};
      const blank = qs.filter(q => !(a.answers?.[q.id] ?? '').trim()).length;
      // durée réellement accordée (tiers-temps compris) : échéance du serveur − début ; à défaut, durée prévue
      const allowed = a.deadline_at && a.started_at ? Math.round((a.deadline_at.getTime() - a.started_at.getTime()) / 60000) : doc.evaluation.duration_min;
      const used = a.started_at && a.submitted_at ? Math.max(1, Math.round((a.submitted_at.getTime() - a.started_at.getTime()) / 60000)) : null;
      evals.push({
        attempt_no: a.attempt_no, status: a.status, score: a.final_score === null ? null : Number(a.final_score),
        allowed_min: allowed, used_min: used, blank_ratio: qs.length ? Math.round((blank / qs.length) * 100) / 100 : 0,
        focus_losses: a.focus_losses ?? 0, auto_submitted: !!a.late,
        wrong: qs.filter(q => q.id in pts && pts[q.id] < (q.points ?? 0)).map(q => ({
          prompt: cut(q.prompt, 260), reponse: cut(a.answers?.[q.id], 180) || '(vide)', corrige: cut(q.solution, 220),
          points: pts[q.id], max: q.points ?? 0, ...(q.skills?.length ? { competences: q.skills } : {}),
        })),
      });
    }
    const f: CourseFacts = {
      course_id: c.id, code: c.code, title: c.title, subject: c.subject, level: c.level,
      lesson: { expected_min: c.doc?.lesson.duration_min ?? 0, active_min: act('lesson'), done: !!c.lesson_done_at },
      checkpoints: { parts: myCps.length, first_try_ok: myCps.filter(x => x.first).length, tries: myCps.reduce((n, x) => n + x.tries, 0) },
      exercises: { score: c.exercises_score, active_min: act('exercises') },
      evaluations: evals, flags: [],
    };
    // signaux simples, toujours expliqués par les chiffres
    const L = f.lesson, E = evals.at(-1);
    if (L.done && L.expected_min > 0 && L.active_min < L.expected_min * 0.35)
      f.flags.push({ code: 'lecon_survolee', label: `Leçon lue en ${L.active_min} min pour ${L.expected_min} prévues` });
    else if (L.done && L.expected_min > 0 && L.active_min >= L.expected_min * 0.6)
      f.flags.push({ code: 'temps_correct', label: `Temps de leçon correct (${L.active_min} min pour ${L.expected_min} prévues)` });
    if (f.checkpoints.parts >= 2 && f.checkpoints.first_try_ok / f.checkpoints.parts < 0.5)
      f.flags.push({ code: 'controles_au_hasard', label: `Points de contrôle réussis du premier coup : ${f.checkpoints.first_try_ok} sur ${f.checkpoints.parts}` });
    if (E?.used_min && E.used_min < E.allowed_min * 0.3 && (E.score ?? 0) < 10)
      f.flags.push({ code: 'evaluation_baclee', label: `Évaluation rendue en ${E.used_min} min sur ${E.allowed_min}` });
    if (E && E.blank_ratio >= 0.4) f.flags.push({ code: 'copie_vide', label: `${Math.round(E.blank_ratio * 100)} % de questions laissées vides` });
    if (E && E.score !== null && (f.exercises.score ?? 0) >= 7 && E.score < 10)
      f.flags.push({ code: 'ecart_exercices_evaluation', label: `Exercices ${f.exercises.score}/10 mais évaluation ${E.score.toLocaleString('fr-FR')}/20` });
    if (E && E.focus_losses >= 3) f.flags.push({ code: 'distraction', label: `A quitté la page ${E.focus_losses} fois pendant l’évaluation` });
    out.push(f);
  }
  const scored = out.flatMap(c => c.evaluations.filter(e => e.status === 'graded' && e.score !== null).map(e => e.score!));

  const tests = await sql<{ submitted_at: Date; started_at: Date | null; duration_min: number; score: number; total: number; results: PlacementFacts['items'] }[]>`
    select submitted_at, started_at, duration_min, score, total, results from placement_tests where student_id = ${studentId} and status = 'termine' order by submitted_at`;
  return {
    level: st?.level ?? '', generated_at: new Date().toISOString(),
    global: { courses: out.length, active_min: min(g.active), sessions: g.sessions, days_active: g.days, evaluations: scored.length,
      eval_avg: scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100 : null },
    courses: out,
    placement: tests.map(t => ({ date: t.submitted_at.toISOString().slice(0, 10), duration_min: t.duration_min, score: t.score, total: t.total,
      used_min: t.started_at ? Math.max(1, Math.round((t.submitted_at.getTime() - t.started_at.getTime()) / 60000)) : null,
      blank: t.results.filter(r => r.vide).length, items: t.results })),
  };
}
