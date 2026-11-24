import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { EmptyState } from '@/components/EmptyState';
import { BulkBar, BulkCheck } from '@/components/Bulk';

export const metadata = { title: 'Leçons à créer' };
export const dynamic = 'force-dynamic';

type Row = { ids: string[]; title: string; subject: string; level: string; objective: string; priority: number; times: number; last: Date; status: string };

// Les identifiants d'un groupe (même leçon proposée par plusieurs bilans) sont envoyés ensemble, séparés par des virgules
const idsOf = (form: FormData) => form.getAll('ids').flatMap(v => String(v).split(',')).filter(x => /^\d+$/.test(x));
async function setStatus(status: 'creee' | 'ecartee' | 'a_creer', form: FormData) {
  'use server';
  await requireUser('admin');
  const ids = idsOf(form);
  if (ids.length) await sql`update lesson_suggestions set status = ${status}, updated_at = now() where id in ${sql(ids)}`;
  revalidatePath('/contenu', 'layout');
}
const markDone = setStatus.bind(null, 'creee');
const dismiss = setStatus.bind(null, 'ecartee');
const reopen = setStatus.bind(null, 'a_creer');

export default async function ToCreate() {
  await requireUser('admin');
  const rows = await sql<Row[]>`
    select array_agg(id::text order by id) as ids, min(title) as title, min(subject) as subject, min(level) as level,
      (array_agg(objective order by created_at desc))[1] as objective, min(priority)::int as priority, count(*)::int as times, max(created_at) as last, status
    from lesson_suggestions
    group by lower(trim(title)), lower(trim(level)), lower(trim(subject)), status
    order by status = 'a_creer' desc, min(priority), count(*) desc, max(created_at) desc`;
  const open = rows.filter(r => r.status === 'a_creer'), closed = rows.filter(r => r.status !== 'a_creer').slice(0, 40);
  const prio = (p: number) => p <= 1 ? 'Urgente' : p === 2 ? 'Importante' : 'Utile';
  return (
    <Screen top={<PageTitle kicker="À créer" title={open.length ? `${open.length} leçon${open.length > 1 ? 's' : ''} de rattrapage à créer` : 'Aucune leçon à créer'}
      sub="Proposées par les bilans pédagogiques de l’IA pour combler les lacunes repérées (souvent des notions des années précédentes). Aucun nom d’élève ici." />}>
      {open.length === 0 ? <EmptyState title="Rien à créer pour l’instant" text="Quand un parent demande un bilan à l’IA, les leçons de rattrapage utiles apparaissent ici." /> : (
        <section className="card flex flex-col">
          <div className="mb-2"><BulkBar formId="bulk-a-creer" noun="leçon" feminine
            actions={[{ label: 'Marquer comme créées', action: markDone, tone: 'primary' }, { label: 'Écarter', action: dismiss, confirm: 'Écarter {n} ? Elles ne seront plus proposées dans cette liste.' }]} /></div>
          {open.map(r => (
            <div key={r.ids.join(',')} className="flex flex-wrap items-start gap-3 py-3 border-t border-soft text-sm">
              <BulkCheck formId="bulk-a-creer" value={r.ids.join(',')} label={r.title} />
              <span className="flex-[1_1_320px] min-w-0">
                <strong className="text-[15px]">{r.title}</strong>
                <span className="block muted">{r.subject} · niveau {r.level}{r.times > 1 ? ` · proposée ${r.times} fois` : ''}</span>
                <span className="block mt-1">{r.objective}</span>
              </span>
              <span className={`pill ${r.priority <= 1 ? 'bg-warm-soft text-warm-dark' : 'bg-soft text-ink-2'}`}>{prio(r.priority)}</span>
            </div>
          ))}
          <p className="muted text-xs mt-3 mb-0">Pour créer une leçon : Catalogue › préparer la consigne pour Claude, puis Importer le cours obtenu. Marquez-la ensuite comme créée.</p>
        </section>
      )}
      {closed.length > 0 && (
        <section className="card flex flex-col">
          <h2 className="text-lg font-semibold mb-2">Déjà traitées</h2>
          <div className="mb-2"><BulkBar formId="bulk-traitees" noun="leçon" feminine actions={[{ label: 'Remettre à créer', action: reopen }]} /></div>
          {closed.map(r => (
            <div key={r.ids.join(',')} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
              <BulkCheck formId="bulk-traitees" value={r.ids.join(',')} label={r.title} />
              <span className="flex-1"><strong>{r.title}</strong> <span className="muted">· {r.subject} · {r.level}</span></span>
              <span className="pill bg-soft text-ink-2">{r.status === 'creee' ? 'Créée' : 'Écartée'}</span>
            </div>
          ))}
        </section>
      )}
    </Screen>
  );
}
