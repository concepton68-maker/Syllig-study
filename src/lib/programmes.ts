import 'server-only';
import { sql } from './db';
import { levelDef, LEVEL_CATALOG, subjectsFor } from './levels-catalog';

// Niveaux, matières, chapitres et cours gérés par l'administrateur (maquette validée le 28/11/2026).
// Désactiver : invisible pour les élèves (vue live_courses), rien n'est effacé. Supprimer : retiré partout ; si l'élément a déjà
// servi (un cours rédigé, ou un élève qui a commencé), il est seulement désactivé, pour garder les notes et le dossier scolaire.
// Les deux restent en base : le chargement des programmes ne les fait jamais revenir (migration 024).

export type Kind = 'level' | 'subject' | 'chapter' | 'course';
const LABEL: Record<Kind, [string, string]> = { level: ['niveau', 'niveaux'], subject: ['matière', 'matières'], chapter: ['chapitre', 'chapitres'], course: ['cours', 'cours'] };
export const kindLabel = (k: Kind, n: number) => LABEL[k][n > 1 ? 1 : 0];

/** Cours concernés par un élément (tous ses cours, actifs ou non). */
const coursesOf = (k: Kind, id: string) =>
  k === 'level' ? sql`select c.id from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id where s.level_code = ${id}`
  : k === 'subject' ? sql`select c.id from courses c join chapters ch on ch.id = c.chapter_id where ch.subject_id = ${Number(id)}`
  : k === 'chapter' ? sql`select c.id from courses c where c.chapter_id = ${Number(id)}`
  : sql`select ${Number(id)}::int as id`;

/** A déjà servi : un cours rédigé (une version), un élève qui a commencé un de ses cours, ou des élèves inscrits au niveau. */
export async function usage(k: Kind, id: string) {
  const [u] = await sql<{ versions: number; students: number; enrolled: number }[]>`
    select (select count(*)::int from course_versions where course_id in (${coursesOf(k, id)})) as versions,
      (select count(distinct student_id)::int from course_progress where course_id in (${coursesOf(k, id)})) as students,
      ${k === 'level' ? sql`(select count(*)::int from students where level_code = ${id})` : sql`0`} as enrolled`;
  return { ...u, used: u.versions > 0 || u.students > 0 || u.enrolled > 0 };
}

const table = (k: Kind) => sql(k === 'level' ? 'levels' : k === 'subject' ? 'subjects' : k === 'chapter' ? 'chapters' : 'courses');
const key = (k: Kind, id: string) => k === 'level' ? sql`code = ${id}` : sql`id = ${Number(id)}`;

export async function setActive(k: Kind, ids: string[], active: boolean) {
  if (k === 'course') return 0;   // un cours se retire, il ne se désactive pas
  let n = 0;
  for (const id of ids) n += (await sql`update ${table(k)} set active = ${active} where ${key(k, id)} and removed_at is null returning 1`).length;
  return n;
}

