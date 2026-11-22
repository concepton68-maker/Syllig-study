import 'server-only';
import { sql } from './db';
import type { CourseDocument } from './course-format';
import { MASTERY, reviewDelayDays } from './settings';
import { addPoints, logEvent } from './activity';

export type Version = { id: string; course_id: number; version: number; status: string; document: CourseDocument };

export async function publishedVersion(courseId: number): Promise<Version | null> {
  const [v] = await sql<Version[]>`select id, course_id, version, status, document from course_versions where course_id = ${courseId} and status = 'published'`;
  return v ?? null;
}
export async function versionById(id: string): Promise<Version | null> {
  const [v] = await sql<Version[]>`select id, course_id, version, status, document from course_versions where id = ${id}`;
  return v ?? null;
}

export type Progress = {
  student_id: string; course_id: number; lesson_done_at: Date | null; exercises_done_at: Date | null;
  exercises_score: number | null; best_eval_score: string | null; mastery: number; forced: 'now' | 'later' | null;
  next_review_at: Date | null; points_awarded: Record<string, boolean>;
};

export async function getProgress(studentId: string, courseId: number): Promise<Progress> {
  const [p] = await sql<Progress[]>`
    insert into course_progress (student_id, course_id) values (${studentId}, ${courseId})
    on conflict (student_id, course_id) do update set student_id = excluded.student_id
    returning *`;
  return p;
}

// Accorde des points une seule fois par jalon et par cours
export async function awardOnce(studentId: string, courseId: number, key: string, amount: number, reason: string) {
  const res = await sql`update course_progress set points_awarded = points_awarded || ${sql.json({ [key]: true })}
    where student_id = ${studentId} and course_id = ${courseId} and not (points_awarded ? ${key}) returning 1`;
  if (res.length) await addPoints(studentId, amount, reason, courseId);
}

// Niveau de maîtrise (section 5 du cadrage). Il ne baisse jamais par ce calcul.
export async function recomputeMastery(studentId: string, courseId: number) {
  const p = await getProgress(studentId, courseId);
  const attempts = await sql<{ final_score: string; started_at: Date }[]>`
    select final_score, started_at from eval_attempts
    where student_id = ${studentId} and course_id = ${courseId} and status = 'graded'`;
  const best = attempts.length ? Math.max(...attempts.map(a => Number(a.final_score))) : null;
  let m = 0;
  if (p.lesson_done_at) m = 1;
  if (p.exercises_done_at || (best !== null && best < MASTERY.evalNearly)) m = Math.max(m, 2);
  if ((p.exercises_score ?? 0) >= MASTERY.exercisesNearly || (best !== null && best >= MASTERY.evalNearly)) m = Math.max(m, 3);
  if (best !== null && best >= MASTERY.evalAcquired) m = Math.max(m, 4);
  if (p.lesson_done_at && attempts.some(a =>
    Number(a.final_score) >= MASTERY.evalMastered &&
    a.started_at.getTime() - p.lesson_done_at!.getTime() >= MASTERY.masteredDelayDays * 864e5)) m = 5;
  const mastery = Math.max(m, p.mastery);
  if (mastery > p.mastery) await logEvent(studentId, 'niveau_atteint', { courseId, data: { niveau: mastery, libelle: MASTERY.labels[mastery] } });
  await sql`update course_progress set mastery = ${mastery}, best_eval_score = ${best}, updated_at = now()
    where student_id = ${studentId} and course_id = ${courseId}`;
  return mastery;
}

export function nextReviewDate(score: number) {
  return new Date(Date.now() + reviewDelayDays(score) * 864e5);
}

// ───────── Parcours ─────────
export type ParcoursItem = {
  course_id: number; code: string | null; title: string; priority: string; position: number;
  subject: string; chapter: string; published: boolean; mastery: number;
  lesson_done: boolean; exercises_done: boolean; forced: string | null; next_review_at: Date | null;
  pending_attempt: string | null; graded_count: number; last_graded_at: Date | null; best: string | null;
  durations: { lesson: number; exercises: number; evaluation: number } | null;
};

