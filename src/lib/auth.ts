import 'server-only';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from './db';

export type Role = 'parent' | 'student' | 'admin';
export type User = { id: string; login: string; display_name: string; role: Role; roles: Role[] };

const COOKIE = 'ss_session';
const DAYS = 30;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function verifyLogin(login: string, password: string): Promise<User | null> {
  const [u] = await sql<(User & { password_hash: string })[]>`
    select id, login, display_name, role, password_hash from users where login = ${login.trim().toLowerCase()}`;
  // compare toujours un hash pour ne pas révéler par le temps de réponse si l'identifiant existe
  const ok = await bcrypt.compare(password, u?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
  if (!u || !ok) return null;
  return { id: u.id, login: u.login, display_name: u.display_name, role: u.role, roles: [u.role] };
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + DAYS * 864e5);
  await sql`insert into auth_sessions (token_hash, user_id, expires_at) values (${sha(token)}, ${userId}, ${expires})`;
  await sql`update users set last_login_at = now() where id = ${userId}`;
  await sql`delete from auth_sessions where expires_at < now()`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from auth_sessions where token_hash = ${sha(token)}`;
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [u] = await sql<User[]>`
    select u.id, u.login, u.display_name, u.role,
      coalesce((select array_agg(r.role order by r.role) from user_roles r where r.user_id = u.id), array[u.role]) as roles
    from auth_sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha(token)} and s.expires_at > now()`;
  return u ?? null;
}

export async function requireUser(...roles: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/connexion');
  if (roles.length && !roles.some(r => u.roles.includes(r))) redirect('/');
  return u;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 12);

export const hasRole = (u: User | null, r: Role) => !!u && u.roles.includes(r);

// Espaces accessibles (un compte parent + administrateur bascule de l'un à l'autre)
export const SPACES = [
  { role: 'parent' as const, path: '/parent', label: 'Espace famille' },
  { role: 'admin' as const, path: '/contenu', label: 'Espace contenu' },
];

export function spacesFor(u: User, current: 'parent' | 'admin') {
  return SPACES.filter(s => u.roles.includes(s.role)).map(s => ({
    href: `/espace/${s.role === 'admin' ? 'contenu' : 'famille'}`, label: s.label, current: s.role === current,
  }));
}
