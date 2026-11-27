'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { saveMailSettings, sendMail } from '@/lib/mailer';

type S = { ok?: string; error?: string } | undefined;
export async function saveMail(_: S, form: FormData): Promise<S> {
  const u = await requireUser('admin');
  const v = z.object({ host: z.string().trim().min(3).max(200), port: z.coerce.number().int().min(1).max(65535), user: z.string().trim().max(200), pass: z.string().max(500), from: z.string().trim().min(5).max(200) })
    .safeParse({ host: form.get('host'), port: form.get('port'), user: form.get('user'), pass: form.get('pass') ?? '', from: form.get('from') });
  if (!v.success) return { error: 'Vérifiez le serveur, le port et l’adresse d’expédition.' };
  await saveMailSettings({ ...v.data, pass: v.data.pass || undefined }, u.id);
  return { ok: 'Réglages enregistrés.' };
}
export async function testMail(_: S, form: FormData): Promise<S> {
  await requireUser('admin');
  const to = String(form.get('to') ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { error: 'Adresse invalide.' };
  try { await sendMail(to, 'Syllig Study : e-mail d’essai', '<p>L’envoi des e-mails fonctionne.</p>', 'L’envoi des e-mails fonctionne.'); return { ok: `E-mail d’essai envoyé à ${to}.` }; }
  catch (e) { return { error: `Échec de l’envoi : ${(e as Error).message}` }; }
}
