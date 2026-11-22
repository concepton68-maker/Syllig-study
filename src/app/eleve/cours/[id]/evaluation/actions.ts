'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { loadCourse } from '../data';
import { getAttempt, submitAttempt, GRACE_SECONDS } from '@/lib/evaluation';
import { logEvent } from '@/lib/activity';

export async function evalAvailability(studentId: string, courseId: number, exercisesDone: boolean, retryDelayDays: number) {
  if (!exercisesDone) return { ok: false as const, reason: 'Termine d’abord les exercices.' };
  const [pending] = await sql<{ id: string; status: string }[]>`select id, status from eval_attempts where student_id = ${studentId} and course_id = ${courseId}
    and status in ('requested','approved','in_progress','submitted') order by attempt_no desc limit 1`;
  if (pending) return { ok: false as const, pending };
  const [last] = await sql<{ graded_at: Date }[]>`select graded_at from eval_attempts where student_id = ${studentId} and course_id = ${courseId} and status = 'graded' order by graded_at desc limit 1`;
  if (last) {
    const readyAt = new Date(last.graded_at.getTime() + retryDelayDays * 864e5);
    if (readyAt.getTime() > Date.now()) return { ok: false as const, readyAt };
  }
  return { ok: true as const };
}

export async function startEvaluation(courseIdParam: string) {
  const { student, course, version, doc, progress } = await loadCourse(courseIdParam);
  const av = await evalAvailability(student.id, course.id, !!progress.exercises_done_at, student.settings.retry_delay_days);
  let approvedId: string | null = null;
  if (!av.ok) {
    if ('pending' in av && av.pending?.status === 'approved') approvedId = av.pending.id;
    else redirect(`/eleve/cours/${course.id}/evaluation`);
  }
  if (!approvedId && student.settings.eval_requires_approval) {
    const [{ n }] = await sql<{ n: number }[]>`select coalesce(max(attempt_no), 0) + 1 as n from eval_attempts where student_id = ${student.id} and course_id = ${course.id}`;
    await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, requested_at)
      values (${student.id}, ${course.id}, ${version.id}, ${n}, ${(n - 1) % doc.evaluation.variants.length}, 'requested', now())`;
    await logEvent(student.id, 'evaluation_demandee', { courseId: course.id, data: { tentative: n } });
    redirect(`/eleve/cours/${course.id}/evaluation`);
  }
  if (approvedId) {
    await sql`update eval_attempts set status = 'in_progress', version_id = ${version.id}, started_at = now(),
      deadline_at = now() + make_interval(mins => ${doc.evaluation.duration_min}) where id = ${approvedId}`;
  } else {
    const [{ n }] = await sql<{ n: number }[]>`select coalesce(max(attempt_no), 0) + 1 as n from eval_attempts where student_id = ${student.id} and course_id = ${course.id}`;
    await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, started_at, deadline_at)
      values (${student.id}, ${course.id}, ${version.id}, ${n}, ${(n - 1) % doc.evaluation.variants.length}, 'in_progress', now(),
        now() + make_interval(mins => ${doc.evaluation.duration_min}))`;
  }
  const [a] = await sql<{ attempt_no: number; variant: number }[]>`select attempt_no, variant from eval_attempts where student_id = ${student.id} and course_id = ${course.id} order by attempt_no desc limit 1`;
  await logEvent(student.id, 'evaluation_commencee', { courseId: course.id, data: { tentative: a.attempt_no, sujet: a.variant + 1, duree_autorisee_min: doc.evaluation.duration_min } });
  redirect(`/eleve/cours/${course.id}/evaluation`);
}

export async function submitEvaluation(courseIdParam: string, attemptId: string, answers: Record<string, string>) {
  const { student, course } = await loadCourse(courseIdParam);
  const a = await getAttempt(z.string().uuid().parse(attemptId));
  if (!a || a.student_id !== student.id || a.course_id !== course.id) redirect(`/eleve/cours/${course.id}`);
  if (a.status === 'in_progress') {
    const inTime = !a.deadline_at || Date.now() <= a.deadline_at.getTime() + GRACE_SECONDS * 1000;
    const clean = z.record(z.string().max(40), z.string().max(8000)).parse(answers);
    if (inTime) await sql`update eval_attempts set answers = ${sql.json(clean)} where id = ${a.id}`;
    await submitAttempt((await getAttempt(a.id))!);
  }
  redirect(`/eleve/cours/${course.id}/bilan/${a.id}`);
}
