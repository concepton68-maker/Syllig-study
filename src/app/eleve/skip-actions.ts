'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireStudent } from '@/lib/access';
import { logEvent } from '@/lib/activity';

/** « Passer cette leçon » : aucune sanction (ni points, ni niveau), le cours passe après les autres jusqu'au retour de l'élève. */
export async function skipCourse(courseId: number) {
  const { student } = await requireStudent();
  if (!Number.isInteger(courseId)) return;
  const [c] = await sql<{ id: number; title: string }[]>`select c.id, c.title from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
    where c.id = ${courseId} and s.level_code = ${student.level_code}`;
  if (!c) return;
  // une évaluation commencée a un chronomètre : on ne propose pas de la laisser filer (ce serait une sanction déguisée)
  const [busy] = await sql<{ n: number }[]>`select count(*)::int as n from eval_attempts where student_id = ${student.id} and course_id = ${c.id} and status = 'in_progress'`;
  if (busy.n) redirect(`/eleve/cours/${c.id}/evaluation`);
  await sql`insert into course_progress (student_id, course_id, skipped_at) values (${student.id}, ${c.id}, now())
    on conflict (student_id, course_id) do update set skipped_at = now(), updated_at = now()`;
  await logEvent(student.id, 'lecon_passee', { courseId: c.id });
  revalidatePath('/eleve');
  redirect(`/eleve?passee=${c.id}`);
}
