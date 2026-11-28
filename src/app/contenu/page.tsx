import { sql } from '@/lib/db';
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
      j.status as ai_job, j.error as ai_error, j.kind as ai_kind, coalesce(j.progress, case when j.status = 'en_attente' then 'en attente' end) as ai_progress,
      -- taille de la dernière version (celle qu'exporte « Exporter pour relecture »), en caractères du JSON
      (select length(v.document::text) from course_versions v where v.course_id = c.id and v.status in ('draft', 'published') order by version desc limit 1)::int as size,
      (c.id in (select id from live_courses)) as live,
      rv.data->>'verdict' as review_verdict, jsonb_array_length(coalesce(rv.data->'problemes', '[]'::jsonb)) as review_count
    from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    left join lateral (select status, error, kind, progress from jobs where kind in ('cours', 'relecture', 'cours_corrige') and payload->>'courseId' = c.id::text order by id desc limit 1) j on true
    left join lateral (select data from course_reviews where course_id = c.id order by created_at desc limit 1) rv on true
    where c.removed_at is null and ch.removed_at is null and s.removed_at is null and l.removed_at is null
    order by l.position, s.position, ch.position, c.position`;
  // tous les niveaux (même sans cours encore) : un niveau tout juste ajouté doit apparaître dans le catalogue
  const levels = await sql<{ code: string; name: string; subjects: number }[]>`select l.code, l.name,
    (select count(*)::int from subjects s where s.level_code = l.code and s.removed_at is null) as subjects
    from levels l where l.removed_at is null order by l.position, l.name`;
  const ov = await aiOverview();
  const aiReady = ov.ready.cours, reviewReady = ov.ready.relecture;
  return (
    <div className="flex flex-col lg:flex-1 lg:min-h-0">
      <AutoRefresh active={rows.some(r => r.ai_job === 'en_attente' || r.ai_job === 'en_cours')} />
      <CatalogueList levels={levels} rows={rows.map(r => ({ ...r }))} aiReady={aiReady} reviewReady={reviewReady} />
    </div>
  );
}
