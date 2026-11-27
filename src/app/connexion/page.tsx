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
  { icon: ShieldCheck, title: 'Un temps de travail mesuré', text: 'Le temps de travail est mesuré par le serveur, page de travail visible à l’écran.' },
];

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  return (
    <main className="h-full overflow-y-auto pane flex bg-[#F6F7FB]">
      <section className="login-hero hidden lg:flex flex-col justify-between w-[46%] max-w-[680px] p-12 text-white">
        <Logo onDark size="lg" id="logo-hero" />
        <div className="flex flex-col gap-8 max-w-[460px]">
          <h1 className="text-[40px] leading-[1.1] font-bold tracking-tight">Leçons, exercices, évaluations : <span className="login-hl">un parcours suivi</span>.</h1>
          <ul className="flex flex-col gap-5 m-0 p-0 list-none">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="login-ico"><Icon size={20} aria-hidden="true" /></span>
                <span><strong className="block text-[16px]">{title}</strong><span className="text-[14.5px] text-white/75">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/55 m-0">Programmes officiels du collège et du lycée</p>
      </section>

      <section className="flex-1 flex justify-center p-6">
        <div className="w-full max-w-[400px] flex flex-col gap-7 my-auto">
          <div className="lg:hidden"><Logo id="logo-login" /></div>
          <div>
            <h2 className="text-[30px] font-bold tracking-tight">Bon retour 👋</h2>
            <p className="muted text-[15px] mt-1.5 mb-0">Connecte-toi pour retrouver ton parcours.</p>
          </div>
          <div className="card !p-7"><LoginForm /></div>
          <div className="flex flex-wrap gap-x-5 gap-y-1"><a href="/connexion/oubli" className="font-semibold text-sm">Mot de passe oublié ?</a><a href="/confidentialite" className="text-sm muted">Confidentialité</a></div>
        </div>
      </section>
    </main>
  );
}
