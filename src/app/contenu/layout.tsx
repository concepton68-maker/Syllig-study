import { requireUser } from '@/lib/auth';
import { Shell } from '@/components/Shell';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('admin');
  return (
    <Shell role="Contenu" nav={[
      { href: '/contenu', label: 'Catalogue', exact: true },
      { href: '/contenu/importer', label: 'Importer un cours' },
      { href: '/contenu/format', label: 'Format et consigne IA' },
    ]} right={<span className="text-sm font-semibold">{u.display_name}</span>}>
      {children}
    </Shell>
  );
}
