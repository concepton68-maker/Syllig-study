import 'server-only';
import { sql } from './db';
import { validateCourse, type CourseDocument } from './course-format';

export type ImportResult =
  | { ok: true; courseId: number; versionId: string; version: number; created: boolean; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

// Rattache le document au catalogue, puis l'enregistre comme nouveau brouillon.
export async function importCourse(raw: string, sourceName: string, userId: string): Promise<ImportResult> {
  let json: unknown;
  try { json = JSON.parse(raw); } catch (e) {
    return { ok: false, warnings: [], errors: [`Le fichier n'est pas un JSON valide : ${(e as Error).message}`] };
  }
  const v = validateCourse(json);
  if (!v.ok) return v;
  const doc: CourseDocument = v.doc;

  const [chap] = await sql<{ id: number }[]>`
    select ch.id from chapters ch join subjects s on s.id = ch.subject_id
    where s.level_code = ${doc.level} and s.name = ${doc.subject} and ch.name = ${doc.chapter}`;
  if (!chap) return { ok: false, warnings: v.warnings, errors: [`Chapitre introuvable dans le catalogue : ${doc.level} › ${doc.subject} › ${doc.chapter}`] };

  return sql.begin(async tx => {
    let created = false;
    let [course] = await tx<{ id: number; chapter_id: number; title: string }[]>`select id, chapter_id, title from courses where code = ${doc.code}`;
    if (course && (course.chapter_id !== chap.id || course.title !== doc.title)) {
      return { ok: false as const, warnings: v.warnings, errors: [`Le code ${doc.code} est déjà utilisé par « ${course.title} » : changer le code ou le titre.`] };
    }
    if (!course) {
      [course] = await tx<{ id: number; chapter_id: number; title: string }[]>`select id, chapter_id, title from courses where chapter_id = ${chap.id} and title = ${doc.title}`;
      if (course) await tx`update courses set code = ${doc.code} where id = ${course.id}`;
    }
    if (!course) {
      [course] = await tx<{ id: number; chapter_id: number; title: string }[]>`
        insert into courses (chapter_id, code, title, priority, position)
        values (${chap.id}, ${doc.code}, ${doc.title}, 'ensuite', (select coalesce(max(position), 0) + 1 from courses))
        returning id, chapter_id, title`;
      created = true;
    }
    const [{ next }] = await tx<{ next: number }[]>`select coalesce(max(version), 0) + 1 as next from course_versions where course_id = ${course.id}`;
    const [ver] = await tx<{ id: string }[]>`
      insert into course_versions (course_id, version, status, document, source_name, imported_by)
      values (${course.id}, ${next}, 'draft', ${tx.json(doc as never)}, ${sourceName}, ${userId}) returning id`;
    return { ok: true as const, courseId: course.id, versionId: ver.id, version: next, created, warnings: v.warnings };
  });
}

export async function publishVersion(versionId: string) {
  const courseId = await sql.begin(async tx => {
    const [v] = await tx<{ course_id: number }[]>`select course_id from course_versions where id = ${versionId} and status = 'draft' for update`;
    if (!v) throw new Error('Version introuvable ou déjà publiée');
    await tx`update course_versions set status = 'archived' where course_id = ${v.course_id} and status = 'published'`;
    await tx`update course_versions set status = 'published', published_at = now() where id = ${versionId}`;
    return v.course_id;
  });
  // leçon de rattrapage : elle passe en tête du parcours des élèves pour qui le bilan l'a proposée
  await (await import('./automation')).assignRemedial(courseId).catch(() => 0);
}
