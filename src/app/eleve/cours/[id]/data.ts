import 'server-only';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStudent } from '@/lib/access';
import { publishedVersion, getProgress } from '@/lib/progress';

// Chargement commun aux pages d'un cours : élève connecté + cours de son niveau + version publiée.
export async function loadCourse(idParam: string) {
  const { user, student } = await requireStudent();
  const courseId = Number(idParam);
  if (!Number.isInteger(courseId)) notFound();
  const [course] = await sql<{ id: number; title: string; code: string | null; subject: string; chapter: string; priority: string }[]>`
    select c.id, c.title, c.code, s.name as subject, ch.name as chapter, c.priority from courses c
    join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
    where c.id = ${courseId} and s.level_code = ${student.level_code}`;
  if (!course) notFound();
  const version = await publishedVersion(courseId);
  if (!version) notFound();
  const progress = await getProgress(student.id, courseId);
  return { user, student, course, version, doc: version.document, progress };
}
