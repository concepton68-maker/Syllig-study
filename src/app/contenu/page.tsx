import Link from 'next/link';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { CatalogueList, type CatRow } from './CatalogueList';
import { aiOverview } from '@/lib/ai';
import { AutoRefresh } from '@/components/AutoRefresh';

export const metadata = { title: 'Catalogue' };
export const dynamic = 'force-dynamic';

export default async function Catalogue() {
  const rows = await sql<CatRow[]>`
    select c.id, c.code, c.title, l.code as level, l.name as level_name, s.name as subject, ch.name as chapter, c.priority,
      (select version from course_versions v where v.course_id = c.id and v.status = 'published') as published,
      (select max(version) from course_versions v where v.course_id = c.id and v.status = 'draft') as draft,
      (select v.id from course_versions v where v.course_id = c.id and v.status = 'draft' order by version desc limit 1) as draft_id,
      (select j.status from jobs j where j.kind = 'cours' and j.payload->>'courseId' = c.id::text order by j.id desc limit 1) as ai_job,
      (select j.error from jobs j where j.kind = 'cours' and j.payload->>'courseId' = c.id::text order by j.id desc limit 1) as ai_error,
      (select coalesce(j.progress, case when j.status = 'en_attente' then 'en attente' end) from jobs j where j.kind = 'cours' and j.payload->>'courseId' = c.id::text order by j.id desc limit 1) as ai_progress
    from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    order by l.position, s.position, ch.position, c.position`;
  const pub = rows.filter(r => r.published).length;
  const aiReady = (await aiOverview()).ready.cours;
  return (
    <div className="flex flex-col gap-5 lg:flex-1 lg:min-h-0">
      <PageTitle kicker="Catalogue" title={`${pub} cours publié${pub > 1 ? 's' : ''} sur ${rows.length}`} sub={aiReady ? 'Pour créer un cours : « Rédiger avec l’IA » (le brouillon arrive dans « À relire »), ou préparer la consigne pour Claude et importer le résultat.' : 'Pour créer un cours : « Préparer la consigne », la coller dans Claude, puis importer le JSON obtenu. (Rédaction automatique : choisir une IA dans Contenu › IA.)'}>
        <Link className="btn btn-primary" href="/contenu/importer">Importer un cours</Link>
      </PageTitle>
      <AutoRefresh active={rows.some(r => r.ai_job === 'en_attente' || r.ai_job === 'en_cours')} />
      <CatalogueList rows={rows.map(r => ({ ...r }))} aiReady={aiReady} />
    </div>
  );
}
