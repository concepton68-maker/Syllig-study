import 'server-only';
import { z } from 'zod/v4';
import { sql } from './db';
import { aiConfigFor, askJson, askText, logAiRequest } from './ai';
import { enqueue, progressReporter } from './jobs';
import { importCourse } from './import-course';
import { FIGURE_RULE } from './prompt-builder';
import type { CourseDocument } from './course-format';

// Relecture d'un cours existant par l'IA (comme un inspecteur pédagogique) : erreurs de fond, corrigés faux, barèmes,
// adéquation au niveau. Puis, à la demande, correction en nouvelle version (brouillon à relire, jamais publiée seule).

export const Review = z.object({
  verdict: z.enum(['publiable', 'a_corriger', 'a_reecrire']),
  synthese: z.string(),
  problemes: z.array(z.object({
    gravite: z.enum(['bloquant', 'important', 'mineur']),
    ou: z.string(),
    constat: z.string(),
    correction: z.string(),
  })),
  points_forts: z.array(z.string()),
});
export type Review = z.infer<typeof Review>;
export const VERDICT_LABEL: Record<Review['verdict'], string> = { publiable: 'Publiable', a_corriger: 'À corriger', a_reecrire: 'À réécrire' };

const SYSTEM_REVIEW = `Tu es relecteur et inspecteur pédagogique (collège et lycée, France). Tu relis un cours de la plateforme Syllig Study (format JSON : leçon en parties avec points de contrôle, exercices avec corrigés, évaluation avec sujets, corrigés et barèmes).

Vérifie, dans cet ordre de priorité :
1. Les erreurs de fond : règle fausse, définition inexacte, exemple qui contredit la règle, calcul faux, fait historique erroné.
2. Les corrigés : réponse attendue fausse, « answer » d'un QCM qui ne désigne pas la bonne option, réponse numérique erronée, barème incohérent avec les points.
3. L'adéquation au niveau et au programme officiel, la progression, la clarté pour un élève.
4. Les manques importants pour le niveau (notion attendue absente), dont les schémas : une notion qui se comprend mal sans dessin (bête à cornes, figure de géométrie, circuit, schéma de SVT, graphique…) et qui n'a pas de bloc « figure » est un problème « important » ; un schéma faux est « bloquant ».

Règles : ne signale que des problèmes réels et vérifiés, avec l'endroit précis (« ou » : partie, exercice ex3, sujet 2 · q4…), le constat et la correction exacte à faire. Gravité : « bloquant » = enseigne une erreur ou corrigé faux ; « important » = ambigu, manque notable ; « mineur » = forme. Verdict : « publiable » si aucun problème bloquant ni important. Français, phrases courtes.`;

const SYSTEM_FIX = `Tu es auteur de cours pour Syllig Study. Tu corriges un cours existant. Tu réponds UNIQUEMENT par le document JSON complet du cours corrigé (format syllig-course/1), sans texte avant ou après, sans balises de code. Garde exactement la même structure, le même code, le même niveau, la même matière, le même chapitre et le même titre ; ne modifie que ce qui est nécessaire pour corriger les problèmes listés. Un schéma manquant s'ajoute en bloc « figure ».

${FIGURE_RULE}`;

export async function requestReview(courseId: number) {
  const [v] = await sql<{ id: string }[]>`select id from course_versions where course_id = ${courseId} and status in ('draft', 'published') order by status = 'draft' desc, version desc limit 1`;
  if (!v) return null;
  return enqueue('relecture', { versionId: v.id, courseId }, `relecture:${v.id}`);
}

export async function runReviewJob(versionId: string, jobId: string | null) {
  const report = progressReporter(jobId);
  const conf = await aiConfigFor('relecture');
  if ('error' in conf) throw new Error(conf.error);
  const [v] = await sql<{ course_id: number; version: number; document: CourseDocument }[]>`select course_id, version, document from course_versions where id = ${versionId}`;
  if (!v) throw new Error('version introuvable');
  report('relecture en cours…');
  const payload = `Cours à relire (JSON) :\n${JSON.stringify(v.document)}`;
  let data: Review;
  try { data = await askJson(conf.cfg, Review, SYSTEM_REVIEW, payload, 'high'); }
  catch (e) { await logAiRequest(null, 'relecture', conf.cfg, `Relecture ${v.document.code} v${v.version}`, (e as Error).message.slice(0, 300)); throw e; }
  await logAiRequest(null, 'relecture', conf.cfg, `Relecture ${v.document.code} v${v.version}`);
  const [r] = await sql<{ id: string }[]>`insert into course_reviews (course_id, version_id, provider, model, data)
    values (${v.course_id}, ${versionId}, ${conf.cfg.provider}, ${conf.cfg.model}, ${sql.json(data)}) returning id`;
  return { review: r.id, problemes: data.problemes.length, verdict: data.verdict };
}

export async function requestFix(reviewId: string, userId: string) {
  const [r] = await sql<{ course_id: number }[]>`select course_id from course_reviews where id = ${reviewId}`;
  return enqueue('cours_corrige', { reviewId, userId, courseId: r?.course_id }, `cours_corrige:${reviewId}`);
}

export async function runFixJob(reviewId: string, userId: string | null, jobId: string | null) {
  const report = progressReporter(jobId);
  const conf = await aiConfigFor('relecture');
  if ('error' in conf) throw new Error(conf.error);
  const [r] = await sql<{ course_id: number; version_id: string; data: Review; document: CourseDocument; version: number }[]>`
    select r.course_id, r.version_id, r.data, v.document, v.version from course_reviews r join course_versions v on v.id = r.version_id where r.id = ${reviewId}`;
  if (!r) throw new Error('relecture introuvable');
  const todo = r.data.problemes.filter(p => p.gravite !== 'mineur' || r.data.problemes.length <= 12);
  if (!todo.length) return { skipped: 'rien à corriger' };
  const who = userId ?? (await sql<{ user_id: string }[]>`select user_id from user_roles where role = 'admin' limit 1`)[0]?.user_id ?? null;
  if (!who) throw new Error('aucun compte administrateur');
  const prompt = `Corrige uniquement ces problèmes relevés à la relecture :\n${todo.map((p, i) => `${i + 1}. [${p.gravite}] ${p.ou} — ${p.constat} → ${p.correction}`).join('\n')}\n\nCours actuel (JSON) :\n${JSON.stringify(r.document)}`;
  report('correction en cours… l’IA réécrit le cours');
  let text: string;
  try { text = await askText(conf.cfg, SYSTEM_FIX, prompt, 32000, n => report(`correction : environ ${Math.min(99, Math.round(n / 450))} % réécrit`)); }
  catch (e) { await logAiRequest(null, 'relecture', conf.cfg, `Correction ${r.document.code} v${r.version}`, (e as Error).message.slice(0, 300)); throw e; }
  await logAiRequest(null, 'relecture', conf.cfg, `Correction ${r.document.code} v${r.version}`);
  report('vérification par le validateur');
  const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const imp = await importCourse(raw, `Corrigé par l’IA (${conf.cfg.provider} · ${conf.cfg.model}) après relecture`, who);
  if (!imp.ok) throw new Error(`version corrigée refusée par le validateur : ${imp.errors.slice(0, 4).join(' ; ')}`);
  await sql`update course_reviews set fixed_version_id = ${imp.versionId} where id = ${reviewId}`;
  return { courseId: imp.courseId, version: imp.version };
}
