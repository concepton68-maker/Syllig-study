'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertParentOf, studentsOfParent } from '@/lib/access';
import { logEvent } from '@/lib/activity';
import { generateReport } from '@/lib/report';
import { assignPlacementFromReport } from '@/lib/automation';
import { enqueue } from '@/lib/jobs';
import { assignEntryTest } from '@/lib/entry-test';

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
  const [r] = await sql<{ student_id: string }[]>`select student_id from student_reports where id = ${reportId}`;
  if (!r) redirect('/parent/bilan');
  await assertParentOf(u.id, r.student_id);
  const res = await assignPlacementFromReport(reportId, u.id);
  if ('error' in res) redirect(back(r.student_id, { rapport: reportId, erreur: res.error }));
  revalidatePath('/parent', 'layout'); revalidatePath('/eleve', 'layout');
  redirect(back(r.student_id, { rapport: reportId, test: 'propose' }));
}

// Proposer le test de rentrée de sa classe (sans IA)
export async function assignEntry(studentId: string) {
  const u = await requireUser('parent');
  await assertParentOf(u.id, studentId);
  const res = await assignEntryTest(studentId, u.id);
  if ('error' in res) redirect(back(studentId, { erreur: res.error }));
  revalidatePath('/parent', 'layout'); revalidatePath('/eleve', 'layout');
  redirect(back(studentId, { test: 'propose' }));
}

// Proposer le questionnaire « Comment je travaille » maintenant (sans attendre les 6 semaines)
export async function requestCheckin(studentId: string) {
  const u = await requireUser('parent');
  await assertParentOf(u.id, studentId);
  await sql`update students set settings = settings || '{"checkin_requested": true}'::jsonb where id = ${studentId}`;
  revalidatePath('/parent', 'layout'); revalidatePath('/eleve', 'layout');
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

// Consentement du parent (RGPD) pour cet enfant : correction par l'IA, bilan par l'IA
export async function saveAiConsent(studentId: string, form: FormData) {
  const u = await requireUser('parent');
  await assertParentOf(u.id, studentId);
  const ai_correction = form.get('ai_correction') === 'on', ai_bilan = form.get('ai_bilan') === 'on';
  const bilan = String(form.get('auto_bilan') ?? 'off');
  // un automatisme n'est possible qu'avec l'accord correspondant
  const v = { ai_correction, ai_bilan, auto_correction: ai_correction && form.get('auto_correction') === 'on',
    auto_bilan: ai_bilan && (bilan === '3_evals' || bilan === 'hebdo') ? bilan : 'off', auto_test: ai_bilan && form.get('auto_test') === 'on' };
  await sql`update students set settings = settings || ${sql.json(v)} where id = ${studentId}`;
  await logEvent(studentId, 'consentement_ia', { actorId: u.id, data: { correction: v.ai_correction, bilan: v.ai_bilan, auto_correction: v.auto_correction, auto_bilan: v.auto_bilan, auto_test: v.auto_test } });
  // correction automatique activée : les copies déjà en attente partent aussi
  if (v.auto_correction) for (const a of await sql<{ id: string }[]>`select id from eval_attempts where student_id = ${studentId} and status = 'submitted' and proposal is null`)
    await enqueue('correction', { attemptId: a.id }, `correction:${a.id}`);
  revalidatePath('/parent', 'layout');
  redirect(back(studentId, { consentement: '1' }));
}

// Journal des envois : le parent peut en effacer des lignes
export async function deleteAiRequests(form: FormData) {
  const u = await requireUser('parent');
  const allowed = (await studentsOfParent(u.id)).map(s => s.id);
  const ids = form.getAll('ids').map(String).filter(x => /^\d+$/.test(x));
  if (ids.length && allowed.length) await sql`delete from ai_requests where id in ${sql(ids)} and student_id in ${sql(allowed)}`;
  revalidatePath('/parent/bilan');
}
