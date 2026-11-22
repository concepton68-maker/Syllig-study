import { requireUser } from '@/lib/auth';
import { Shell } from '@/components/Shell';

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('parent');
  return (
    <Shell role="Parent" nav={[
      { href: '/parent', label: 'Tableau de bord', exact: true },
      { href: '/parent/copies', label: 'Copies à corriger' },
      { href: '/parent/journal', label: 'Journal d’activité' },
      { href: '/parent/regles', label: 'Règles' },
      { href: '/parent/enfants', label: 'Mes enfants' },
    ]} right={<span className="text-sm font-semibold">{u.display_name}</span>}>
      {children}
    </Shell>
  );
}
