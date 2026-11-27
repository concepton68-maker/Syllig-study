'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { checkUnsubscribe } from '@/lib/mailer';

export async function unsubscribe(form: FormData) {
  const u = String(form.get('u') ?? ''), t = String(form.get('t') ?? '');
  const ok = /^[0-9a-f-]{36}$/i.test(u) && checkUnsubscribe(u, t);
  if (ok) await sql`update users set weekly_email = false where id = ${u}`;
  redirect(`/desabonnement?fait=${ok ? 1 : 0}`);
}
