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
  // exemple de référence : un cours du même niveau (de préférence de la même matière), sinon C001 (Seconde)
  const ex = pickExample(c.level_code, c.subject);
  const example = ex.text;
  const sourcesChecked = programmeCheckedDate(c.level_code);

  return {
    code, isNewVersion: c.published, level: { code: c.level_code, name: c.level_name }, subject: c.subject, chapter: c.chapter, title: c.title,
    priority: c.priority, officialNote: c.official_note, sources: [...(c.sources ?? []), ...(c.general ?? [])].slice(0, 6), sourcesChecked,
    siblings: siblings.map(s => ({ title: s.title, code: s.code, hasContent: s.has_content })),
    knownSkills: skillRows, skillPrefix: SKILL_PREFIX[c.subject] ?? 'cours', example, exampleCode: ex.code,
  };
}

const CONTENT = () => path.join(process.cwd(), 'content');

export function pickExample(levelCode: string, subject: string): { code: string; text: string } {
  const dir = path.join(CONTENT(), levelCode, 'cours');
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    const docs = files.map(f => ({ f, text: fs.readFileSync(path.join(dir, f), 'utf8').trim() }))
      .map(d => { try { return { ...d, doc: JSON.parse(d.text) as { subject?: string; code?: string } }; } catch { return null; } })
      .filter((d): d is NonNullable<typeof d> => !!d);
    const best = docs.find(d => d.doc.subject === subject) ?? docs[0];
    if (best) return { code: best.doc.code ?? best.f.replace('.json', ''), text: best.text };
  }
  return { code: 'C001', text: fs.readFileSync(path.join(CONTENT(), 'seconde-generale/cours/C001.json'), 'utf8').trim() };
}

function programmeCheckedDate(levelCode: string): string | null {
  try {
    const prog = JSON.parse(fs.readFileSync(path.join(CONTENT(), levelCode, 'programme.json'), 'utf8')) as { sources_checked?: string };
    const m = prog.sources_checked?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : prog.sources_checked ?? null;
  } catch { return null; }
}