/** Supprime ce qui n'a jamais servi ; désactive le reste. Renvoie ce qui a été fait, élément par élément. */
export async function remove(k: Kind, ids: string[]) {
  const out: { name: string; done: 'supprimé' | 'désactivé' | 'retiré'; why?: string }[] = [];
  for (const id of ids) {
    const [row] = await sql<{ name: string }[]>`select ${k === 'course' ? sql`title` : sql`name`} as name from ${table(k)} where ${key(k, id)} and removed_at is null`;
    if (!row) continue;
    const u = await usage(k, id);
    if (k === 'course') {   // un cours qui a servi reste dans l'historique ; il n'est plus proposé
      await sql`update courses set removed_at = now() where id = ${Number(id)}`;
      out.push({ name: row.name, done: 'retiré', why: u.used ? 'déjà utilisé : l’historique des élèves est gardé' : undefined });
    } else if (u.used) {
      await sql`update ${table(k)} set active = false where ${key(k, id)}`;
      out.push({ name: row.name, done: 'désactivé', why: [u.versions ? `${u.versions} version${u.versions > 1 ? 's' : ''} de cours` : '', u.students ? `${u.students} élève${u.students > 1 ? 's' : ''} l’ont commencé` : '', u.enrolled ? `${u.enrolled} élève${u.enrolled > 1 ? 's' : ''} inscrit${u.enrolled > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ') });
    } else {
      await sql`update ${table(k)} set removed_at = now(), active = false where ${key(k, id)}`;
      out.push({ name: row.name, done: 'supprimé' });
    }
  }
  return out;
}

export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Ajoute un niveau choisi dans la liste des niveaux scolaires (LEVEL_CATALOG) ; un niveau supprimé est rétabli. */
export async function addLevel(code: string) {
  const def = levelDef(code);
  if (!def) throw new Error('Choisis un niveau dans la liste.');
  const [ex] = await sql<{ removed: boolean }[]>`select removed_at is not null as removed from levels where code = ${code}`;
  if (ex && !ex.removed) throw new Error(`Le niveau « ${def.name} » existe déjà.`);
  if (ex) { await sql`update levels set removed_at = null, active = true where code = ${code}`; return def; }
  await sql`insert into levels (code, name, cycle, position) values (${def.code}, ${def.name}, ${def.cycle}, ${def.position})`;
  return def;
}

export async function addSubject(level: string, name: string) {
  if (!subjectsFor(level).includes(name)) throw new Error('Choisis une matière dans la liste.');
  const [ex] = await sql<{ id: number; removed: boolean }[]>`select id, removed_at is not null as removed from subjects where level_code = ${level} and name = ${name}`;
  if (ex && !ex.removed) throw new Error('Cette matière existe déjà dans ce niveau.');
  if (ex) { await sql`update subjects set removed_at = null, active = true where id = ${ex.id}`; return ex.id; }
  const [s] = await sql<{ id: number }[]>`insert into subjects (level_code, name, position) values (${level}, ${name}, (select coalesce(max(position), 0) + 1 from subjects where level_code = ${level})) returning id`;
  return s.id;
}

export async function addChapter(subjectId: number, name: string) {
  const [ex] = await sql<{ id: number; removed: boolean }[]>`select id, removed_at is not null as removed from chapters where subject_id = ${subjectId} and name = ${name}`;
  if (ex && !ex.removed) throw new Error('Ce chapitre existe déjà dans cette matière.');
  if (ex) { await sql`update chapters set removed_at = null, active = true where id = ${ex.id}`; return ex.id; }
  const [c] = await sql<{ id: number }[]>`insert into chapters (subject_id, name, position) values (${subjectId}, ${name}, (select coalesce(max(position), 0) + 1 from chapters where subject_id = ${subjectId})) returning id`;
  return c.id;
}

export async function addCourse(chapterId: number, title: string) {
  const [ex] = await sql<{ id: number; removed: boolean }[]>`select id, removed_at is not null as removed from courses where chapter_id = ${chapterId} and title = ${title}`;
  if (ex && !ex.removed) throw new Error('Ce cours existe déjà dans ce chapitre.');
  if (ex) { await sql`update courses set removed_at = null where id = ${ex.id}`; return ex.id; }
  const [c] = await sql<{ id: number }[]>`insert into courses (chapter_id, title, priority, position) values (${chapterId}, ${title}, 'ensuite', (select coalesce(max(position), 0) + 1 from courses)) returning id`;
  return c.id;
}

export async function rename(k: Kind, id: string, name: string) {
  if (k === 'level') return (await sql`update levels set name = ${name}, renamed = true where code = ${id} returning 1`).length;
  if (k === 'course') return (await sql`update courses set title = ${name} where id = ${Number(id)} returning 1`).length;
  if (k === 'subject') {   // une matière se renomme en une autre matière de la liste de son niveau
    const [s] = await sql<{ level_code: string }[]>`select level_code from subjects where id = ${Number(id)}`;
    if (!s || !subjectsFor(s.level_code).includes(name)) throw new Error('Choisis une matière dans la liste.');
    const [dup] = await sql`select 1 from subjects where level_code = ${s.level_code} and name = ${name} and id <> ${Number(id)}`;
    if (dup) throw new Error(`La matière « ${name} » existe déjà dans ce niveau.`);
  }
  return (await sql`update ${table(k)} set name = ${name} where id = ${Number(id)} returning 1`).length;
}

// ——— Import d'un programme (même format que content/<niveau>/programme.json) ———
type Prog = { level: { code: string; name: string; cycle?: string | null }; subjects: { name: string; official_sources?: unknown[]; chapters: { name: string; courses: { title: string; code?: string; priority?: string; official_note?: string }[] }[] }[]; general_sources?: unknown[] };

/** Ajoute ce qui manque, sans toucher à ce qui existe (noms, états, cours rédigés). */
export async function importProgramme(raw: string) {
  let p: Prog;
  try { p = JSON.parse(raw); } catch (e) { throw new Error(`Le fichier n’est pas un JSON valide : ${(e as Error).message}`); }
  if (!p?.level?.code || !p.level.name || !Array.isArray(p.subjects)) throw new Error('Format attendu : { level: { code, name }, subjects: [{ name, chapters: [{ name, courses: [{ title }] }] }] }');
  const def = levelDef(slug(p.level.code));
  if (!def) throw new Error(`Le niveau du fichier (« ${p.level.code} ») n’est pas dans la liste des niveaux scolaires. Codes possibles : ${LEVEL_CATALOG.map(l => l.code).join(', ')}.`);
  const code = def.code;
  const unknown = p.subjects.map(s => s?.name).filter(n => n && !subjectsFor(code).includes(n));
  if (unknown.length) throw new Error(`Matières hors de la liste de ${def.name} : ${unknown.join(', ')}. Matières possibles : ${subjectsFor(code).join(', ')}.`);
  let added = { subjects: 0, chapters: 0, courses: 0 };
  await sql.begin(async tx => {
    await tx`insert into levels (code, name, cycle, general_sources, position) values (${code}, ${def.name}, ${def.cycle}, ${tx.json((p.general_sources ?? []) as never)}, ${def.position})
      on conflict (code) do update set removed_at = null where levels.removed_at is not null`;
    for (const s of p.subjects) {
      if (!s?.name) continue;
      let [subj] = await tx<{ id: number }[]>`select id from subjects where level_code = ${code} and coalesce(source_name, name) = ${s.name} limit 1`;
      if (!subj) { [subj] = await tx<{ id: number }[]>`insert into subjects (level_code, name, source_name, position, official_sources) values (${code}, ${s.name}, ${s.name}, (select coalesce(max(position), 0) + 1 from subjects where level_code = ${code}), ${tx.json((s.official_sources ?? []) as never)})
        on conflict (level_code, name) do update set source_name = excluded.source_name returning id`; added.subjects++; }
      for (const ch of s.chapters ?? []) {
        if (!ch?.name) continue;
        let [chap] = await tx<{ id: number }[]>`select id from chapters where subject_id = ${subj.id} and coalesce(source_name, name) = ${ch.name} limit 1`;
        if (!chap) { [chap] = await tx<{ id: number }[]>`insert into chapters (subject_id, name, source_name, position) values (${subj.id}, ${ch.name}, ${ch.name}, (select coalesce(max(position), 0) + 1 from chapters where subject_id = ${subj.id}))
          on conflict (subject_id, name) do update set source_name = excluded.source_name returning id`; added.chapters++; }
        for (const c of ch.courses ?? []) {
          if (!c?.title) continue;
          const [co] = await tx`select 1 from courses where chapter_id = ${chap.id} and coalesce(source_title, title) = ${c.title}`;
          if (co) continue;
          const pr = ['prioritaire', 'ensuite', 'mis_de_cote'].includes(c.priority ?? '') ? c.priority! : 'ensuite';
          await tx`insert into courses (chapter_id, title, source_title, priority, position, official_note) values (${chap.id}, ${c.title}, ${c.title}, ${pr}, (select coalesce(max(position), 0) + 1 from courses), ${c.official_note ?? null})
            on conflict (chapter_id, title) do nothing`;
          added.courses++;
        }
      }
    }
  });
  return { code, name: def.name, ...added };
}
