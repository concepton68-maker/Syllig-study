'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireStudent } from '@/lib/access';
import { logEvent } from '@/lib/activity';
import { ITEMS, scoreCheckin } from '@/lib/checkin';

export async function saveCheckin(_: { error?: string } | undefined, form: FormData) {
  const { student } = await requireStudent();
  const answers: Record<string, number> = {};
  for (const it of ITEMS) {
    const v = Number(form.get(it.id));
    if (!Number.isInteger(v) || v < 0 || v > 3) return { error: 'Réponds à chaque phrase (une seule réponse par ligne).' };
    answers[it.id] = v;
  }
  const clip = (k: string) => String(form.get(k) ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const free = { aide: clip('aide'), bloque: clip('bloque') };
  await sql`insert into student_checkins (student_id, answers, scores, free) values (${student.id}, ${sql.json(answers)}, ${sql.json(scoreCheckin(answers))}, ${sql.json(free)})`;
  await sql`update students set settings = settings - 'checkin_requested' where id = ${student.id}`;
  await logEvent(student.id, 'questionnaire_rempli', {});
  revalidatePath('/eleve', 'layout'); revalidatePath('/parent', 'layout');
  redirect('/eleve?questionnaire=merci');
}
