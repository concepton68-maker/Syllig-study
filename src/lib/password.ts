import 'server-only';
import crypto from 'node:crypto';
import { sql } from './db';
import { hashPassword } from './auth';

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const MIN_PASSWORD = 8;

export function checkNewPassword(pw: string, confirm?: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Mot de passe : ${MIN_PASSWORD} caractères minimum.`;
  if (pw.length > 200) return 'Mot de passe trop long.';
  if (confirm !== undefined && pw !== confirm) return 'Les deux mots de passe ne sont pas identiques.';
  return null;
}

// Change le mot de passe, ferme toutes les sessions ouvertes et clôt les demandes en cours
export async function setPassword(userId: string, pw: string) {
  await sql`update users set password_hash = ${await hashPassword(pw)} where id = ${userId}`;
  await sql`delete from auth_sessions where user_id = ${userId}`;
  await sql`update password_requests set done_at = now() where user_id = ${userId} and done_at is null`;
  await sql`update password_reset_tokens set used_at = now() where user_id = ${userId} and used_at is null`;
}

// Lien à usage unique, valable 48 h
export async function createResetLink(userId: string, createdBy: string, origin: string) {
  const token = crypto.randomBytes(24).toString('base64url');
  await sql`update password_reset_tokens set used_at = now() where user_id = ${userId} and used_at is null`;
  await sql`insert into password_reset_tokens (token_hash, user_id, created_by, expires_at) values (${sha(token)}, ${userId}, ${createdBy}, now() + interval '48 hours')`;
  return `${origin}/connexion/nouveau?jeton=${token}`;
}

export async function userForToken(token: string) {
  if (!token || token.length > 100) return null;
  const [u] = await sql<{ id: string; display_name: string; login: string }[]>`
    select u.id, u.display_name, u.login from password_reset_tokens t join users u on u.id = t.user_id
    where t.token_hash = ${sha(token)} and t.used_at is null and t.expires_at > now()`;
  return u ?? null;
}
