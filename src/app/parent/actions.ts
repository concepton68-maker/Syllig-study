'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkNewPassword, setPassword } from '@/lib/password';
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

// « Mot de passe oublié » : le parent écarte des demandes (déjà réglées autrement), en groupe
export async function dismissPasswordRequests(form: FormData) {
  const u = await requireUser('parent');
  const ids = form.getAll('ids').map(String).filter(x => /^\d+$/.test(x));
  if (ids.length) await sql`update password_requests r set done_at = now() from students s
    where r.id in ${sql(ids)} and r.done_at is null and s.user_id = r.user_id
      and s.household_id in (select household_id from household_members where user_id = ${u.id} and role = 'parent')`;
  revalidatePath('/parent/a-faire');
}

// « Mot de passe oublié » : le parent choisit le nouveau mot de passe depuis « À faire »
export async function answerPasswordRequest(studentId: string, form: FormData) {
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, studentId);
  const pw = String(form.get('password') ?? '');
  const err = checkNewPassword(pw);
  if (err || !s.user_id) redirect(`/parent/a-faire?erreur=${encodeURIComponent(err ?? 'Pas de compte de connexion pour cet élève.')}`);
  await setPassword(s.user_id!, pw);
  revalidatePath('/parent', 'layout');
  redirect(`/parent/a-faire?mdp=${encodeURIComponent(s.first_name)}`);
}
