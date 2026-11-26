import { LogOut, KeyRound } from 'lucide-react';
import { Logo } from './Logo';
import { NavLinks, TabBar, type NavItem } from './NavLinks';
import { logoutAction } from '@/app/actions';

export type { NavItem };
export type Space = { href: string; label: string; current: boolean };

// Coquille de l'application : barre latérale (grand écran) ou barre du haut + onglets en bas (téléphone).
// Seule la zone de contenu défile.
// Le numéro de version n'est montré qu'à l'administrateur (le développeur), jamais aux familles (décision du propriétaire, 26/11/2026).
export function Shell({ role, nav, theme, spaces, user, showVersion = false, children }: {
  role: string; nav: NavItem[]; theme?: string; spaces?: Space[]; user: { name: string; sub?: string }; right?: React.ReactNode; showVersion?: boolean; children: React.ReactNode;
}) {
  const initials = user.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const release = process.env.APP_RELEASE ?? 'dev';
  const switcher = spaces && spaces.length > 1 && (
    <nav aria-label="Changer d’espace" className="space-switch">
      {spaces.map(sp => <a key={sp.href} href={sp.href} aria-current={sp.current ? 'page' : undefined}>{sp.label}</a>)}
    </nav>
  );
  const logout = (
    <form action={logoutAction} className="flex items-center gap-1">
      <a href="/compte" className="side-icon-btn" data-tip="Mon mot de passe" aria-label="Mon mot de passe"><KeyRound size={18} aria-hidden="true" /></a>
      <button type="submit" className="side-icon-btn" data-tip="Se déconnecter" aria-label="Se déconnecter"><LogOut size={18} aria-hidden="true" /></button>
    </form>
  );
  return (
    <div className="app h-full flex" data-theme={theme && theme !== 'classique' ? theme : undefined}>
      {/* barre latérale */}
      <aside className="sidebar hidden lg:flex">
        <div className="px-5 pt-6 pb-5 flex items-start justify-between gap-2">
          <Logo onDark id="logo-side" />
          {showVersion && <span className="pill version-pill mt-1" data-tip-pos="bottom" data-tip={`Version en ligne · ${process.env.APP_VERSION ?? 'dev'}`}>v{release}</span>}
        </div>
        {switcher && <div className="px-4 pb-4">{switcher}</div>}
        <div className="px-3 flex-1 min-h-0 overflow-y-auto"><NavLinks items={nav} /></div>
        <div className="side-foot">
          <span className="avatar">{initials}</span>
          <span className="flex-1 min-w-0 leading-tight">
            <span className="block font-semibold truncate" style={{ color: 'var(--side-ink)' }}>{user.name}</span>
            {user.sub && <span className="block text-xs truncate" style={{ color: 'var(--side-ink-2)' }}>{user.sub}</span>}
          </span>
          {logout}
        </div>
        <div className="pb-4" />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* barre du haut, téléphone et tablette */}
        <header className="mobile-bar lg:hidden">
          <Logo onDark id="logo-mobile" />
          {showVersion && <span className="pill version-pill">v{release}</span>}
          <span className="flex-1" />
          {switcher}
          <span className="avatar !w-8 !h-8 !text-xs" data-tip-pos="bottom" data-tip={user.name}>{initials}</span>
          {logout}
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto pane px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 lg:pb-8">
          {/* sur téléphone, réserve la hauteur de la barre d'onglets sous le contenu */}
          <div className="max-w-[1320px] mx-auto lg:h-full flex flex-col gap-6 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
        </main>
        <TabBar items={nav} />
      </div>
    </div>
  );
}

export function PageTitle({ kicker, title, sub, children, spark }: { kicker?: string; title: string; sub?: React.ReactNode; children?: React.ReactNode; spark?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {kicker && <span className="page-kicker">{kicker}</span>}
        <h1 className={`font-bold leading-tight ${spark ? 'spark' : ''}`}>{title}</h1>
        {sub && <span className="muted text-[15px]">{sub}</span>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
