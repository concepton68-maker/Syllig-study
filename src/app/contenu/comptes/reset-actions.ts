'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { createResetLink } from '@/lib/password';

export async function makeResetLink(_: { link?: string; name?: string; error?: string } | undefined, form: FormData) {
  const me = await requireUser('admin');
  const login = String(form.get('login') ?? '').trim().toLowerCase();
  const [u] = await sql<{ id: string; role: string; display_name: string }[]>`select id, role, display_name from users where login = ${login}`;
  if (!u) return { error: `Aucun compte avec l’e-mail ${login}.` };
  if (u.role === 'student') return { error: 'Pour un compte élève, c’est le parent qui change le mot de passe (Famille › Enfants).' };
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const link = await createResetLink(u.id, me.id, origin);
  return { link, name: u.display_name };
}

// Demandes réglées autrement : on les retire de la liste, en groupe
export async function dismissAdultRequests(form: FormData) {
  await requireUser('admin');
  const ids = form.getAll('ids').map(String).filter(x => /^\d+$/.test(x));
  if (ids.length) await sql`update password_requests set done_at = now() where id in ${sql(ids)} and done_at is null`;
  revalidatePath('/contenu/comptes');
}
