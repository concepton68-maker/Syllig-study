'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { publishVersion } from '@/lib/import-course';

export async function publishAction(form: FormData) {
  await requireUser('admin');
  const id = String(form.get('version'));
  const course = String(form.get('course'));
  await publishVersion(id);
  revalidatePath('/contenu', 'layout');
  revalidatePath('/eleve', 'layout');
  redirect(`/contenu/cours/${encodeURIComponent(course)}?v=${id}&publie=1`);
}

// Écarter un brouillon raté (il est archivé, jamais visible des élèves)
export async function discardAction(form: FormData) {
  await requireUser('admin');
  const id = String(form.get('version'));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await sql`update course_versions set status = 'archived' where id = ${id} and status = 'draft'`;
  revalidatePath('/contenu', 'layout');
  redirect('/contenu/a-relire?ecarte=1');
}

export async function discardBulkAction(form: FormData) {
  await requireUser('admin');
  const ids = form.getAll('ids').map(String).filter(x => /^[0-9a-f-]{36}$/i.test(x));
  if (ids.length) await sql`update course_versions set status = 'archived' where id in ${sql(ids)} and status = 'draft'`;
  revalidatePath('/contenu', 'layout');
  redirect(`/contenu/a-relire?ecarte=${ids.length}`);
}

// Publier plusieurs brouillons d'un coup (ids = identifiants de versions)
export async function publishBulkAction(form: FormData) {
  await requireUser('admin');
  for (const id of form.getAll('ids')) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) continue;
    try { await publishVersion(id); } catch { /* déjà publiée entre-temps : on passe */ }
  }
  revalidatePath('/contenu', 'layout');
  revalidatePath('/eleve', 'layout');
}

// Rédaction par l'IA (en arrière-plan) : un cours, ou une sélection du catalogue (ids = identifiants de cours)
export async function draftWithAiAction(courseId: number) {
  const u = await requireUser('admin');
  const { draftCourse } = await import('@/lib/automation');
  await draftCourse(courseId, u.id);
  revalidatePath('/contenu', 'layout');
}
export async function draftWithAiBulkAction(form: FormData) {
  const u = await requireUser('admin');
  const { draftCourse } = await import('@/lib/automation');
  for (const id of form.getAll('ids').map(Number).filter(Number.isInteger)) await draftCourse(id, u.id);
  revalidatePath('/contenu', 'layout');
}
// Publier les brouillons des cours sélectionnés dans le catalogue (ids = identifiants de cours)
export async function publishCoursesDraftsAction(form: FormData) {
  await requireUser('admin');
  const ids = form.getAll('ids').map(Number).filter(Number.isInteger);
  if (ids.length) for (const v of await sql<{ id: string }[]>`
    select distinct on (course_id) id from course_versions where course_id in ${sql(ids)} and status = 'draft'
      and version > coalesce((select max(version) from course_versions p where p.course_id = course_versions.course_id and p.status = 'published'), 0)
    order by course_id, version desc`) {
    try { await publishVersion(v.id); } catch { /* déjà publiée */ }
  }
  revalidatePath('/contenu', 'layout'); revalidatePath('/eleve', 'layout');
}

// Relecture par l'IA d'un cours existant, puis correction en nouvelle version (brouillon)
export async function reviewAction(courseId: number) {
  await requireUser('admin');
  const { requestReview } = await import('@/lib/course-review');
  await requestReview(courseId);
  revalidatePath('/contenu', 'layout');
}
export async function reviewBulkAction(form: FormData) {
  await requireUser('admin');
  const { requestReview } = await import('@/lib/course-review');
  for (const id of form.getAll('ids').map(Number).filter(Number.isInteger)) await requestReview(id);
  revalidatePath('/contenu', 'layout');
}
export async function fixAction(reviewId: string) {
  const u = await requireUser('admin');
  const { requestFix } = await import('@/lib/course-review');
  await requestFix(reviewId, u.id);
  revalidatePath('/contenu', 'layout');
}
