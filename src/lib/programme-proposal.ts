import 'server-only';
import { z } from 'zod/v4';
import { sql } from './db';
import { aiConfigFor, askJson, logAiRequest } from './ai';
import { levelDef, subjectsFor } from './levels-catalog';
import { importProgramme } from './programmes';

// Programme d'un niveau sans programme chargé (maquette validée le 28/11/2026) : proposé par l'IA (tâche « programme »,
// aucune donnée d'élève) ou par Claude (consigne téléchargée, réponse importée), puis vérifié et coché par l'administrateur.
// Les matières sont toujours prises dans la liste officielle du niveau (SUBJECT_CATALOG) ; le reste est ignoré et signalé.

export const Proposal = z.object({
  subjects: z.array(z.object({
    name: z.string().min(1),
    chapters: z.array(z.object({
      name: z.string().min(1),
      courses: z.array(z.object({ title: z.string().min(1), priority: z.enum(['prioritaire', 'ensuite']).optional() })).min(1),
    })).min(1),
  })).min(1),
});
export type Proposal = z.infer<typeof Proposal>;

export function programmeInstructions(level: string) {
  const def = levelDef(level)!;
  const subjects = subjectsFor(level);
  return `Tu es inspecteur pédagogique de l'Éducation nationale (France). Propose le programme officiel en vigueur de ${def.name} (${def.cycle}), tel que le fixe le Bulletin officiel, pour une plateforme d'entraînement à la maison.

Matières possibles (garde exactement ces noms, n'en ajoute pas d'autre ; retiens celles qui ont un programme écrit à ce niveau) :
${subjects.map(s => `- ${s}`).join('\n')}

Pour chaque matière retenue :
- les chapitres = les thèmes ou parties du programme officiel, dans l'ordre habituel de l'année ;
- pour chaque chapitre, 2 à 6 cours = les notions à apprendre, avec un titre court et clair (« Les fractions égales », pas « Partie 1 ») ;
- « priority » = "prioritaire" pour les notions essentielles du programme, sinon "ensuite".
Reste fidèle au programme officiel : n'invente ni thème ni notion. Pas d'EPS ni d'enseignement purement pratique sans contenu à apprendre.

Réponds UNIQUEMENT par un JSON de la forme :
{ "subjects": [ { "name": "…", "chapters": [ { "name": "…", "courses": [ { "title": "…", "priority": "prioritaire" } ] } ] } ] }`;
}

/** Garde ce qui est conforme (matières de la liste du niveau, sans doublon) et dit ce qui a été écarté. */
export function cleanProposal(level: string, p: Proposal) {
  const allowed = subjectsFor(level);
  const ignored: string[] = [];
  const seen = new Set<string>();
  const subjects = p.subjects.filter(s => {
    if (!allowed.includes(s.name)) { ignored.push(s.name); return false; }
    if (seen.has(s.name)) return false;
    seen.add(s.name); return true;
  });
  return { data: { subjects }, ignored };
}

export async function proposeWithAi(level: string) {
  if (!levelDef(level)) throw new Error('Niveau inconnu.');
  const conf = await aiConfigFor('programme');
  if ('error' in conf) throw new Error(conf.error);
  let p: Proposal;
  try { p = await askJson(conf.cfg, Proposal, programmeInstructions(level), `Programme de ${levelDef(level)!.name}.`, 'high'); }
  catch (e) { await logAiRequest(null, 'programme', conf.cfg, `Programme ${level}`, (e as Error).message.slice(0, 300)); throw new Error('L’IA n’a pas pu proposer de programme : ' + (e as Error).message.slice(0, 160)); }
  await logAiRequest(null, 'programme', conf.cfg, `Programme ${level}`);
  return save(level, 'ia', p);
}

/** Réponse de Claude collée ou déposée (balises de code tolérées). */
export async function proposeFromText(level: string, raw: string) {
  if (!levelDef(level)) throw new Error('Niveau inconnu.');
  let json: unknown;
  try { json = JSON.parse(raw.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '')); } catch { throw new Error('La réponse n’est pas un JSON valide : vérifie que Claude a bien renvoyé uniquement le programme.'); }
  const r = Proposal.safeParse(json);
  if (!r.success) throw new Error('La réponse n’a pas la forme attendue { "subjects": [ { "name", "chapters": [ { "name", "courses": [ { "title" } ] } ] } ] }.');
  return save(level, 'claude', r.data);
}

async function save(level: string, source: 'ia' | 'claude', p: Proposal) {
  const { data, ignored } = cleanProposal(level, p);
  if (!data.subjects.length) throw new Error(`Aucune matière de la liste de ${levelDef(level)!.name} dans la proposition${ignored.length ? ` (écartées : ${ignored.join(', ')})` : ''}.`);
  const [r] = await sql<{ id: string }[]>`insert into programme_proposals (level_code, source, data) values (${level}, ${source}, ${sql.json({ ...data, ignored } as never)}) returning id`;
  return r.id;
}

export async function getProposal(id: string) {
  const [r] = await sql<{ id: string; level_code: string; source: string; data: Proposal & { ignored?: string[] }; created_at: Date; applied_at: Date | null }[]>`
    select id, level_code, source, data, created_at, applied_at from programme_proposals where id = ${id}`;
  return r ?? null;
}

/** Ajoute ce qui est coché (clés « s », « s|c », « s|c|t »), avec l'import habituel : rien d'existant ne change. */
export async function applyProposal(id: string, keys: string[]) {
  const pr = await getProposal(id);
  if (!pr) throw new Error('Proposition introuvable.');
  if (pr.applied_at) throw new Error('Cette proposition a déjà été ajoutée.');
  const k = new Set(keys);
  const subjects = pr.data.subjects.filter(s => k.has(s.name)).map(s => ({
    name: s.name,
    chapters: s.chapters.filter(c => k.has(`${s.name}|${c.name}`)).map(c => ({
      name: c.name, courses: c.courses.filter(x => k.has(`${s.name}|${c.name}|${x.title}`)).map(x => ({ title: x.title, priority: x.priority ?? 'ensuite' })),
    })).filter(c => c.courses.length),
  })).filter(s => s.chapters.length);
  if (!subjects.length) throw new Error('Coche au moins un cours.');
  const def = levelDef(pr.level_code)!;
  const r = await importProgramme(JSON.stringify({ level: { code: def.code, name: def.name }, subjects }));
  await sql`update programme_proposals set applied_at = now() where id = ${id}`;
  return r;
}
