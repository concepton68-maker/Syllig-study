'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { studentsOfParent, assertParentOf } from '@/lib/access';
import { importResults } from '@/lib/corrections';
import { evalQuestions } from '@/lib/course-format';
import { versionById, gradeAttemptFinal, recomputeMastery } from '@/lib/progress';
import { getAttempt } from '@/lib/evaluation';
import { logEvent } from '@/lib/activity';
import { correctWithAi } from '@/lib/ai';
import type { Attempt } from '@/lib/evaluation';

export type ImportCorrState = { errors?: string[]; warnings?: string[]; ok?: number } | undefined;

export async function importCorrectionsAction(_: ImportCorrState, form: FormData): Promise<ImportCorrState> {
  const u = await requireUser('parent');
  const file = form.get('file');
  const pasted = String(form.get('json') ?? '').trim();
  const raw = file instanceof File && file.size > 0 ? await file.text() : pasted;
  if (!raw) return { errors: ['Choisis le fichier renvoyé par Claude, ou colle son contenu.'] };
  const ids = (await studentsOfParent(u.id)).map(s => s.id);
  const r = await importResults(raw, ids, u.id);
  if (!r.ok) return { errors: r.errors };
  for (const sid of r.studentIds) await logEvent(sid, 'corrections_importees', { actorId: u.id, data: { copies: r.count } });
  revalidatePath('/parent', 'layout');
  return { ok: r.count, warnings: r.warnings };
}

const Grades = z.object({ attempt: z.string().uuid() });

// Validation par le parent : la note devient définitive
export async function validateGrade(form: FormData) {
  const u = await requireUser('parent');
  const { attempt } = Grades.parse({ attempt: form.get('attempt') });
  const a = await getAttempt(attempt);
  if (!a) redirect('/parent/copies');
  await assertParentOf(u.id, a.student_id);
  const qs = evalQuestions((await versionById(a.version_id))!.document, a.variant);
  const scores: Record<string, number> = {}, feedback: Record<string, string> = {};
  for (const q of qs) {
    const raw = form.get(`p_${q.id}`);
    // question corrigée automatiquement : la note automatique reste, sauf si le parent l'ajuste (points partiels)
    if (a.auto_scores && q.id in a.auto_scores && (raw === null || String(raw).trim() === '')) { scores[q.id] = a.auto_scores[q.id]; continue; }
    const v = Number(String(raw ?? '').replace(',', '.'));
    if (!Number.isFinite(v) || v < 0 || v > (q.points ?? 0)) redirect(`/parent/copies/${a.id}?erreur=${q.id}`);
    scores[q.id] = Math.round(v * 4) / 4;
    const c = String(form.get(`c_${q.id}`) ?? '').trim();
    if (c) feedback[q.id] = c.slice(0, 2000);
  }
  const g = String(form.get('general') ?? '').trim();
  if (g) feedback.general = g.slice(0, 2000);

  if (a.status === 'submitted') {
    await gradeAttemptFinal(a.id, scores, feedback, u.id);
  } else if (a.status === 'graded') {
    const motif = String(form.get('motif') ?? '').trim();
    if (!motif) redirect(`/parent/copies/${a.id}?erreur=motif`);
    const total = Math.round(Object.values(scores).reduce((x, y) => x + y, 0) * 100) / 100;
    await sql`update eval_attempts set scores = ${sql.json(scores)}, feedback = ${sql.json(feedback)}, final_score = ${total}, graded_by = ${u.id}, graded_at = now() where id = ${a.id}`;
    await logEvent(a.student_id, 'note_modifiee', { courseId: a.course_id, actorId: u.id, data: { tentative: a.attempt_no, ancienne: Number(a.final_score), note: total, motif } });
    await sql`update course_progress set best_eval_score = (select max(final_score) from eval_attempts where student_id = ${a.student_id} and course_id = ${a.course_id} and status = 'graded'), mastery = 0 where student_id = ${a.student_id} and course_id = ${a.course_id}`;
    await recomputeMastery(a.student_id, a.course_id);
  }
  revalidatePath('/parent', 'layout');
  redirect('/parent/a-faire?validee=1');
}

// Correction par l'IA branchée : les copies cochées (sinon toutes celles en attente) reçoivent des propositions
export async function correctWithAiAction(form: FormData) {
  const u = await requireUser('parent');
  const ids = (await studentsOfParent(u.id)).map(s => s.id);
  const picked = form.getAll('ids').map(String).filter(x => /^[0-9a-f-]{36}$/i.test(x));
  const attempts = ids.length ? await sql<(Attempt & { title: string; subject: string; level: string })[]>`
    select a.*, c.title, s.name as subject, l.name as level from eval_attempts a
    join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    where a.student_id in ${sql(ids)} and a.status = 'submitted' ${picked.length ? sql`and a.id in ${sql(picked)}` : sql``} order by a.submitted_at` : [];
  const r = await correctWithAi(attempts, ids, u.id);
  for (const sid of r.studentIds ?? []) await logEvent(sid, 'corrections_importees', { actorId: u.id, data: { copies: r.ok, par: 'ia' } });
  revalidatePath('/parent', 'layout');
  const q = new URLSearchParams({ ia: String(r.ok) });
  if (r.errors.length) q.set('iaerr', r.errors.join(' · ').slice(0, 600));
  redirect(`/parent/a-faire?${q}`);
}

// Validation groupée : les copies pré-corrigées reçoivent la note proposée telle quelle
export async function validateProposalsBulk(form: FormData) {
  const u = await requireUser('parent');
  const allowed = (await studentsOfParent(u.id)).map(s => s.id);
  let n = 0;
  for (const id of form.getAll('ids').map(String).filter(x => /^[0-9a-f-]{36}$/i.test(x))) {
    const a = await getAttempt(id);
    if (!a || a.status !== 'submitted' || !a.proposal || !allowed.includes(a.student_id)) continue;
    const qs = evalQuestions((await versionById(a.version_id))!.document, a.variant);
    const scores: Record<string, number> = {}, feedback: Record<string, string> = {};
    let complete = true;
    for (const q of qs) {
      if (a.auto_scores && q.id in a.auto_scores) { scores[q.id] = a.auto_scores[q.id]; continue; }
      const p = a.proposal[q.id];
      if (!p) { complete = false; break; }
      scores[q.id] = p.points;
      if (p.comment) feedback[q.id] = p.comment;
    }
    if (!complete) continue;
    if (a.proposal.general?.comment) feedback.general = a.proposal.general.comment;
    await gradeAttemptFinal(a.id, scores, feedback, u.id);
    n++;
  }
  revalidatePath('/parent', 'layout');
  redirect(`/parent/a-faire?validees=${n}`);
}
