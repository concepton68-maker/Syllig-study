import Link from 'next/link';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { CatalogueList, type CatRow } from './CatalogueList';

export const metadata = { title: 'Catalogue' };
export const dynamic = 'force-dynamic';

export default async function Catalogue() {
  const rows = await sql<CatRow[]>`
    select c.id, c.code, c.title, l.code as level, l.name as level_name, s.name as subject, ch.name as chapter, c.priority,
      (select version from course_versions v where v.course_id = c.id and v.status = 'published') as published,
      (select max(version) from course_versions v where v.course_id = c.id and v.status = 'draft') as draft,
      (select v.id from course_versions v where v.course_id = c.id and v.status = 'draft' order by version desc limit 1) as draft_id
    from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    order by l.position, s.position, ch.position, c.position`;
  const pub = rows.filter(r => r.published).length;
  return (
    <div className="flex flex-col gap-5 lg:flex-1 lg:min-h-0">
      <PageTitle kicker="Catalogue" title={`${pub} cours publié${pub > 1 ? 's' : ''} sur ${rows.length}`} sub="Pour créer un cours : « Préparer la consigne », la coller dans Claude, puis importer le JSON obtenu.">
        <Link className="btn btn-primary" href="/contenu/importer">Importer un cours</Link>
      </PageTitle>
      <CatalogueList rows={rows.map(r => ({ ...r }))} />
    </div>
  );
}
