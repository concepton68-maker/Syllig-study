'use server';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';
import { logEvent } from '@/lib/activity';

export async function decideEvalRequest(attemptId: string, approve: boolean) {
  const u = await requireUser('parent');
  const [a] = await sql<{ student_id: string; course_id: number; attempt_no: number }[]>`select student_id, course_id, attempt_no from eval_attempts where id = ${attemptId} and status = 'requested'`;
  if (!a) return;
  await assertParentOf(u.id, a.student_id);
  await sql`update eval_attempts set status = ${approve ? 'approved' : 'cancelled'}, approved_at = ${approve ? new Date() : null} where id = ${attemptId}`;
  await logEvent(a.student_id, approve ? 'evaluation_autorisee' : 'evaluation_reportee', { courseId: a.course_id, actorId: u.id, data: { tentative: a.attempt_no } });
  revalidatePath('/parent', 'layout');
}

// Actions groupées sur les demandes d'évaluation
async function decideMany(form: FormData, approve: boolean) {
  for (const id of form.getAll('ids')) if (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) await decideEvalRequest(id, approve);
}
export async function approveRequestsBulk(form: FormData) { await decideMany(form, true); }
export async function postponeRequestsBulk(form: FormData) { await decideMany(form, false); }
