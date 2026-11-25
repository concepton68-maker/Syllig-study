import 'server-only';
import { sql } from './db';
import { evalQuestions } from './course-format';
import { versionById } from './progress';

// « Travail et résultats » : uniquement des faits mesurés par la plateforme, sur une fenêtre de dates explicite.
// Aucune note composite, aucun seuil caché, aucune interprétation psychologique : chaque chiffre a une définition affichée.
//  - jours travaillés : jours (heure de Paris) où le temps effectif cumulé atteint 10 minutes ;
//  - temps effectif : minutes où l'élève agit sur une page de travail (signal toutes les 15 s, pause après 60 s sans geste) ;
//  - copie complète : au moins 30 % du temps accordé utilisé ET au moins 60 % des questions répondues ;
//  - exercices : seulement les questions corrigées par la plateforme (les auto-évaluations de l'élève sont comptées à part).

export const WINDOW_DAYS = 28;
export const COMPLETE_RULE = 'au moins 30 % du temps accordé utilisé et au moins 60 % des questions répondues';
export type SubjectFacts = { subject: string; active_min: number; cp_ok: number; cp_total: number; ex_ok: number; ex_total: number; complete: number[]; incomplete: number };
export type Facts = {
  from: string; to: string;
  work: { days: number; active_min: number; open_min: number; goal_min: number; lessons_done: number; lesson_min: number; lesson_expected_min: number };
  evals: { complete: { n: number; avg: number | null }; incomplete: { n: number; avg: number | null }; focus_losses: number; pending: number };
  learning: { cp_ok: number; cp_total: number; ex_ok: number; ex_total: number; self_ok: number; self_total: number };
  subjects: SubjectFacts[];
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const avg = (xs: number[]) => xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

export async function workFacts(studentId: string): Promise<Facts> {
  // fenêtre : les 28 derniers jours civils (heure de Paris), aujourd'hui compris
  const [win] = await sql<{ from: string; to: string; start: Date }[]>`
    select to_char((now() at time zone 'Europe/Paris')::date - ${WINDOW_DAYS - 1}::int, 'YYYY-MM-DD') as from,
      to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD') as to,
      (((now() at time zone 'Europe/Paris')::date - ${WINDOW_DAYS - 1}::int)::timestamp at time zone 'Europe/Paris') as start`;
  const [st] = await sql<{ goal: number }[]>`select coalesce((settings->>'weekly_goal_minutes')::int, 300) as goal from students where id = ${studentId}`;
  const [w] = await sql<{ active: number; open: number; days: number }[]>`
    with d as (select (started_at at time zone 'Europe/Paris')::date as day, sum(active_seconds) as a, sum(open_seconds) as o
      from work_sessions where student_id = ${studentId} and started_at >= ${win.start} group by 1)
    select coalesce(sum(a), 0)::int as active, coalesce(sum(o), 0)::int as open, count(*) filter (where a >= 600)::int as days from d`;

  // leçons terminées dans la fenêtre : temps effectif passé sur la leçon / durée prévue
  const lessons = await sql<{ course_id: number; doc: { lesson: { duration_min: number } } | null; active: number }[]>`
    select p.course_id, (select v.document from course_versions v where v.course_id = p.course_id and v.status = 'published' order by v.version desc limit 1) as doc,
      coalesce((select sum(active_seconds) from work_sessions s where s.student_id = p.student_id and s.course_id = p.course_id and s.kind = 'lesson'), 0)::int as active
    from course_progress p where p.student_id = ${studentId} and p.lesson_done_at >= ${win.start}`;

  // évaluations remises dans la fenêtre
  const atts = await sql<{ version_id: string; variant: number; answers: Record<string, string>; started_at: Date | null; submitted_at: Date; deadline_at: Date | null; status: string; final_score: string | null; focus_losses: number; subject: string }[]>`
    select a.version_id, a.variant, a.answers, a.started_at, a.submitted_at, a.deadline_at, a.status, a.final_score, a.focus_losses, sj.name as subject
    from eval_attempts a join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${studentId} and a.status in ('submitted', 'graded') and a.submitted_at >= ${win.start}`;
  // points de contrôle : premier essai de chaque partie, fait dans la fenêtre
  const cps = await sql<{ ok: boolean; subject: string }[]>`
    select (array_agg(a.correct order by a.answered_at))[1] as ok, sj.name as subject from checkpoint_answers a
    join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${studentId} group by a.course_id, a.part_index, sj.name having min(a.answered_at) >= ${win.start}`;
  // exercices remis dans la fenêtre
  const exs = await sql<{ auto_results: Record<string, boolean> | null; self_check: Record<string, boolean> | null; checked: boolean; subject: string }[]>`
    select e.auto_results, e.self_check, e.checked_at is not null as checked, sj.name as subject from exercise_submissions e
    join courses c on c.id = e.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where e.student_id = ${studentId} and e.submitted_at >= ${win.start}`;
  const sessionsBySubject = await sql<{ subject: string; active: number }[]>`
    select sj.name as subject, sum(w.active_seconds)::int as active from work_sessions w
    join courses c on c.id = w.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where w.student_id = ${studentId} and w.started_at >= ${win.start} group by 1`;

  const subj = new Map<string, SubjectFacts>();
  const S = (name: string) => { if (!subj.has(name)) subj.set(name, { subject: name, active_min: 0, cp_ok: 0, cp_total: 0, ex_ok: 0, ex_total: 0, complete: [], incomplete: 0 }); return subj.get(name)!; };
  for (const r of sessionsBySubject) S(r.subject).active_min = Math.round(r.active / 60);

  const complete: number[] = [], incomplete: number[] = [];
  let pending = 0, focus = 0;
  for (const a of atts) {
    focus += a.focus_losses ?? 0;
    const doc = (await versionById(a.version_id))?.document;
    if (!doc) continue;
    const qs = evalQuestions(doc, a.variant);
    const answered = qs.filter(q => (a.answers?.[q.id] ?? '').trim()).length / Math.max(1, qs.length);
    const allowed = a.deadline_at && a.started_at ? (a.deadline_at.getTime() - a.started_at.getTime()) / 60000 : doc.evaluation.duration_min;
    const used = a.started_at ? (a.submitted_at.getTime() - a.started_at.getTime()) / 60000 : null;
    const isComplete = (used === null || used >= allowed * 0.3) && answered >= 0.6;
    if (a.status !== 'graded' || a.final_score === null) { pending++; if (!isComplete) S(a.subject).incomplete++; continue; }
    const note = Number(a.final_score);
    if (isComplete) { complete.push(note); S(a.subject).complete.push(note); } else { incomplete.push(note); S(a.subject).incomplete++; }
  }
  let exOk = 0, exTotal = 0, selfOk = 0, selfTotal = 0;
  for (const e of exs) {
    const auto = e.auto_results ?? {};
    const k = Object.keys(auto);
    exTotal += k.length; exOk += k.filter(id => auto[id]).length;
    S(e.subject).ex_total += k.length; S(e.subject).ex_ok += k.filter(id => auto[id]).length;
    if (e.checked) { const sc = e.self_check ?? {}; const ks = Object.keys(sc).filter(id => !(id in auto)); selfTotal += ks.length; selfOk += ks.filter(id => sc[id]).length; }
  }
  for (const c of cps) { S(c.subject).cp_total++; if (c.ok) S(c.subject).cp_ok++; }

  return {
    from: win.from, to: win.to,
    work: {
      days: w.days, active_min: Math.round(w.active / 60), open_min: Math.round(w.open / 60), goal_min: st.goal * 4,
      lessons_done: lessons.length, lesson_min: Math.round(lessons.reduce((n, l) => n + l.active, 0) / 60),
      lesson_expected_min: lessons.reduce((n, l) => n + (l.doc?.lesson.duration_min ?? 0), 0),
    },
    evals: { complete: { n: complete.length, avg: avg(complete) }, incomplete: { n: incomplete.length, avg: avg(incomplete) }, focus_losses: focus, pending },
    learning: { cp_ok: cps.filter(c => c.ok).length, cp_total: cps.length, ex_ok: exOk, ex_total: exTotal, self_ok: selfOk, self_total: selfTotal },
    subjects: [...subj.values()].sort((a, b) => b.active_min - a.active_min),
  };
}
