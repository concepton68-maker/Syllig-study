'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-wrap gap-1 flex-[1_1_480px]">
      {items.map(n => {
        const on = n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/');
        return <Link key={n.href} href={n.href} className="navlink" aria-current={on ? 'page' : undefined}>{n.label}</Link>;
      })}
    </nav>
  );
}
