import { Logo } from '@/components/Logo';

// Cadre simple des pages d'accès (mot de passe oublié, nouveau mot de passe)
export function AuthFrame({ title, sub, children, back = { href: '/connexion', label: '‹ Retour à la connexion' } }: { title: string; sub: string; children: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <main className="h-full overflow-y-auto pane flex justify-center p-6 bg-[#F6F7FB]">
      <div className="w-full max-w-[440px] flex flex-col gap-7 my-auto">
        <Logo id="logo-auth" />
        <div>
          <h1 className="text-[28px] font-bold tracking-tight m-0">{title}</h1>
          <p className="muted text-[15px] mt-1.5 mb-0">{sub}</p>
        </div>
        <div className="card !p-7">{children}</div>
        <a href={back.href} className="font-semibold text-sm">{back.label}</a>
      </div>
    </main>
  );
}
