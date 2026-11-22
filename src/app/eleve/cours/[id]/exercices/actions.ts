'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { loadCourse } from '../data';
import { autoCorrect } from '@/lib/course-format';
import { awardOnce, recomputeMastery, versionById } from '@/lib/progress';
import { logEvent } from '@/lib/activity';

const Answers = z.record(z.string().max(40), z.string().max(8000));

async function current(studentId: string, courseId: number) {
  const [s] = await sql<{ id: string; version_id: string; answers: Record<string, string>; submitted_at: Date | null; checked_at: Date | null }[]>`
    select id, version_id, answers, submitted_at, checked_at from exercise_submissions
    where student_id = ${studentId} and course_id = ${courseId} order by created_at desc limit 1`;
  return s ?? null;
}

export async function saveExerciseDraft(courseIdParam: string, answers: Record<string, string>) {
  const { student, course } = await loadCourse(courseIdParam);
  const a = Answers.parse(answers);
  const s = await current(student.id, course.id);
  if (!s || s.submitted_at) return { ok: false };
  await sql`update exercise_submissions set answers = ${sql.json(a)} where id = ${s.id}`;
  return { ok: true };
}

// Remise des réponses : les corrigés deviennent visibles, les questions automatiques sont corrigées.
export async function submitExercises(courseIdParam: string, answers: Record<string, string>) {
  const { student, course } = await loadCourse(courseIdParam);
  const a = Answers.parse(answers);
  const s = await current(student.id, course.id);
  if (!s || s.submitted_at) return;
  const doc = (await versionById(s.version_id))!.document;
  const auto: Record<string, boolean> = {};
  for (const q of doc.exercises.items) { const r = autoCorrect(q, a[q.id]); if (r !== null) auto[q.id] = r; }
  await sql`update exercise_submissions set answers = ${sql.json(a)}, auto_results = ${sql.json(auto)}, submitted_at = now() where id = ${s.id}`;
  await logEvent(student.id, 'exercices_remis', { courseId: course.id, data: { reponses: Object.values(a).filter(x => x.trim()).length, total: doc.exercises.items.length } });
  revalidatePath(`/eleve/cours/${course.id}/exercices`);
}

// Auto-correction guidée des réponses rédigées (l'élève compare avec le corrigé)
export async function validateExercises(courseIdParam: string, selfCheck: Record<string, boolean>) {
  const { student, course } = await loadCourse(courseIdParam);
  const s = await current(student.id, course.id);
  if (!s || !s.submitted_at || s.checked_at) return;
  const doc = (await versionById(s.version_id))!.document;
  const [{ auto_results }] = await sql<{ auto_results: Record<string, boolean> }[]>`select auto_results from exercise_submissions where id = ${s.id}`;
  const results = doc.exercises.items.map(q => (q.id in (auto_results ?? {}) ? auto_results[q.id] : !!selfCheck[q.id]));
  const score = Math.round((10 * results.filter(Boolean).length) / results.length);
  await sql`update exercise_submissions set self_check = ${sql.json(selfCheck)}, checked_at = now() where id = ${s.id}`;
  await sql`update course_progress set exercises_done_at = coalesce(exercises_done_at, now()),
    exercises_score = greatest(coalesce(exercises_score, 0), ${score}), updated_at = now()
    where student_id = ${student.id} and course_id = ${course.id}`;
  await logEvent(student.id, 'exercices_termines', { courseId: course.id, data: { score_sur_10: score } });
  await awardOnce(student.id, course.id, 'exercises', 50, 'Exercices terminés');
  await recomputeMastery(student.id, course.id);
  revalidatePath(`/eleve/cours/${course.id}/exercices`);
}

export async function restartExercises(courseIdParam: string) {
  const { student, course, version, progress } = await loadCourse(courseIdParam);
  if (!progress.lesson_done_at) return;
  const s = await current(student.id, course.id);
  if (s && !s.checked_at) return;
  await sql`insert into exercise_submissions (student_id, course_id, version_id) values (${student.id}, ${course.id}, ${version.id})`;
  revalidatePath(`/eleve/cours/${course.id}/exercices`);
}
