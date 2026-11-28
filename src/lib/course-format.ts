// Format d'échange des cours : syllig-course/1
// C'est le contrat entre la génération (Claude, hors plateforme) et l'import.
// Toute évolution incompatible = nouveau numéro de format.
import { z } from 'zod';

const text = z.string().trim().min(1);
const str = z.string();

// Schéma dessiné en SVG, écrit dans le cours lui-même (demande du propriétaire, 28/11/2026 : bête à cornes, figures de
// géométrie, circuits, graphiques…). Affiché comme une image (jamais inséré dans la page : aucun script ne peut s'exécuter).
export const SVG_MAX = 60_000;
export const svgCode = z.string().trim()
  .refine(s => /^<svg[\s>]/i.test(s) && /<\/svg>\s*$/i.test(s), 'le schéma doit être un SVG complet (<svg …>…</svg>)')
  .refine(s => s.length <= SVG_MAX, `schéma trop lourd (${SVG_MAX / 1000} 000 caractères au plus)`)
  .refine(s => !/<script|<foreignObject|\son[a-z]+\s*=|javascript:/i.test(s), 'le schéma ne doit contenir ni script, ni foreignObject, ni attribut on…')
  .refine(s => !/(href|src)\s*=\s*["'](https?:|\/\/|data:)/i.test(s) && !/url\(\s*["']?(https?:|\/\/)/i.test(s), 'le schéma ne doit charger aucune ressource extérieure');
export const Figure = z.object({ svg: svgCode, alt: text, caption: str.optional() });
export type Figure = z.infer<typeof Figure>;

export const Block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text }),
  z.object({ type: z.literal('heading'), text }),
  z.object({ type: z.literal('list'), items: z.array(text).min(1), ordered: z.boolean().optional() }),
  z.object({
    type: z.literal('table'),
    caption: str.optional(),
    columns: z.array(str).optional(),
    rows: z.array(z.array(str)).min(1),
  }),
  z.object({
    type: z.literal('callout'),
    kind: z.enum(['retiens', 'definition', 'attention', 'plus', 'methode', 'essentiel']),
    title: str.optional(),
    text,
  }),
  z.object({ type: z.literal('quote'), text, source: str.optional() }),
  z.object({ type: z.literal('formula'), latex: text }),
  z.object({ type: z.literal('image'), url: z.string().url(), alt: text }),
  z.object({ type: z.literal('figure'), svg: svgCode, alt: text, caption: str.optional() }),
]);
export type Block = z.infer<typeof Block>;

export const Cognitive = z.enum(['connaitre', 'appliquer', 'analyser', 'rediger']);

export const Question = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,24}$/i, 'identifiant de question invalide (lettres, chiffres, - ou _)'),
  type: z.enum(['open', 'qcm', 'numeric', 'short']),
  prompt: text,
  figure: Figure.optional(),                    // schéma de l'énoncé (figure de géométrie, montage, graphique…)
  text_ref: str.optional(),                     // texte support (id d'un des "texts")
  points: z.number().positive().optional(),     // obligatoire en évaluation
  stars: z.number().int().min(1).max(3).optional(),
  skills: z.array(str).optional(),
  cognitive: Cognitive.optional(),
  lesson_part: z.number().int().min(1).optional(),
  options: z.array(text).min(2).max(8).optional(), // qcm
  answer: z.union([z.number(), z.array(z.number()), z.array(str)]).optional(), // qcm : index (0-based) ; numeric : valeur ; short : réponses acceptées
  tolerance: z.number().nonnegative().optional(),
  solution: text,                               // corrigé (jamais envoyé avant la réponse)
  rubric: str.optional(),                       // barème détaillé, sert à la correction
});
export type Question = z.infer<typeof Question>;

export const SupportText = z.object({
  id: z.string().min(1),
  label: text,
  paragraphs: z.array(text).min(1),
  source: str.optional(),
});
export type SupportText = z.infer<typeof SupportText>;

export const Checkpoint = z.object({
  variants: z.array(z.object({
    prompt: text,
    quote: str.optional(),
    options: z.array(text).min(2).max(6),
    answer: z.number().int().min(0),
    hint: str.optional(),
    explanation: str.optional(),
  })).min(2, 'chaque point de contrôle doit avoir au moins 2 variantes'),
});

