'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { verifyLogin, createSession } from '@/lib/auth';

// Limitation simple des essais (par IP, en mémoire) contre le devinage de mot de passe
const attempts = new Map<string, { n: number; until: number }>();

export async function loginAction(_: { error?: string } | undefined, form: FormData) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const a = attempts.get(ip);
  if (a && a.n >= 8 && a.until > Date.now()) return { error: 'Trop d’essais. Réessaie dans quelques minutes.' };
  const user = await verifyLogin(String(form.get('login') ?? ''), String(form.get('password') ?? ''));
  if (!user) {
    const cur = a && a.until > Date.now() ? a : { n: 0, until: Date.now() + 10 * 60_000 };
    attempts.set(ip, { n: cur.n + 1, until: cur.until });
    return { error: 'Identifiant ou mot de passe incorrect.' };
  }
  attempts.delete(ip);
  await createSession(user.id);
  redirect('/');
}
