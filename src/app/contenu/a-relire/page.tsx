import Link from 'next/link';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { EmptyState } from '@/components/EmptyState';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { publishBulkAction, discardBulkAction } from '../cours/[id]/actions';

export const metadata = { title: 'À relire' };
export const dynamic = 'force-dynamic';

// Brouillons importés qui attendent une relecture avant publication
export default async function ToReview({ searchParams }: { searchParams: Promise<{ importes?: string; ecarte?: string }> }) {
  const sp = await searchParams;
  const rows = await sql<{ course_id: number; id: string; version: number; code: string | null; title: string; subject: string; level: string; imported_at: Date; source_name: string | null; replaces: number | null }[]>`
    select v.course_id, v.id, v.version, c.code, c.title, s.name as subject, l.name as level, v.imported_at, v.source_name,
      (select w.version from course_versions w where w.course_id = v.course_id and w.status = 'published') as replaces
    from course_versions v join courses c on c.id = v.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    where v.status = 'draft' and v.version = (select max(version) from course_versions x where x.course_id = v.course_id)
    order by v.imported_at desc`;
  return (
    <Screen top={<PageTitle kicker="À relire" title={rows.length ? `${rows.length} cours à relire avant publication` : 'Rien à relire'}
      sub="Chaque import arrive ici en brouillon. Relisez la vue complète (corrigés compris), puis publiez : les élèves le voient aussitôt.">
      <Link className="btn btn-primary" href="/contenu/importer">Importer un cours</Link>
    </PageTitle>}>
      {sp.importes && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>{sp.importes} cours importés en brouillon.</strong> Relisez-les, puis publiez-les (un par un ou en groupe).</p>}
      {sp.ecarte && <p role="status" className="m-0 rounded-xl bg-soft text-ink-2 px-4 py-3 text-sm"><strong>{sp.ecarte === '1' ? 'Brouillon écarté.' : `${sp.ecarte} brouillons écartés.`}</strong> Ils restent dans l’historique du cours, invisibles des élèves.</p>}
      <section className="card flex flex-col">
        {rows.length === 0 && <EmptyState title="Aucun brouillon en attente" text="Préparez une consigne depuis le catalogue, collez-la dans Claude, puis importez le JSON obtenu." action={<Link className="btn" href="/contenu">Ouvrir le catalogue</Link>} />}
        {rows.length > 1 && <div className="mb-2"><BulkBar formId="bulk-publier" noun="cours"
          actions={[{ label: 'Écarter', action: discardBulkAction, tone: 'danger', confirm: 'Écarter {n} ? Ils ne seront jamais visibles des élèves.' },
            { label: 'Publier la sélection', action: publishBulkAction, tone: 'primary', confirm: 'Publier {n} ? Les élèves les verront aussitôt.' }]} /></div>}
        {rows.map(r => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft first:border-t-0">
            {rows.length > 1 && <BulkCheck formId="bulk-publier" value={r.id} label={r.title} />}
            <span className="w-14 text-sm num muted">{r.code ?? '—'}</span>
            <span className="flex-[1_1_300px] min-w-0"><strong>{r.title}</strong><span className="block muted text-sm">{r.level} · {r.subject} · v{r.version}{r.replaces ? ` (remplacera la v${r.replaces} publiée)` : ' · nouveau cours'} · importé le {r.imported_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></span>
            {r.replaces && <Link className="btn" href={`/contenu/cours/${r.course_id}/comparer?v=${r.id}`}>Comparer</Link>}
            <Link className="btn btn-primary" href={`/contenu/cours/${r.course_id}?v=${r.id}`}>Relire et publier</Link>
          </div>
        ))}
      </section>
    </Screen>
  );
}