export const CourseDocument = z.object({
  format: z.literal('syllig-course/1'),
  code: z.string().regex(/^[A-Z]{1,3}\d{3,5}$/, 'code attendu du type C001'),
  level: z.string().min(1),
  subject: text,
  chapter: text,
  title: text,
  skills: z.array(z.object({ id: z.string().min(1), label: text })).default([]),
  lesson: z.object({
    duration_min: z.number().int().positive(),
    objectives: z.array(text).default([]),
    essential: str.optional(),
    parts: z.array(z.object({
      title: text,
      blocks: z.array(Block).min(1),
      checkpoint: Checkpoint.optional(),
    })).min(1),
    memo: z.array(z.object({ label: text, text })).optional(),
  }),
  exercises: z.object({
    duration_min: z.number().int().positive(),
    instructions: str.optional(),
    pass_threshold: z.number().int().min(0).max(10).default(8),
    texts: z.array(SupportText).default([]),
    items: z.array(Question).min(1),
  }),
  evaluation: z.object({
    duration_min: z.number().int().positive(),
    conditions: str.optional(),
    total_points: z.literal(20, { message: 'les évaluations sont notées sur 20' }).default(20),
    variants: z.array(z.object({
      texts: z.array(SupportText).default([]),
      sections: z.array(z.object({ label: text, questions: z.array(Question).min(1) })).min(1),
    })).min(1),
  }),
});
export type CourseDocument = z.infer<typeof CourseDocument>;

export type ValidationResult =
  | { ok: true; doc: CourseDocument; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

function checkQuestion(q: Question, where: string, doc: CourseDocument, texts: string[], errors: string[], warnings: string[], isEval: boolean) {
  const at = `${where} · ${q.id}`;
  if (isEval && q.points === undefined) errors.push(`${at} : « points » obligatoire en évaluation`);
  if (q.type === 'qcm') {
    if (!q.options) errors.push(`${at} : un QCM doit avoir des « options »`);
    const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
    if (q.answer === undefined || ans.some(a => typeof a !== 'number' || a < 0 || !q.options || a >= q.options.length))
      errors.push(`${at} : « answer » doit donner l'index (à partir de 0) d'une option existante`);
  }
  if (q.type === 'numeric' && typeof q.answer !== 'number') errors.push(`${at} : « answer » numérique attendu`);
  if (q.type === 'short' && !(Array.isArray(q.answer) && q.answer.every(a => typeof a === 'string') && q.answer.length > 0))
    errors.push(`${at} : « answer » doit lister les réponses acceptées`);
  if (q.type === 'open' && isEval && !q.rubric) warnings.push(`${at} : pas de barème détaillé (« rubric ») — la correction sera moins précise`);
  if (q.text_ref && !texts.includes(q.text_ref)) errors.push(`${at} : texte support « ${q.text_ref} » introuvable`);
  const skillIds = new Set(doc.skills.map(s => s.id));
  for (const s of q.skills ?? []) if (!skillIds.has(s)) errors.push(`${at} : compétence « ${s} » non déclarée dans « skills »`);
  if (q.lesson_part && q.lesson_part > doc.lesson.parts.length) errors.push(`${at} : partie de leçon ${q.lesson_part} inexistante`);
  if (!q.skills?.length) warnings.push(`${at} : aucune compétence associée (la cartographie sera moins fine)`);
}

export function validateCourse(input: unknown): ValidationResult {
  const parsed = CourseDocument.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      warnings: [],
      errors: parsed.error.issues.map(i => `${i.path.join(' › ') || 'document'} : ${i.message}`),
    };
  }
  const doc = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  doc.lesson.parts.forEach((p, i) => {
    if (!p.checkpoint) warnings.push(`Leçon · partie ${i + 1} : pas de point de contrôle`);
    p.checkpoint?.variants.forEach((v, j) => {
      if (v.answer >= v.options.length) errors.push(`Leçon · partie ${i + 1} · variante ${j + 1} : « answer » hors des options`);
    });
  });

  const exIds = new Set<string>();
  const exTexts = doc.exercises.texts.map(t => t.id);
  for (const q of doc.exercises.items) {
    if (exIds.has(q.id)) errors.push(`Exercices : identifiant « ${q.id} » en double`);
    exIds.add(q.id);
    checkQuestion(q, 'Exercices', doc, exTexts, errors, warnings, false);
  }

  doc.evaluation.variants.forEach((v, vi) => {
    const ids = new Set<string>();
    let total = 0;
    const texts = v.texts.map(t => t.id);
    for (const s of v.sections) for (const q of s.questions) {
      if (ids.has(q.id)) errors.push(`Évaluation · sujet ${vi + 1} : identifiant « ${q.id} » en double`);
      ids.add(q.id);
      total += q.points ?? 0;
      checkQuestion(q, `Évaluation · sujet ${vi + 1}`, doc, texts, errors, warnings, true);
    }
    if (Math.abs(total - doc.evaluation.total_points) > 0.001)
      errors.push(`Évaluation · sujet ${vi + 1} : le barème fait ${total} points au lieu de ${doc.evaluation.total_points}`);
  });
  if (doc.evaluation.variants.length < 2) warnings.push('Évaluation : un seul sujet — une nouvelle tentative reprendra le même sujet');

  return errors.length ? { ok: false, errors, warnings } : { ok: true, doc, warnings };
}

