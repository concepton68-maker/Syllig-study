import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { diffCourse } from '@/lib/course-diff';

export const metadata = { title: 'Comparer deux versions' };
export const dynamic = 'force-dynamic';

// « Comparer » (maquette validée le 27/11/2026) : l'ancien et le nouveau texte côte à côte, seulement ce qui a changé.
// Par défaut, la version comparée est celle qui la précède (la version publiée ou le brouillon d'avant).
export default async function Compare({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; avec?: string }> }) {
  await requireUser('admin');
  const { id } = await params;
  const sp = await searchParams;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();
  const vs = await sql<{ id: string; version: number; status: string; document: Record<string, unknown> }[]>`
    select id, version, status, document from course_versions where course_id = ${courseId} order by version desc`;
  const [c] = await sql<{ code: string | null; title: string }[]>`select code, title from courses where id = ${courseId}`;
  if (!c || !vs.length) notFound();
  const after = vs.find(x => x.id === sp.v) ?? vs[0];
  const before = vs.find(x => x.id === sp.avec) ?? vs.find(x => x.version < after.version);
  const changes = before ? diffCourse(before.document, after.document) : [];
  const groups = [...new Set(changes.map(x => x.group))];
  const st = (s: string) => s === 'published' ? 'publiée' : s === 'draft' ? 'brouillon' : 'archivée';
  return (
    <Screen top={<PageTitle kicker={`${c.code ?? ''} · comparer`} title={c.title}
      sub={before ? `v${before.version} (${st(before.status)}) → v${after.version} (${st(after.status)}) · ${changes.length} changement${changes.length > 1 ? 's' : ''} dans ${groups.length} partie${groups.length > 1 ? 's' : ''}` : 'Première version : rien à comparer.'}>
      <Link className="btn" href={`/contenu/cours/${courseId}?v=${after.id}`}>Voir la v{after.version} en entier</Link>
    </PageTitle>}>
      {before && changes.length === 0 && <p className="card m-0">Aucune différence entre ces deux versions.</p>}
      {groups.map(g => (
        <section key={g} className="card flex flex-col gap-2" data-compare-group={g}>
          <h2 className="text-base font-semibold m-0">{g}</h2>
          <div className="hidden md:grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs font-semibold uppercase tracking-wide muted"><span /><span>Avant · v{before!.version}</span><span>Après · v{after.version}</span></div>
          {changes.filter(x => x.group === g).map((x, i) => (
            <div key={i} className="grid md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 py-2 border-t border-soft text-sm" data-compare-row>
              <strong>{x.field || '—'}</strong>
              <span className={`whitespace-pre-wrap rounded-lg px-2.5 py-1.5 ${x.before === null ? 'muted italic' : 'bg-warm-soft'}`}>{x.before ?? 'absent'}</span>
              <span className={`whitespace-pre-wrap rounded-lg px-2.5 py-1.5 ${x.after === null ? 'muted italic' : 'bg-brand-soft'}`} data-compare-after>{x.after ?? 'supprimé'}</span>
            </div>
          ))}
        </section>
      ))}
    </Screen>
  );
}
