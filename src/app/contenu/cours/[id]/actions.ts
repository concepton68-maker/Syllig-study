'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { publishVersion } from '@/lib/import-course';

export async function publishAction(form: FormData) {
  await requireUser('admin');
  const id = String(form.get('version'));
  const course = String(form.get('course'));
  await publishVersion(id);
  revalidatePath(`/contenu/cours/${course}`);
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
