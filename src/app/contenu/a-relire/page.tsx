import Link from 'next/link';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { EmptyState } from '@/components/EmptyState';

export const metadata = { title: 'À relire' };
export const dynamic = 'force-dynamic';

// Brouillons importés qui attendent une relecture avant publication
export default async function ToReview() {
  const rows = await sql<{ course_id: number; id: string; version: number; code: string | null; title: string; subject: string; imported_at: Date; source_name: string | null; replaces: number | null }[]>`
    select v.course_id, v.id, v.version, c.code, c.title, s.name as subject, v.imported_at, v.source_name,
      (select w.version from course_versions w where w.course_id = v.course_id and w.status = 'published') as replaces
    from course_versions v join courses c on c.id = v.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
    where v.status = 'draft' and v.version = (select max(version) from course_versions x where x.course_id = v.course_id)
    order by v.imported_at desc`;
  return (
    <Screen top={<PageTitle kicker="À relire" title={rows.length ? `${rows.length} cours à relire avant publication` : 'Rien à relire'}
      sub="Chaque import arrive ici en brouillon. Relisez la vue complète (corrigés compris), puis publiez : les élèves le voient aussitôt.">
      <Link className="btn btn-primary" href="/contenu/importer">Importer un cours</Link>
    </PageTitle>}>
      <section className="card flex flex-col">
        {rows.length === 0 && <EmptyState title="Aucun brouillon en attente" text="Préparez une consigne depuis le catalogue, collez-la dans Claude, puis importez le JSON obtenu." action={<Link className="btn" href="/contenu">Ouvrir le catalogue</Link>} />}
        {rows.map(r => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft first:border-t-0">
            <span className="w-14 text-sm num muted">{r.code ?? '—'}</span>
            <span className="flex-[1_1_300px] min-w-0"><strong>{r.title}</strong><span className="block muted text-sm">{r.subject} · v{r.version}{r.replaces ? ` (remplacera la v${r.replaces} publiée)` : ' · nouveau cours'} · importé le {r.imported_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></span>
            <Link className="btn btn-primary" href={`/contenu/cours/${r.course_id}?v=${r.id}`}>Relire et publier</Link>
          </div>
        ))}
      </section>
    </Screen>
  );
}
