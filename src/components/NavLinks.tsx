'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sun, BookOpen, Trophy, Sparkles, LayoutDashboard, Inbox, Activity, Users, FileCheck2, Library, Upload, UserCog, Circle,
  type LucideIcon,
} from 'lucide-react';

// Les icônes sont désignées par un nom (les composants ne passent pas du serveur au navigateur)
const ICONS: Record<string, LucideIcon> = {
  today: Sun, courses: BookOpen, results: Trophy, space: Sparkles,
  home: LayoutDashboard, todo: Inbox, activity: Activity, children: Users,
  review: FileCheck2, catalogue: Library, import: Upload, accounts: UserCog,
};
export type NavItem = { href: string; label: string; short?: string; icon?: string; badge?: number; exact?: boolean };

const isOn = (path: string, n: NavItem) => n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/');

// Navigation verticale (barre latérale, grand écran)
export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-1">
      {items.map(n => {
        const Icon = ICONS[n.icon ?? ''] ?? Circle;
        const on = isOn(path, n);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined} className="side-link">
            <Icon size={19} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
            <span className="flex-1">{n.label}</span>
            {!!n.badge && <span className="side-badge num">{n.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

// Barre d'onglets en bas (téléphone)
export function TabBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Navigation" className="tabbar lg:hidden">
      {items.map(n => {
        const Icon = ICONS[n.icon ?? ''] ?? Circle;
        const on = isOn(path, n);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined} className="tab-link">
            <span className="relative"><Icon size={22} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
              {!!n.badge && <span className="tab-badge num">{n.badge}</span>}</span>
            <span>{n.short ?? n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
