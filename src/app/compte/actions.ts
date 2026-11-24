'use server';
import { requireUser, verifyLogin, createSession } from '@/lib/auth';
import { checkNewPassword, setPassword } from '@/lib/password';

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
