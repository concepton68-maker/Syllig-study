'use server';
import { requireUser, verifyLogin, createSession } from '@/lib/auth';
import { checkNewPassword, setPassword } from '@/lib/password';
import { sql } from '@/lib/db';
import { studentsOfParent } from '@/lib/access';
import { ensureMessage, lastMonday, sendMessage } from '@/lib/weekly';
import { mailSettings } from '@/lib/mailer';

export async function changeOwnPassword(_: { ok?: string; error?: string } | undefined, form: FormData) {
  const u = await requireUser();
  if (!(await verifyLogin(u.login, String(form.get('current') ?? '')))) return { error: 'Mot de passe actuel incorrect.' };
  const pw = String(form.get('password') ?? '');
  const err = checkNewPassword(pw, String(form.get('confirm') ?? ''));
  if (err) return { error: err };
  await setPassword(u.id, pw);   // ferme les autres sessions (autre appareil, ancien téléphone…)
  await createSession(u.id);     // … mais garde celle-ci ouverte
  return { ok: 'Mot de passe modifié. Les autres appareils devront se reconnecter.' };
}

// Message de la semaine (parent) : adresse, envoi oui / non, message d'essai

export async function saveWeekly(_: { ok?: string; error?: string } | undefined, form: FormData) {
  const u = await requireUser('parent');
  const email = String(form.get('email') ?? '').trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };
  const on = form.get('weekly') === 'on';
  await sql`update users set email = ${email || null}, weekly_email = ${on} where id = ${u.id}`;
  if (form.get('test') === '1') {
    if (!email) return { error: 'Indiquez d’abord votre adresse.' };
    if (!(await mailSettings())) return { error: 'L’envoi des e-mails n’est pas encore configuré par l’administrateur.' };
    const monday = await lastMonday();
    let sent = 0; const errors: string[] = [];
    for (const s of await studentsOfParent(u.id)) {
      const m = await ensureMessage(s.id, monday);
      if (!m) continue;
      await sql`update users set weekly_email = true where id = ${u.id}`;   // le temps de l'essai
      const r = await sendMessage(m.id, m.data, s.id, u.id);
      sent += r.sent; errors.push(...r.errors);
      if (!on) await sql`update users set weekly_email = false where id = ${u.id}`;
    }
    return errors.length ? { error: `Échec de l’envoi : ${errors[0]}` } : { ok: `Message d’essai envoyé à ${email} (${sent} enfant${sent > 1 ? 's' : ''}).` };
  }
  return { ok: on ? 'Enregistré : vous recevrez le message chaque lundi.' : 'Enregistré : plus de message par e-mail.' };
}
