import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { logoutAction } from '@/app/actions';

export type NavItem = { href: string; label: string; exact?: boolean };

// Coquille de l'application : barre du haut fixe, zone de contenu qui défile (ou se découpe en colonnes)
export type Space = { href: string; label: string; current: boolean };

export function Shell({ role, nav, right, theme, spaces, version, children }: {
  role: string; nav: NavItem[]; right?: React.ReactNode; theme?: string; spaces?: Space[]; version?: string; children: React.ReactNode;
}) {
  return (
    <div className="app h-dvh flex flex-col" data-theme={theme && theme !== 'classique' ? theme : undefined}>
      <header className="app-header shrink-0 border-b border-line">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4">
          <Logo role={spaces && spaces.length > 1 ? undefined : role} />
          <span title={`Version en ligne · ${process.env.APP_VERSION ?? 'dev'}`} className="pill border border-line-strong bg-white text-ink-2 text-xs font-semibold num">v{version ?? process.env.APP_RELEASE ?? 'dev'}</span>
          {spaces && spaces.length > 1 && (
            <nav aria-label="Changer d’espace" className="flex rounded-full border border-line-strong bg-white p-1">
              {spaces.map(s => (
                <a key={s.href} href={s.href} aria-current={s.current ? 'page' : undefined}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold no-underline ${s.current ? 'bg-brand text-white' : 'text-ink-2 hover:bg-soft'}`}>{s.label}</a>
              ))}
            </nav>
          )}
          <NavLinks items={nav} />
          <div className="flex flex-wrap items-center gap-3">
            {right}
            <form action={logoutAction}><button className="text-sm font-semibold text-[var(--header-ink-2,var(--color-muted))] hover:text-[var(--header-ink,var(--color-ink))] underline-offset-4 hover:underline min-h-11 px-2" type="submit">Se déconnecter</button></form>
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
