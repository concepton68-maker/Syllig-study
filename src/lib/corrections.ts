import 'server-only';
import { z } from 'zod';
import { sql } from './db';
import { evalQuestions } from './course-format';
import { versionById } from './progress';
import type { Attempt } from './evaluation';

// Échange de corrections avec Claude, hors plateforme (décision de cadrage : pas d'IA branchée en v1).
export const CONSIGNE = `Tu es correcteur bienveillant et rigoureux pour Syllig Study (collège et lycée, France).
Pour chaque question de chaque copie ci-dessous :
1. Compare la réponse de l'élève au corrigé, en appliquant strictement le barème (« bareme »). Les points vont de 0 à « points_max », par pas de 0,25.
2. Accepte toute réponse juste formulée autrement que le corrigé. Ne pénalise pas l'orthographe, sauf si le barème le prévoit.
3. Rédige un commentaire destiné à l'élève, en le tutoyant, en 1 à 2 phrases : d'abord ce qui est réussi, puis une seule piste concrète pour progresser. Jamais de reproche ni d'ironie.
4. Ajoute pour chaque copie un « commentaire_general » encourageant (1 à 2 phrases).
Réponds UNIQUEMENT par un JSON au format « format_reponse » (même « ref » et mêmes « id » que dans les copies), sans texte autour.`;

export async function buildExport(attempts: (Attempt & { title: string; subject: string; level: string })[]) {
  const copies = [];
  for (const a of attempts) {
    const doc = (await versionById(a.version_id))!.document;
    const variant = doc.evaluation.variants[a.variant % doc.evaluation.variants.length];
    const texts = new Map(variant.texts.map(t => [t.id, `${t.label} : ${t.paragraphs.join('\n')}`]));
    const questions = evalQuestions(doc, a.variant).filter(q => !(a.auto_scores && q.id in a.auto_scores)).map(q => ({
      id: q.id, points_max: q.points, consigne: q.prompt, ...(q.text_ref ? { texte_support: texts.get(q.text_ref) } : {}),
      reponse_eleve: a.answers[q.id] ?? '', corrige: q.solution, bareme: q.rubric ?? `Selon la justesse de la réponse, ${q.points} point(s) au maximum.`,
    }));
    if (questions.length) copies.push({ ref: a.id, niveau: a.level, matiere: a.subject, cours: a.title, questions });
  }
  return {
    format: 'syllig-corrections/1',
    exporte_le: new Date().toISOString(),
    consigne: CONSIGNE,
    format_reponse: { format: 'syllig-corrections-resultat/1', copies: [{ ref: '…', commentaire_general: '…', questions: [{ id: 'q7', points: 1.5, commentaire: '…' }] }] },
    copies,
  };
}

const ResultFile = z.object({
  format: z.literal('syllig-corrections-resultat/1'),
  copies: z.array(z.object({
    ref: z.string().uuid(),
    commentaire_general: z.string().max(2000).optional(),
    questions: z.array(z.object({ id: z.string(), points: z.number().min(0), commentaire: z.string().max(2000).optional() })),
  })).min(1),
});

// Vérifie le fichier renvoyé par Claude et enregistre des propositions (rien n'est définitif avant validation du parent)
export async function importResults(raw: string, allowedStudentIds: string[], actorId: string) {
  let parsed;
  try { parsed = ResultFile.safeParse(JSON.parse(raw)); } catch (e) { return { ok: false as const, errors: [`Fichier illisible : ${(e as Error).message}`] }; }
  if (!parsed.success) return { ok: false as const, errors: parsed.error.issues.map(i => `${i.path.join(' › ')} : ${i.message}`) };
  const errors: string[] = [];
  const toSave: { a: Attempt; proposal: Record<string, { points: number; comment?: string }> }[] = [];
  for (const c of parsed.data.copies) {
    const [a] = await sql<Attempt[]>`select * from eval_attempts where id = ${c.ref}`;
    if (!a || !allowedStudentIds.includes(a.student_id)) { errors.push(`Copie ${c.ref.slice(0, 8)} : introuvable`); continue; }
    if (a.status !== 'submitted') { errors.push(`Copie ${c.ref.slice(0, 8)} : déjà notée, ignorée`); continue; }
    const qs = new Map(evalQuestions((await versionById(a.version_id))!.document, a.variant).map(q => [q.id, q]));
    const proposal: Record<string, { points: number; comment?: string }> = {};
    for (const r of c.questions) {
      const q = qs.get(r.id);
      if (!q || (a.auto_scores && r.id in a.auto_scores)) { errors.push(`Copie ${c.ref.slice(0, 8)} : question « ${r.id} » inattendue`); continue; }
      const pts = Math.round(r.points * 4) / 4;
      if (pts > (q.points ?? 0)) { errors.push(`Copie ${c.ref.slice(0, 8)} · ${r.id} : ${r.points} points pour un maximum de ${q.points}`); continue; }
      proposal[r.id] = { points: pts, comment: r.commentaire };
    }
    if (c.commentaire_general) proposal.general = { points: 0, comment: c.commentaire_general };
    toSave.push({ a, proposal });
  }
  if (errors.some(e => !e.endsWith('ignorée'))) return { ok: false as const, errors };
  for (const { a, proposal } of toSave) {
    await sql`update eval_attempts set proposal = ${sql.json(proposal)} where id = ${a.id}`;
  }
  return { ok: true as const, count: toSave.length, warnings: errors, studentIds: [...new Set(toSave.map(t => t.a.student_id))], actorId };
}