export async function parcours(studentId: string, levelCode: string): Promise<ParcoursItem[]> {
  return sql<ParcoursItem[]>`
    select c.id as course_id, c.code, c.title, c.priority, c.position, s.name as subject, ch.name as chapter,
      (v.id is not null) as published, coalesce(p.mastery, 0) as mastery,
      (p.lesson_done_at is not null) as lesson_done, (p.exercises_done_at is not null) as exercises_done,
      p.forced, p.next_review_at, p.best_eval_score as best,
      (select a.status from eval_attempts a where a.student_id = ${studentId} and a.course_id = c.id
        and a.status in ('requested','approved','in_progress','submitted') order by a.attempt_no desc limit 1) as pending_attempt,
      (select count(*)::int from eval_attempts a where a.student_id = ${studentId} and a.course_id = c.id and a.status = 'graded') as graded_count,
      (select max(a.graded_at) from eval_attempts a where a.student_id = ${studentId} and a.course_id = c.id and a.status = 'graded') as last_graded_at,
      case when v.id is null then null else jsonb_build_object(
        'lesson', (v.document->'lesson'->>'duration_min')::int,
        'exercises', (v.document->'exercises'->>'duration_min')::int,
        'evaluation', (v.document->'evaluation'->>'duration_min')::int) end as durations
    from courses c
    join chapters ch on ch.id = c.chapter_id
    join subjects s on s.id = ch.subject_id
    left join course_versions v on v.course_id = c.id and v.status = 'published'
    left join course_progress p on p.course_id = c.id and p.student_id = ${studentId}
    where s.level_code = ${levelCode}
    order by
      case when p.forced = 'now' then 0 when p.forced = 'later' then 2 else 1 end,
      case c.priority when 'prioritaire' then 0 when 'ensuite' then 1 else 2 end,
      c.position`;
}

export type Step = { kind: 'lesson' | 'exercises' | 'evaluation' | 'waiting' | 'retry' | 'done' | 'soon'; label: string; minutes?: number };

export function nextStep(c: ParcoursItem, retryDelayDays: number): Step {
  if (!c.published) return { kind: 'soon', label: 'Bientôt disponible' };
  if (!c.lesson_done) return { kind: 'lesson', label: '① Leçon', minutes: c.durations?.lesson };
  if (!c.exercises_done) return { kind: 'exercises', label: '② Exercices', minutes: c.durations?.exercises };
  if (c.pending_attempt === 'submitted') return { kind: 'waiting', label: 'Évaluation en correction' };
  if (c.pending_attempt) return { kind: 'evaluation', label: '③ Évaluation', minutes: c.durations?.evaluation };
  if (c.graded_count === 0) return { kind: 'evaluation', label: '③ Évaluation', minutes: c.durations?.evaluation };
  if (c.mastery >= 4) return { kind: 'done', label: 'Acquis' };
  const ready = !c.last_graded_at || Date.now() - new Date(c.last_graded_at).getTime() >= retryDelayDays * 864e5;
  return { kind: 'retry', label: ready ? 'Nouvelle tentative possible' : 'Nouvelle tentative bientôt', minutes: c.durations?.evaluation };
}

// Prochaine étape conseillée : cours forcé, puis cours commencé, puis ordre du parcours
export function pickNext(items: ParcoursItem[], retryDelayDays: number) {
  const actionable = items.filter(c => {
    const s = nextStep(c, retryDelayDays);
    return ['lesson', 'exercises', 'evaluation'].includes(s.kind) || (s.kind === 'retry' && s.label.startsWith('Nouvelle tentative possible'));
  });
  const started = actionable.filter(c => c.forced !== 'later' && (c.lesson_done || c.pending_attempt));
  return actionable.find(c => c.forced === 'now') ?? started[0] ?? actionable.find(c => c.forced !== 'later') ?? actionable[0] ?? null;
}

export async function gradeAttemptFinal(attemptId: string, scores: Record<string, number>, feedback: Record<string, string>, gradedBy: string) {
  const [a] = await sql<{ student_id: string; course_id: number; attempt_no: number }[]>`
    select student_id, course_id, attempt_no from eval_attempts where id = ${attemptId}`;
  const total = Math.round(Object.values(scores).reduce((x, y) => x + y, 0) * 100) / 100;
  const [prev] = await sql<{ best: string | null }[]>`select max(final_score) as best from eval_attempts
    where student_id = ${a.student_id} and course_id = ${a.course_id} and status = 'graded'`;
  await sql`update eval_attempts set status = 'graded', scores = ${sql.json(scores)}, feedback = ${sql.json(feedback)},
    final_score = ${total}, graded_by = ${gradedBy}, graded_at = now() where id = ${attemptId}`;
  await sql`update course_progress set next_review_at = ${nextReviewDate(total)} where student_id = ${a.student_id} and course_id = ${a.course_id}`;
  await logEvent(a.student_id, 'evaluation_notee', { courseId: a.course_id, actorId: gradedBy, data: { tentative: a.attempt_no, note: total } });
  const before = prev.best === null ? null : Number(prev.best);
  if (before === null) await addPoints(a.student_id, 50, 'Première évaluation notée', a.course_id);
  else if (total > before) await addPoints(a.student_id, Math.round((total - before) * 10), `Progression : +${(total - before).toLocaleString('fr-FR')} point(s)`, a.course_id);
  await recomputeMastery(a.student_id, a.course_id);
  return total;
}
