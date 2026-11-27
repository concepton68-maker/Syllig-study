import { requireUser } from '@/lib/auth';
import { AuthFrame } from '../connexion/AuthFrame';
import { ChangePasswordForm, WeeklyForm } from './Form';
import { sql } from '@/lib/db';

export const metadata = { title: 'Mon compte' };
export const dynamic = 'force-dynamic';

export default async function Account() {
  const u = await requireUser();
  const [me] = await sql<{ email: string | null; email_pending: string | null; weekly_email: boolean }[]>`select email, email_pending, weekly_email from users where id = ${u.id}`;
  const parent = u.roles.includes('parent');
  return (
    <AuthFrame title={parent ? "Mon compte" : "Mon mot de passe"} sub={`Compte : ${u.display_name} (${u.login})`} back={{ href: '/', label: '‹ Retour à mon espace' }}>
      {parent && <section className="flex flex-col gap-3 pb-5 mb-1 border-b border-line" aria-labelledby="hebdo"><h2 id="hebdo" className="text-lg font-semibold m-0">Message de la semaine</h2><WeeklyForm email={me?.email ?? ''} pending={me?.email_pending ?? ''} on={me?.weekly_email ?? false} /></section>}
      <ChangePasswordForm login={u.login} />
    </AuthFrame>
  );
}
