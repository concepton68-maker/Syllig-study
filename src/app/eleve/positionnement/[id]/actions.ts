'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireStudent } from '@/lib/access';
import { logEvent } from '@/lib/activity';
import { placementFor, finishPlacement } from '@/lib/placement';

export async function startPlacement(id: string) {
  const { student } = await requireStudent();
  const t = await placementFor(student.id, id);
  if (!t) redirect('/eleve');
  if (t.status === 'propose') {
    await sql`update placement_tests set status = 'en_cours', started_at = now() where id = ${t.id} and status = 'propose'`;
    await logEvent(student.id, 'positionnement_commence', { data: { questions: t.total } });
  }
  redirect(`/eleve/positionnement/${id}`);
}

export async function submitPlacement(id: string, answers: Record<string, string>) {
  const { student } = await requireStudent();
  const t = await placementFor(student.id, id);
  if (!t) redirect('/eleve');
  if (t.status === 'en_cours') await finishPlacement(t, answers);
  revalidatePath('/eleve', 'layout'); revalidatePath('/parent', 'layout');
  redirect(`/eleve/positionnement/${id}`);
}
