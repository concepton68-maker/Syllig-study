'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { sql } from '@/lib/db';
import { verifyLogin, createSession } from '@/lib/auth';

// Limitation des essais, en base : 10 échecs par identifiant ou 30 par adresse sur 15 minutes.
// L'essai est enregistré AVANT la vérification, pour que des requêtes simultanées soient toutes comptées.
const WINDOW = sql`now() - interval '15 minutes'`;

export async function loginAction(_: { error?: string } | undefined, form: FormData) {
  const login = String(form.get('login') ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(form.get('password') ?? '');
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const [{ byLogin, byIp }] = await sql<{ byLogin: number; byIp: number }[]>`
    select (select count(*)::int from login_attempts where login = ${login} and at > ${WINDOW}) as "byLogin",
           (select count(*)::int from login_attempts where ip = ${ip} and at > ${WINDOW}) as "byIp"`;
  if (byLogin >= 10 || byIp >= 30) return { error: 'Trop d’essais. Réessaie dans un quart d’heure.' };
  await sql`insert into login_attempts (login, ip) values (${login}, ${ip})`;
  const user = await verifyLogin(login, password);
  if (!user) return { error: 'Identifiant ou mot de passe incorrect.' };
  await sql`delete from login_attempts where login = ${login} or at < now() - interval '1 day'`;
  await createSession(user.id);
  redirect('/');
}
