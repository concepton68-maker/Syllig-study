import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-[420px] p-8 flex flex-col gap-6">
        <Logo />
        <div>
          <h1 className="text-2xl font-bold">Connexion</h1>
          <p className="muted text-sm mt-1">Le parcours qui fait progresser.</p>
        </div>
        <LoginForm />
        <p className="muted text-xs">Mot de passe oublié ? Demande à ton parent de le réinitialiser depuis son espace.</p>
        <p className="text-[11px] text-muted-2 m-0">Version {process.env.APP_RELEASE ?? 'dev'} · {process.env.APP_VERSION ?? 'dev'}</p>
      </div>
    </main>
  );
}
