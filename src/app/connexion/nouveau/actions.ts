'use server';
import { redirect } from 'next/navigation';
import { createSession } from '@/lib/auth';
import { checkNewPassword, setPassword, userForToken } from '@/lib/password';

export async function chooseNewPassword(_: { error?: string } | undefined, form: FormData) {
  const u = await userForToken(String(form.get('jeton') ?? ''));
  if (!u) return { error: 'Ce lien n’est plus valable. Fais une nouvelle demande.' };
  const pw = String(form.get('password') ?? '');
  const err = checkNewPassword(pw, String(form.get('confirm') ?? ''));
  if (err) return { error: err };
  await setPassword(u.id, pw);
  await createSession(u.id);
  redirect('/');
}
