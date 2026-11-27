import 'server-only';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { sql } from './db';
import { seal, open } from './ai';

// Envoi des e-mails : un service d'envoi (SMTP) européen choisi par l'administrateur (Brevo, Scaleway…).
// Le mot de passe est chiffré en base comme les clés d'IA. Aucun e-mail n'est envoyé tant que ce n'est pas configuré.
export type MailSettings = { host: string; port: number; user: string; pass_sealed: string; pass_hint: string; from: string };

export async function mailSettings(): Promise<MailSettings | null> {
  const [r] = await sql<{ value: MailSettings }[]>`select value from app_settings where key = 'email'`;
  return r?.value?.host ? r.value : null;
}
export async function saveMailSettings(v: { host: string; port: number; user: string; pass?: string; from: string }, userId: string) {
  const cur = await mailSettings();
  const pass_sealed = v.pass ? seal(v.pass) : cur?.pass_sealed ?? '';
  const pass_hint = v.pass ? `…${v.pass.slice(-3)}` : cur?.pass_hint ?? '';
  const value: MailSettings = { host: v.host, port: v.port, user: v.user, pass_sealed, pass_hint, from: v.from };
  await sql`insert into app_settings (key, value, updated_by) values ('email', ${sql.json(value)}, ${userId})
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
}

export async function sendMail(to: string, subject: string, html: string, text: string, headers: Record<string, string> = {}) {
  const s = await mailSettings();
  if (!s) throw new Error('Envoi des e-mails non configuré (Contenu › E-mails).');
  const t = nodemailer.createTransport({
    host: s.host, port: s.port, secure: s.port === 465, auth: s.user ? { user: s.user, pass: s.pass_sealed ? open(s.pass_sealed) : '' } : undefined,
    ...(s.host === '127.0.0.1' ? { ignoreTLS: true } : { requireTLS: true }),   // chiffrement obligatoire (sauf serveur de test local)
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  await t.sendMail({ from: s.from, to, subject, html, text, headers });
}

// Lien de désabonnement signé (pas besoin d'être connecté pour se désabonner)
const signKey = () => crypto.createHash('sha256').update(`syllig-desabonnement|${process.env.DATABASE_URL ?? ''}`).digest();
export const unsubscribeToken = (userId: string) => crypto.createHmac('sha256', signKey()).update(userId).digest('base64url').slice(0, 32);
export const checkUnsubscribe = (userId: string, token: string) => {
  const a = Buffer.from(unsubscribeToken(userId)), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
// Confirmation de l'adresse : lien signé qui porte l'adresse saisie
// valable 7 jours (`exp` : date limite en secondes, signée avec l'adresse)
export const confirmToken = (userId: string, email: string, exp: number) => crypto.createHmac('sha256', signKey()).update(`confirmer|${userId}|${email.toLowerCase()}|${exp}`).digest('base64url').slice(0, 32);
export const confirmExp = () => Math.floor(Date.now() / 1000) + 7 * 86400;
export const checkConfirm = (userId: string, email: string, exp: number, token: string) => {
  if (!Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  const a = Buffer.from(confirmToken(userId, email, exp)), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
export const appUrl = () => (process.env.APP_URL ?? 'https://study.syllig.com').replace(/\/$/, '');
