import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { sql } from './db';
import { SKILL_PREFIX, type PromptContext, type OfficialSource } from './prompt-builder';

export async function promptContext(courseId: number): Promise<PromptContext | null> {
  const [c] = await sql<{ id: number; code: string | null; title: string; priority: string; official_note: string | null; chapter_id: number;
    chapter: string; subject_id: number; subject: string; sources: OfficialSource[]; level_code: string; level_name: string; general: OfficialSource[]; published: boolean }[]>`
    select c.id, c.code, c.title, c.priority, c.official_note, c.chapter_id, ch.name as chapter, s.id as subject_id, s.name as subject,
      s.official_sources as sources, l.code as level_code, l.name as level_name, l.general_sources as general,
      exists (select 1 from course_versions v where v.course_id = c.id and v.status = 'published') as published
    from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    where c.id = ${courseId}`;
  if (!c) return null;

  // code : celui du cours, sinon le prochain libre (C001, C002…)
  let code = c.code;
  if (!code) {
    const [{ n }] = await sql<{ n: number }[]>`select coalesce(max(substring(code from '^C(\\d+)$')::int), 0) + 1 as n from courses where code ~ '^C\\d+$'`;
    code = 'C' + String(n).padStart(3, '0');
  }
  const siblings = await sql<{ title: string; code: string | null; has_content: boolean }[]>`
    select c.title, c.code, exists (select 1 from course_versions v where v.course_id = c.id and v.status = 'published') as has_content
    from courses c where c.chapter_id = ${c.chapter_id} order by c.position`;
  // compétences déjà déclarées dans les cours publiés de la même matière
  const skillRows = await sql<{ id: string; label: string }[]>`
    select distinct on (sk->>'id') sk->>'id' as id, sk->>'label' as label
    from course_versions v join courses c on c.id = v.course_id join chapters ch on ch.id = c.chapter_id,
      jsonb_array_elements(v.document->'skills') sk
    where ch.subject_id = ${c.subject_id} and v.status = 'published' order by sk->>'id'`;
  // exemple de référence : le fichier C001 d'origine (champs dans l'ordre lisible)
  const example = fs.readFileSync(path.join(process.cwd(), 'content/seconde-generale/cours/C001.json'), 'utf8').trim();

  return {
    code, isNewVersion: c.published, level: { code: c.level_code, name: c.level_name }, subject: c.subject, chapter: c.chapter, title: c.title,
    priority: c.priority, officialNote: c.official_note, sources: [...(c.sources ?? []), ...(c.general ?? [])].slice(0, 6), sourcesChecked: '21/11/2026',
    siblings: siblings.map(s => ({ title: s.title, code: s.code, hasContent: s.has_content })),
    knownSkills: skillRows, skillPrefix: SKILL_PREFIX[c.subject] ?? 'cours', example, exampleCode: 'C001',
  };
}
