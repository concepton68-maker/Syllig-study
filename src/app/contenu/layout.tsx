import { requireUser, spacesFor } from '@/lib/auth';
import { sql } from '@/lib/db';
import { Shell } from '@/components/Shell';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('admin');
  const [{ n }] = await sql<{ n: number }[]>`select count(distinct course_id)::int as n from course_versions v
    where v.status = 'draft' and not exists (select 1 from course_versions w where w.course_id = v.course_id and w.status = 'published' and w.version > v.version)`;
  return (
    <Shell role="Contenu" spaces={spacesFor(u, 'admin')} nav={[
      { href: '/contenu/a-relire', label: 'À relire', icon: 'review', badge: n },
      { href: '/contenu', label: 'Catalogue', icon: 'catalogue', exact: true },
      { href: '/contenu/importer', label: 'Importer', icon: 'import' },
      { href: '/contenu/comptes', label: 'Comptes', icon: 'accounts' },
    ]} user={{ name: u.display_name, sub: 'Contenu pédagogique' }}>
      {children}
    </Shell>
  );
}
