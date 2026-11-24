import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { EmptyState } from '@/components/EmptyState';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { aiOverview } from '@/lib/ai';
import { AutoRefresh } from '@/components/AutoRefresh';

export const metadata = { title: 'Leçons à créer' };
export const dynamic = 'force-dynamic';

type Row = { ids: string[]; title: string; subject: string; level: string; objective: string; priority: number; times: number; last: Date; status: string; course_id: number | null; job: string | null; job_error: string | null; draft: boolean; published: boolean };

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

// Rédaction par l'IA : chaque groupe (même leçon proposée plusieurs fois) devient un cours « Remise à niveau », rédigé en arrière-plan
// Sans IA : la leçon est rangée au catalogue (chapitre « Remise à niveau »), la consigne se prépare ensuite pour Claude
async function addToCatalogue(form: FormData) {
  'use server';
  const u = await requireUser('admin');
  const { draftRemedialCourses } = await import('@/lib/automation');
  const errors: string[] = [];
  let added = 0;
  for (const group of form.getAll('ids').map(String)) {
    const r = await draftRemedialCourses(group.split(',').filter(x => /^\d+$/.test(x)), u.id, { draft: false });
    added += r.added; errors.push(...r.errors);
  }
  revalidatePath('/contenu', 'layout');
  redirect(`/contenu/a-creer?${new URLSearchParams({ ajoutees: String(added), ...(errors.length ? { erreur: errors.join(' · ').slice(0, 500) } : {}) })}`);
}

async function draftWithAi(form: FormData) {
  'use server';
  const u = await requireUser('admin');
  const { draftRemedialCourses } = await import('@/lib/automation');
  const errors: string[] = [];
  let queued = 0;
  for (const group of form.getAll('ids').map(String)) {
    const r = await draftRemedialCourses(group.split(',').filter(x => /^\d+$/.test(x)), u.id);
    queued += r.queued; errors.push(...r.errors);
  }
  revalidatePath('/contenu', 'layout');
  redirect(`/contenu/a-creer?${new URLSearchParams({ lancees: String(queued), ...(errors.length ? { erreur: errors.join(' · ').slice(0, 500) } : {}) })}`);
}

