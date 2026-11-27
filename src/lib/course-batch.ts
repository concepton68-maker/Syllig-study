import 'server-only';
import { sql } from './db';
import { importCourse, publishVersion } from './import-course';

// Relecture groupée par Claude (demande du propriétaire, 27/11/2026) : un seul fichier avec la consigne et les cours choisis,
// Claude le renvoie corrigé, on le réimporte. Tout ou rien : si un cours est refusé, aucun n'est enregistré.
// Chaque cours modifié devient une nouvelle version (brouillon « À relire », ou publiée aussitôt si demandé) ; l'ancienne reste
// dans l'historique. Un cours renvoyé à l'identique est ignoré. Aucune donnée d'élève dans le fichier.

export const BATCH_FORMAT = 'syllig-cours-lot/1';

export const BATCH_INSTRUCTIONS = `Tu es relecteur et inspecteur pédagogique (collège et lycée, France). Ce fichier contient plusieurs cours de la plateforme Syllig Study (format syllig-course/1 : leçon en parties avec points de contrôle, exercices avec corrigés, évaluation avec sujets, corrigés et barèmes).

Pour chaque cours de « cours », vérifie et corrige :
1. les erreurs de fond : règle fausse, définition inexacte, exemple qui contredit la règle, calcul faux, fait erroné ;
2. les corrigés : réponse attendue fausse, « answer » d'un QCM qui ne désigne pas la bonne option, barème incohérent avec les points ;
3. l'adéquation au niveau et au programme officiel, la clarté pour un élève.

Règles :
- Renvoie UNIQUEMENT ce même fichier JSON complet, corrigé, sans texte avant ou après, sans balises de code.
- Garde le champ « format », et pour chaque cours exactement la même structure, le même code, le même niveau, la même matière, le même chapitre et le même titre.
- Ne modifie que ce qui est nécessaire. Un cours sans erreur est renvoyé tel quel.
- Si le fichier est trop long pour toi, traite les cours un par un et renvoie à la fin le fichier complet.
- Après le JSON, rien.`;

type Row = { id: number; code: string | null; title: string; version: number; status: string; document: Record<string, unknown> };

/** Dernière version de chaque cours (brouillon s'il est plus récent que la version publiée). */
async function latest(ids: number[] | null) {
  return sql<Row[]>`
    select distinct on (c.id) c.id, c.code, c.title, v.version, v.status, v.document
    from courses c join course_versions v on v.course_id = c.id and v.status in ('draft', 'published')
    where ${ids ? sql`c.id = any(${ids})` : sql`true`}
    order by c.id, v.version desc`;
}

export async function exportBatch(ids: number[] | null) {
  const rows = await latest(ids);
  return {
    format: BATCH_FORMAT,
    exported_at: new Date().toISOString(),
    consigne: BATCH_INSTRUCTIONS,
    cours: rows.sort((a, b) => String(a.code).localeCompare(String(b.code))).map(r => r.document),
  };
}

export const isBatch = (raw: string) => { try { return (JSON.parse(raw) as { format?: string })?.format === BATCH_FORMAT; } catch { return false; } };

// comparaison indépendante de l'ordre des clés
const canon = (x: unknown): unknown => Array.isArray(x) ? x.map(canon)
  : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x as object).sort().map(k => [k, canon((x as Record<string, unknown>)[k])])) : x;
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export type BatchResult = { ok: true; imported: { code: string; version: number; courseId: number }[]; unchanged: string[]; published: number; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export async function importBatch(raw: string, sourceName: string, userId: string, publish: boolean): Promise<BatchResult> {
  let json: { format?: string; cours?: unknown };
  try { json = JSON.parse(raw); } catch (e) { return { ok: false, warnings: [], errors: [`Le fichier n'est pas un JSON valide : ${(e as Error).message}`] }; }
  if (json.format !== BATCH_FORMAT || !Array.isArray(json.cours) || !json.cours.length) return { ok: false, warnings: [], errors: ['Ce fichier n’est pas un lot de cours (format syllig-cours-lot/1) ou il ne contient aucun cours.'] };
  const docs = json.cours as Record<string, unknown>[];
  const codes = docs.map(d => String(d?.code ?? ''));
  const dup = codes.filter((c, i) => c && codes.indexOf(c) !== i);
  if (dup.length) return { ok: false, warnings: [], errors: [`Cours en double dans le fichier : ${[...new Set(dup)].join(', ')}`] };

  // cours actuels (par code) pour ignorer ceux renvoyés à l'identique
  const current = new Map((await sql<{ code: string; document: unknown }[]>`
    select distinct on (c.id) c.code, v.document from courses c join course_versions v on v.course_id = c.id and v.status in ('draft', 'published')
    where c.code = any(${codes.filter(Boolean)}) order by c.id, v.version desc`).map(r => [r.code, r.document]));

  const errors: string[] = [], warnings: string[] = [], unchanged: string[] = [];
  const imported: { code: string; version: number; courseId: number; versionId: string }[] = [];
  class Rollback extends Error {}
  try {
    await sql.begin(async tx => {
      for (const [i, d] of docs.entries()) {
        const label = codes[i] || `cours n° ${i + 1}`;
        if (codes[i] && current.has(codes[i]) && same(current.get(codes[i]), d)) { unchanged.push(codes[i]); continue; }
        const r = await importCourse(JSON.stringify(d), `${sourceName} · ${label}`, userId, tx);
        if (r.ok) imported.push({ code: label, version: r.version, courseId: r.courseId, versionId: r.versionId });
        else errors.push(...r.errors.map(e => `${label} — ${e}`));
        warnings.push(...r.warnings.map(w => `${label} — ${w}`));
      }
      if (errors.length) throw new Rollback();
    });
  } catch (e) {
    if (e instanceof Rollback) return { ok: false, errors, warnings };
    throw e;
  }
  let published = 0;
  if (publish) for (const x of imported) { await publishVersion(x.versionId); published++; }
  return { ok: true, imported: imported.map(({ versionId: _, ...x }) => x), unchanged, published, warnings };
}
