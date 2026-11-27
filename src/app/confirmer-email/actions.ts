'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { checkConfirm } from '@/lib/mailer';

// Confirmation par un bouton (pas à l'ouverture du lien) ; seulement l'adresse en attente, et avant l'expiration du lien
export async function confirmEmail(form: FormData) {
  const u = String(form.get('u') ?? ''), e = String(form.get('e') ?? '').toLowerCase(), x = Number(form.get('x')), t = String(form.get('t') ?? '');
  const ok = /^[0-9a-f-]{36}$/i.test(u) && checkConfirm(u, e, x, t);
  const r = ok ? await sql`update users set email = ${e}, email_pending = null where id = ${u} and email_pending = ${e} returning 1` : [];
  redirect(`/confirmer-email?fait=${r.length ? 1 : 0}`);
}
