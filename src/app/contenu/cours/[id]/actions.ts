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
