'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { loadCourse } from '../data';
import { getAttempt, submitAttempt, GRACE_SECONDS } from '@/lib/evaluation';
import { logEvent } from '@/lib/activity';
import { evalAvailability } from '@/lib/evaluation';

export async function startEvaluation(courseIdParam: string) {
  const { student, course, version, doc, progress } = await loadCourse(courseIdParam);
  const av = await evalAvailability(student.id, course.id, !!progress.exercises_done_at, student.settings.retry_delay_days);
  let approvedId: string | null = null;
  if (!av.ok) {
    if ('pending' in av && av.pending?.status === 'approved') approvedId = av.pending.id;
    else redirect(`/eleve/cours/${course.id}/evaluation`);
  }
  const requestOnly = !approvedId && student.settings.eval_requires_approval;
  const started = await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'student:' + student.id}))`;
    if (approvedId) {
      const r = await tx`update eval_attempts set status = 'in_progress', version_id = ${version.id}, started_at = now(),
        deadline_at = now() + make_interval(mins => ${doc.evaluation.duration_min}) where id = ${approvedId} and status = 'approved' returning 1`;
      return r.length > 0;
    }
    // re-vérifié sous verrou : pas de deuxième tentative ouverte (double clic, deux onglets)
    const [open] = await tx`select 1 from eval_attempts where student_id = ${student.id} and course_id = ${course.id}
      and status in ('requested','approved','in_progress','submitted')`;
    if (open) return false;
    const [{ n }] = await tx<{ n: number }[]>`select coalesce(max(attempt_no), 0) + 1 as n from eval_attempts where student_id = ${student.id} and course_id = ${course.id}`;
    if (requestOnly) {
      await tx`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, requested_at)
        values (${student.id}, ${course.id}, ${version.id}, ${n}, ${(n - 1) % doc.evaluation.variants.length}, 'requested', now())`;
    } else {
      await tx`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, started_at, deadline_at)
        values (${student.id}, ${course.id}, ${version.id}, ${n}, ${(n - 1) % doc.evaluation.variants.length}, 'in_progress', now(),
          now() + make_interval(mins => ${doc.evaluation.duration_min}))`;
    }
    return true;
  });
  if (!started) redirect(`/eleve/cours/${course.id}/evaluation`);
  if (requestOnly) {
    const [r] = await sql<{ attempt_no: number }[]>`select attempt_no from eval_attempts where student_id = ${student.id} and course_id = ${course.id} order by attempt_no desc limit 1`;
    await logEvent(student.id, 'evaluation_demandee', { courseId: course.id, data: { tentative: r.attempt_no } });
    redirect(`/eleve/cours/${course.id}/evaluation`);
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
