import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { logoutAction } from '@/app/actions';

export type NavItem = { href: string; label: string; exact?: boolean };

export function Shell({ role, nav, right, children }: { role: string; nav: NavItem[]; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <header className="bg-white border-b border-line">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4">
          <Logo role={role} />
          <NavLinks items={nav} />
          <div className="flex flex-wrap items-center gap-3">
            {right}
            <form action={logoutAction}><button className="btn" type="submit">Se déconnecter</button></form>
          </div>
        </div>
      </header>
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-7 pb-12 flex flex-col gap-6">{children}</main>
    </div>
  );
}

export function PageTitle({ kicker, title, sub, children }: { kicker?: string; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {kicker && <span className="lbl">{kicker}</span>}
        <h1 className="text-[28px] sm:text-[30px] font-bold leading-tight">{title}</h1>
        {sub && <span className="muted text-[15px]">{sub}</span>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
