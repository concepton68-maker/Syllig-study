import { AuthFrame } from '../AuthFrame';
import { userForToken } from '@/lib/password';
import { NewPasswordForm } from './Form';

export const metadata = { title: 'Nouveau mot de passe' };
export const dynamic = 'force-dynamic';

export default async function NewPassword({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const token = (await searchParams).jeton ?? '';
  const u = await userForToken(token);
  if (!u) return (
    <AuthFrame title="Lien expiré" sub="Ce lien a déjà servi ou n’est plus valable (48 h).">
      <a className="btn btn-primary" href="/connexion/oubli">Faire une nouvelle demande</a>
    </AuthFrame>
  );
  return (
    <AuthFrame title="Nouveau mot de passe" sub={`Compte : ${u.display_name} (${u.login})`}>
      <NewPasswordForm token={token} login={u.login} />
    </AuthFrame>
  );
}
