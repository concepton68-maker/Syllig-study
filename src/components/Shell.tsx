import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { logoutAction } from '@/app/actions';

export type NavItem = { href: string; label: string; exact?: boolean };

// Coquille de l'application : barre du haut fixe, zone de contenu qui défile (ou se découpe en colonnes)
export function Shell({ role, nav, right, theme, children }: { role: string; nav: NavItem[]; right?: React.ReactNode; theme?: string; children: React.ReactNode }) {
  return (
    <div className="app h-dvh flex flex-col" data-theme={theme && theme !== 'classique' ? theme : undefined}>
      <header className="app-header shrink-0 border-b border-line">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4">
          <Logo role={role} />
          <NavLinks items={nav} />
          <div className="flex flex-wrap items-center gap-3">
            {right}
            <form action={logoutAction}><button className="btn" type="submit">Se déconnecter</button></form>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto pane px-4 sm:px-6 pt-6 pb-8">
        <div className="max-w-[1400px] mx-auto h-full flex flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

export function PageTitle({ kicker, title, sub, children, spark }: { kicker?: string; title: string; sub?: React.ReactNode; children?: React.ReactNode; spark?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {kicker && <span className="lbl">{kicker}</span>}
        <h1 className={`text-[26px] sm:text-[28px] font-bold leading-tight ${spark ? 'spark' : ''}`}>{title}</h1>
        {sub && <span className="muted text-[15px]">{sub}</span>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