// ───────── Vues « élève » : jamais de corrigé ni de bonne réponse ─────────
export type PublicQuestion = Omit<Question, 'solution' | 'rubric' | 'answer' | 'tolerance'>;
export function publicQuestion(q: Question): PublicQuestion {
  const { solution: _s, rubric: _r, answer: _a, tolerance: _t, ...rest } = q;
  return rest;
}

export function evalQuestions(doc: CourseDocument, variant: number): Question[] {
  const v = doc.evaluation.variants[variant % doc.evaluation.variants.length];
  return v.sections.flatMap(s => s.questions);
}

// Correction automatique (qcm, numérique, réponse courte). null = correction humaine nécessaire.
export function autoCorrect(q: Question, answer: string | undefined): boolean | null {
  if (q.type === 'open') return null;
  const a = (answer ?? '').trim();
  if (!a) return false;
  if (q.type === 'qcm') {
    const expected = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(Number).sort().join(',');
    const given = a.split(',').map(Number).sort().join(',');
    return expected === given;
  }
  if (q.type === 'numeric') {
    // une réponse sans aucun chiffre est fausse ; une chaîne vide n'est pas « 0 »
    if (!/\d/.test(a)) return false;
    const v = parseNumericAnswer(a);
    // marge de 1e-9 : les décimaux binaires (7,071 − 7,07) ne doivent pas faire échouer une comparaison exacte
    return v !== null && Math.abs(v - Number(q.answer)) <= (q.tolerance ?? 0) + 1e-9;
  }
  return (q.answer as string[]).some(x => normShort(x) === normShort(a));
}

// Lecture stricte d'une réponse numérique d'élève : décimal français ou anglais (« 3,5 », « 3.5 », « ,5 »),
// signe moins typographique (− –) accepté, espaces et espaces fines ignorés, éventuellement signé,
// ou fraction a/b de décimaux (b ≠ 0) ; une unité ou % peut suivre (« 25 % », « 3,5 cm³ », « 12 € »).
// Refusé : hexadécimal (0x10), notation e (1e3), Infinity, tout autre texte. null = illisible.
const DEC = String.raw`(?:\d+(?:[.,]\d*)?|[.,]\d+)`;
const NUMERIC_RE = new RegExp(`^([+-]?)(${DEC})(?:/(${DEC}))?$`);
function parseNumericAnswer(raw: string): number | null {
  const t = raw.replace(/[−–]/g, '-').replace(/[\s\u00a0\u202f]/g, '');
  const read = (x: string): number | null => {
    const m = NUMERIC_RE.exec(x);
    if (!m) return null;
    const num = Number(m[2].replace(',', '.'));
    const den = m[3] === undefined ? 1 : Number(m[3].replace(',', '.'));
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return (m[1] === '-' ? -1 : 1) * num / den;
  };
  // unité ou % écrits après le nombre : on lit le nombre
  // un exposant seul n'est pas une unité (« 2² » n'est pas « 2 ») ; « cm² », « m.s-1 », « km/h » le sont
  return read(t) ?? read(t.replace(/[%a-zA-Zµ°€$/.][a-zA-Z²³/.·]*(?:-1)?$/, ''));
}

// Normalisation des réponses courtes : accents, majuscules et ponctuation ignorés,
// mais le signe moins, la barre de fraction et la virgule décimale comptent (« -1/3 » ≠ « 1/3 » ≠ « 1,3 »),
// ainsi que les signes + et − d'une expression et les exposants (« 5x+9 » ≠ « 5x−9 », « 3x² » ≠ « 3x »).
// Un trait d'union entre deux mots (« peut-être ») reste sans importance.
export function normShort(s: string) {
  return s.normalize('NFC').replace(/²/g, '^2').replace(/³/g, '^3')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[−–]/g, '-')
    .replace(/\s*\^\s*(\d+)/g, 'zzexp$1')                               // exposant : « 3² » ≠ « 32 », « x² » = « x^2 »
    .replace(/(\d)\s*([\/.,])\s*(?=\d)/g, (_m, d: string, op: string) => d + (op === '/' ? 'zzsur' : 'zzvirg'))
    .replace(/\s*\+\s*/g, ' p ')
    .replace(/(\d)\s+(?=[a-z](?:zzexp\d|[^a-z]|$))/g, '$1')                                // « 3 x » = « 3x »
    .replace(/(?<=[0-9)])\s*-\s*(?=[0-9a-z(])/g, ' m ')                  // moins d'une expression : 3-x, (x+1)-2, 5x-9
    .replace(/(?<=(?<![a-z])[a-z])\s*-\s*(?=[0-9(]|[a-z](?![a-z]))/g, ' m ')   // x-5, x-y (mais pas « c'est-à-dire »)
    .replace(/(^|[^a-z0-9])-\s*(?=\d)/g, '$1m')                           // nombre négatif : -5
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
