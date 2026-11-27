'use server';
import { requireUser, verifyLogin, createSession } from '@/lib/auth';
import { checkNewPassword, setPassword } from '@/lib/password';
import { sql } from '@/lib/db';
import { studentsOfParent } from '@/lib/access';
import { ensureMessage, lastMonday, sendMessage } from '@/lib/weekly';
import { mailSettings, sendMail, appUrl, confirmToken, confirmExp } from '@/lib/mailer';

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
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };
  const on = form.get('weekly') === 'on';
  const [me] = await sql<{ email: string | null }[]>`select email from users where id = ${u.id}`;
  // l'essai n'abonne personne : il part seulement à une adresse déjà confirmée
  if (form.get('test') === '1') {
    if (!me?.email) return { error: 'Confirmez d’abord votre adresse (enregistrez-la, puis cliquez sur le lien reçu).' };
    if (!(await mailSettings())) return { error: 'L’envoi des e-mails n’est pas encore configuré par l’administrateur.' };
    const monday = await lastMonday();
    let sent = 0; const errors: string[] = [];
    for (const s of await studentsOfParent(u.id)) {
      const [inWeek] = await sql<{ ok: boolean }[]>`select created_at < ((${monday}::date + 7)::timestamp at time zone 'Europe/Paris') as ok from students where id = ${s.id}`;
      if (!inWeek?.ok) continue;
      const m = await ensureMessage(s.id, monday);
      if (!m) continue;
      const r = await sendMessage(m.id, m.data, s.id, u.id);
      sent += r.sent; errors.push(...r.errors);
    }
    return errors.length ? { error: `Échec de l’envoi : ${errors[0]}` } : { ok: sent ? `Message d’essai envoyé à ${me.email}.` : 'Pas encore de semaine complète à envoyer.' };
  }
  await sql`update users set weekly_email = ${on} where id = ${u.id}`;
  if (!email) { await sql`update users set email = null, email_pending = null where id = ${u.id}`; return { ok: 'Enregistré : aucune adresse, aucun e-mail.' }; }
  if (email === me?.email) return { ok: on ? 'Enregistré : vous recevrez le message chaque lundi.' : 'Enregistré : pas de message par e-mail.' };
  // nouvelle adresse : rien n'y est envoyé (hors ce lien) tant qu'elle n'est pas confirmée
  await sql`update users set email_pending = ${email} where id = ${u.id}`;
  if (!(await mailSettings())) return { error: 'L’envoi des e-mails n’est pas encore configuré par l’administrateur : réessayez plus tard.' };
  const exp = confirmExp();
  const link = `${appUrl()}/confirmer-email?u=${u.id}&e=${encodeURIComponent(email)}&x=${exp}&t=${confirmToken(u.id, email, exp)}`;
  try {
    await sendMail(email, 'Syllig Study : confirmez votre adresse', `<p>Bonjour,</p><p>Pour recevoir le message du lundi sur le travail de votre enfant, confirmez cette adresse :</p><p><a href="${link}">Confirmer mon adresse</a></p><p>Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>`,
      `Pour recevoir le message du lundi, confirmez cette adresse : ${link}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.`);
  } catch (e) { return { error: `Le lien de confirmation n’a pas pu partir : ${(e as Error).message}` }; }
  return { ok: `Un lien de confirmation a été envoyé à ${email}. Rien d’autre n’y sera envoyé avant que vous cliquiez dessus.` };
}