export default async function ToCreate({ searchParams }: { searchParams: Promise<{ lancees?: string; ajoutees?: string; erreur?: string }> }) {
  const sp = await searchParams;
  await requireUser('admin');
  const aiReady = (await aiOverview()).ready.cours;
  const rows = await sql<Row[]>`
    select array_agg(id::text order by id) as ids, min(title) as title, min(subject) as subject, min(level) as level,
      (array_agg(objective order by created_at desc))[1] as objective, min(priority)::int as priority, count(*)::int as times, max(created_at) as last, status,
      max(course_id) as course_id,
      (select j.status from jobs j where j.kind = 'cours' and j.payload->>'courseId' = max(g.course_id)::text order by j.id desc limit 1) as job,
      (select j.error from jobs j where j.kind = 'cours' and j.payload->>'courseId' = max(g.course_id)::text order by j.id desc limit 1) as job_error,
      exists (select 1 from course_versions v where v.course_id = max(g.course_id) and v.status = 'draft') as draft,
      exists (select 1 from course_versions v where v.course_id = max(g.course_id) and v.status = 'published') as published
    from lesson_suggestions g
    group by lower(trim(title)), lower(trim(level)), lower(trim(subject)), status
    order by status in ('a_creer', 'en_redaction') desc, min(priority), count(*) desc, max(created_at) desc`;
  const open = rows.filter(r => r.status === 'a_creer' || r.status === 'en_redaction'), closed = rows.filter(r => r.status === 'creee' || r.status === 'ecartee').slice(0, 40);
  const prio = (p: number) => p <= 1 ? 'Urgente' : p === 2 ? 'Importante' : 'Utile';
  return (
    <Screen top={<PageTitle kicker="À créer" title={open.length ? `${open.length} leçon${open.length > 1 ? 's' : ''} de rattrapage à créer` : 'Aucune leçon à créer'}
      sub="Proposées par les bilans pédagogiques de l’IA pour combler les lacunes repérées (souvent des notions des années précédentes). Aucun nom d’élève ici." />}>
      <AutoRefresh active={open.some(r => r.status === 'en_redaction' && r.job !== 'echec')} />
      {sp.lancees && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>{sp.lancees} leçon{Number(sp.lancees) > 1 ? 's' : ''} en cours de rédaction par l’IA.</strong> Elles arriveront en brouillon dans « À relire » (quelques minutes chacune). Une fois publiées, elles passent en tête du parcours des élèves concernés.</p>}
      {sp.ajoutees && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>{sp.ajoutees} leçon{Number(sp.ajoutees) > 1 ? 's' : ''} ajoutée{Number(sp.ajoutees) > 1 ? 's' : ''} au catalogue</strong> (chapitre « Remise à niveau »). Cliquez sur « Préparer la consigne » sur chacune, collez-la dans Claude, puis importez le cours obtenu.</p>}
      {sp.erreur && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm">{sp.erreur}</p>}
      {open.length === 0 ? <EmptyState title="Rien à créer pour l’instant" text="Quand un parent demande un bilan à l’IA, les leçons de rattrapage utiles apparaissent ici." /> : (
        <section className="card flex flex-col">
          <div className="mb-2"><BulkBar formId="bulk-a-creer" noun="leçon" feminine
            actions={[
              ...(aiReady ? [{ label: 'Rédiger avec l’IA', action: draftWithAi, tone: 'primary' as const, confirm: 'Faire rédiger {n} par l’IA ? Chacune devient un cours « Remise à niveau » et arrive en brouillon dans « À relire ».' }] : []),
              { label: 'Ajouter au catalogue', action: addToCatalogue, ...(aiReady ? {} : { tone: 'primary' as const }) },
              { label: 'Marquer comme créées', action: markDone }, { label: 'Écarter', action: dismiss, confirm: 'Écarter {n} ? Elles ne seront plus proposées dans cette liste.' }]} /></div>
          {open.map(r => (
            <div key={r.ids.join(',')} className="flex flex-wrap items-start gap-3 py-3 border-t border-soft text-sm">
              <BulkCheck formId="bulk-a-creer" value={r.ids.join(',')} label={r.title} />
              <span className="flex-[1_1_320px] min-w-0">
                <strong className="text-[15px]">{r.title}</strong>
                <span className="block muted">{r.subject} · niveau {r.level}{r.times > 1 ? ` · proposée ${r.times} fois` : ''}</span>
                <span className="block mt-1">{r.objective}</span>
              </span>
              <span className={`pill ${r.priority <= 1 ? 'bg-warm-soft text-warm-dark' : 'bg-soft text-ink-2'}`}>{prio(r.priority)}</span>
              {r.status === 'a_creer' && r.course_id && (r.draft
                ? <Link className="pill bg-brand-soft text-brand-dark no-underline" href={`/contenu/cours/${r.course_id}`}>Brouillon importé : à relire</Link>
                : <Link className="btn" href={`/contenu/generer/${r.course_id}`}>Préparer la consigne</Link>)}
              {r.status === 'en_redaction' && (r.job === 'echec'
                ? <span className="pill bg-warm-soft text-warm-dark" data-tip={r.job_error ?? undefined}>Échec de la rédaction : relancez-la</span>
                : <span className="pill bg-accent-soft text-ink-2">Rédaction IA en cours…</span>)}
            </div>
          ))}
          <p className="muted text-xs mt-3 mb-0">{aiReady ? '« Rédiger avec l’IA » : la leçon devient un cours du chapitre « Remise à niveau » (au niveau de l’élève), rédigé puis placé en brouillon dans « À relire ». À la publication, elle passe en tête du parcours des élèves concernés.' : '« Ajouter au catalogue » range la leçon dans le chapitre « Remise à niveau » (au niveau de l’élève). Puis « Préparer la consigne », la coller dans Claude, et importer le cours obtenu (Contenu › Importer) : il arrive dans « À relire ». À la publication, il passe en tête du parcours des élèves concernés.'}</p>
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
              {r.status === 'creee' && r.course_id && r.draft ? <Link className="pill bg-brand-soft text-brand-dark no-underline" href={`/contenu/cours/${r.course_id}`}>Brouillon prêt : à relire</Link>
                : <span className="pill bg-soft text-ink-2">{r.status === 'creee' ? 'Créée' : 'Écartée'}</span>}
            </div>
          ))}
        </section>
      )}
    </Screen>
  );
}
