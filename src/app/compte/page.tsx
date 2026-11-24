import { requireUser } from '@/lib/auth';
import { AuthFrame } from '../connexion/AuthFrame';
import { ChangePasswordForm } from './Form';

export const metadata = { title: 'Mon mot de passe' };
export const dynamic = 'force-dynamic';

export default async function Account() {
  const u = await requireUser();
  return (
    <AuthFrame title="Mon mot de passe" sub={`Compte : ${u.display_name} (${u.login})`} back={{ href: '/', label: '‹ Retour à mon espace' }}>
      <ChangePasswordForm login={u.login} />
    </AuthFrame>
  );
}
