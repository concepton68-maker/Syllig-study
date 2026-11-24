'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertParentOf, studentsOfParent } from '@/lib/access';
import { logEvent } from '@/lib/activity';
import { generateReport, placementQuestion, ReportData } from '@/lib/report';

const back = (studentId: string, q: Record<string, string>) => `/parent/bilan?${new URLSearchParams({ eleve: studentId, ...q })}`;

// Bilan par l'IA (peut prendre une à deux minutes)
export async function requestReport(studentId: string) {
  const u = await requireUser('parent');
  await assertParentOf(u.id, studentId);
  const r = await generateReport(studentId, u.id);
  if (r.error || !r.id) redirect(back(studentId, { erreur: r.error ?? 'Bilan impossible.' }));
  await logEvent(studentId, 'bilan_ia', { actorId: u.id, data: { rapport: r.id } });
  revalidatePath('/parent', 'layout'); revalidatePath('/contenu', 'layout');
  redirect(back(studentId, { rapport: r.id!, ...(r.note ? { note: r.note } : {}) }));
}

// Proposer à l'élève le test de positionnement d'un bilan
export async function assignPlacement(reportId: string) {
  const u = await requireUser('parent');
  const [r] = await sql<{ student_id: string; data: ReportData }[]>`select student_id, data from student_reports where id = ${reportId}`;
  if (!r) redirect('/parent/bilan');
  await assertParentOf(u.id, r.student_id);
  const [open] = await sql`select 1 from placement_tests where student_id = ${r.student_id} and status <> 'termine'`;
  if (open) redirect(back(r.student_id, { rapport: reportId, erreur: 'Un test de positionnement est déjà proposé : attendez qu’il soit fait (ou retirez-le).' }));
  const questions = r.data.test_positionnement.questions.map(placementQuestion).filter(q => q !== null);
  if (questions.length < 5) redirect(back(r.student_id, { rapport: reportId, erreur: 'Le test proposé par l’IA n’est pas utilisable : demandez un nouveau bilan.' }));
  const duration = Math.min(40, Math.max(10, Math.round(questions.length * 1.5)));
  await sql`insert into placement_tests (student_id, report_id, created_by, questions, duration_min, total)
    values (${r.student_id}, ${reportId}, ${u.id}, ${sql.json({ consigne: r.data.test_positionnement.consigne_eleve, items: questions })}, ${duration}, ${questions.length})`;
  await logEvent(r.student_id, 'positionnement_propose', { actorId: u.id, data: { questions: questions.length } });
  revalidatePath('/parent', 'layout'); revalidatePath('/eleve', 'layout');
  redirect(back(r.student_id, { rapport: reportId, test: 'propose' }));
}

// Suppressions groupées (bilans, tests)
async function mineOnly(userId: string, table: 'student_reports' | 'placement_tests', ids: string[]) {
  const allowed = (await studentsOfParent(userId)).map(s => s.id);
  const clean = ids.filter(x => /^[0-9a-f-]{36}$/i.test(x));
  if (!clean.length || !allowed.length) return 0;
  return (await sql`delete from ${sql(table)} where id in ${sql(clean)} and student_id in ${sql(allowed)} returning 1`).length;
}
export async function deleteReports(form: FormData) {
  const u = await requireUser('parent');
  await mineOnly(u.id, 'student_reports', form.getAll('ids').map(String));
  revalidatePath('/parent/bilan');
}
export async function deletePlacementTests(form: FormData) {
  const u = await requireUser('parent');
  await mineOnly(u.id, 'placement_tests', form.getAll('ids').map(String));
  revalidatePath('/parent', 'layout'); revalidatePath('/eleve', 'layout');
}
