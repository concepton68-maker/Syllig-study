'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';
import { resetCourse, resetStudent } from '@/lib/reset';

export type ResetState = { ok?: string; error?: string } | undefined;

export async function resetCourseAction(_: ResetState, form: FormData): Promise<ResetState> {
  const u = await requireUser('parent');
  const studentId = z.string().uuid().parse(form.get('student'));
  const courseId = z.coerce.number().int().parse(form.get('course'));
  const s = await assertParentOf(u.id, studentId);
  const c = await resetCourse(s.id, courseId, u.id, { withSessions: form.get('sessions') === 'on' });
  revalidatePath(`/parent/enfants/${s.id}`);
  return { ok: `Cours remis à zéro : ${c.tentatives} tentative(s) d’évaluation, ${c.exercices} série(s) d’exercices et ${c.points} gain(s) de points effacés.` };
}

export async function resetStudentAction(_: ResetState, form: FormData): Promise<ResetState> {
  const u = await requireUser('parent');
  const studentId = z.string().uuid().parse(form.get('student'));
  const s = await assertParentOf(u.id, studentId);
  if (String(form.get('confirm') ?? '').trim().toLowerCase() !== s.first_name.toLowerCase())
    return { error: `Pour confirmer, tapez exactement le prénom « ${s.first_name} ».` };
  await resetStudent(s.id, u.id, { purgeLog: form.get('purge') === 'on' });
  revalidatePath(`/parent/enfants/${s.id}`);
  return { ok: `Le parcours de ${s.first_name} est revenu à zéro. Les comptes, réglages et thème sont conservés.` };
}
