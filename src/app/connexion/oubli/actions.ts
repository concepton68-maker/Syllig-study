'use server';
import { headers } from 'next/headers';
import { sql } from '@/lib/db';

// Demande « mot de passe oublié ». Réponse identique que le compte existe ou non (on ne révèle pas les identifiants).
export async function requestReset(_: { done?: boolean; error?: string } | undefined, form: FormData) {
  const login = String(form.get('login') ?? '').trim().toLowerCase().slice(0, 200);
  if (!login) return { error: 'Indique ton identifiant ou ton e-mail.' };
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from login_attempts where ip = ${ip} and login like 'oubli:%' and at > now() - interval '1 hour'`;
  if (n >= 10) return { error: 'Trop de demandes. Réessaie dans une heure.' };
  await sql`insert into login_attempts (login, ip) values (${'oubli:' + login}, ${ip})`;
  const [u] = await sql<{ id: string }[]>`select id from users where login = ${login}`;
  if (u) await sql`insert into password_requests (user_id) values (${u.id}) on conflict (user_id) where done_at is null do nothing`;
  return { done: true };
}
