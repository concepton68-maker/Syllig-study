import { requireUser, spacesFor } from '@/lib/auth';
import { sql } from '@/lib/db';
import { Shell } from '@/components/Shell';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('admin');
  const [{ n }] = await sql<{ n: number }[]>`select count(distinct course_id)::int as n from course_versions v
    where v.status = 'draft' and not exists (select 1 from course_versions w where w.course_id = v.course_id and w.status = 'published' and w.version > v.version)`;
  return (
    <Shell role="Contenu" spaces={spacesFor(u, 'admin')} nav={[
      { href: '/contenu/a-relire', label: n ? `À relire (${n})` : 'À relire' },
      { href: '/contenu', label: 'Catalogue', exact: true },
      { href: '/contenu/importer', label: 'Importer' },
      { href: '/contenu/comptes', label: 'Comptes' },
    ]} right={<span className="text-sm font-semibold">{u.display_name}</span>}>
      {children}
    </Shell>
  );
}
