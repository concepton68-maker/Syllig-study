import { redirect } from 'next/navigation';
import { Target, ShieldCheck, LineChart } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

const POINTS = [
  { icon: Target, title: 'Un parcours calculé chaque jour', text: 'Les priorités du programme d’abord, puis les révisions au bon moment.' },
  { icon: LineChart, title: 'Des progrès visibles', text: 'Niveaux de maîtrise, points de progrès et carte des forces et des points à travailler.' },
  { icon: ShieldCheck, title: 'Un vrai temps de travail', text: 'Seul le temps actif compte, horodaté par le serveur. Les parents suivent tout.' },
];

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  return (
    <main className="min-h-dvh flex bg-[#F6F7FB]">
      <section className="login-hero hidden lg:flex flex-col justify-between w-[46%] max-w-[680px] p-12 text-white">
        <Logo onDark size="lg" id="logo-hero" />
        <div className="flex flex-col gap-8 max-w-[460px]">
          <h1 className="text-[40px] leading-[1.1] font-bold tracking-tight">Le parcours qui fait <span className="login-hl">vraiment progresser</span>.</h1>
          <ul className="flex flex-col gap-5 m-0 p-0 list-none">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="login-ico"><Icon size={20} aria-hidden="true" /></span>
                <span><strong className="block text-[16px]">{title}</strong><span className="text-[14.5px] text-white/75">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/55 m-0">Seconde générale · programme officiel · version {process.env.APP_RELEASE ?? 'dev'}</p>
      </section>

      <section className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] flex flex-col gap-7">
          <div className="lg:hidden"><Logo id="logo-login" /></div>
          <div>
            <h2 className="text-[30px] font-bold tracking-tight">Bon retour 👋</h2>
            <p className="muted text-[15px] mt-1.5 mb-0">Connecte-toi pour retrouver ton parcours.</p>
          </div>
          <div className="card !p-7"><LoginForm /></div>
          <p className="muted text-sm m-0">Mot de passe oublié ? Demande à ton parent de le réinitialiser depuis son espace.</p>
          <p className="text-xs text-muted-2 m-0">Version {process.env.APP_RELEASE ?? 'dev'} · {process.env.APP_VERSION ?? 'dev'}</p>
        </div>
      </section>
    </main>
  );
}
