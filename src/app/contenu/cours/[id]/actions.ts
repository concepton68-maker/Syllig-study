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
