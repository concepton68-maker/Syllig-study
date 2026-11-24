import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { aiOverview, TASKS, defaultModel, type Task } from '@/lib/ai';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { ConfirmButton } from '@/components/ConfirmButton';
import { KeyForm, TaskForm, RunAutoButton, AssignTable, AddKey } from './Form';
import { removeKey, retryJobs, deleteJobs } from './actions';
import { sql } from '@/lib/db';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { AutoRefresh } from '@/components/AutoRefresh';

export const metadata = { title: 'IA' };
export const dynamic = 'force-dynamic';

export default async function AiPage() {
  await requireUser('admin');
  const o = await aiOverview();
  const all = Object.values(o.catalog).map(info => ({ ...info, hint: o.providers[info.id]?.key_hint, models: o.providers[info.id]?.models ?? [] }));
  const providers = all.filter(p => p.hint);   // seuls les fournisseurs enregistrés sont affichés ; « + » pour en ajouter
  // fonctions attribuables : la liste centrale TASKS (une nouvelle fonction y apparaît d'elle-même)
  const tasks = (Object.keys(TASKS) as Task[]).map(id => ({ id, ...TASKS[id] }));
  const keyed = providers.map(p => ({ id: p.id, name: p.name, eu: p.eu, where: p.where, models: p.models,
    defaults: Object.fromEntries(tasks.map(t => [t.id, defaultModel(p, p.models, t.id)])) }));
  const jobs = await sql<{ id: string; kind: string; status: string; attempts: number; error: string | null; created_at: Date; finished_at: Date | null; started_at: Date | null; progress: string | null; label: string | null }[]>`
    select j.id::text, j.kind, j.status, j.attempts, j.error, j.created_at, j.finished_at, j.started_at, j.progress,
      coalesce(c.title, s.first_name, (select title from courses x join eval_attempts a on a.course_id = x.id where a.id::text = j.payload->>'attemptId')) as label
    from jobs j left join courses c on c.id::text = j.payload->>'courseId' left join students s on s.id::text = j.payload->>'studentId'
    order by j.id desc limit 40`;
  return (
    <Screen top={<PageTitle kicker="IA" title="Intelligence artificielle"
      sub="L’IA propose, vous validez. Les données d’élèves ne partent que chez une IA européenne, sauf dérogation explicite." />}>
      {!o.enabled && <p role="status" className="m-0 max-w-[860px] rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm"><strong>L’IA est désactivée</strong> : rien n’est envoyé (Réglages généraux, plus bas).</p>}

      {/* 1. On part de ce qu'on veut faire : une ligne par fonction */}
      <section className="card max-w-[860px] flex flex-col gap-3" aria-labelledby="qui">
        <h2 id="qui" className="text-xl font-semibold m-0">1. Qui fait quoi</h2>
        <p className="m-0 muted text-sm">Pour chaque fonction, l’IA qui s’en charge. Seules les IA dont vous avez enregistré la clé (plus bas) sont proposées.</p>
        <AssignTable tasks={tasks} providers={keyed} current={o.tasks} allowNonEu={o.allow_non_eu} />
      </section>

      {/* 2. Les clés, réglées une fois */}
      <section className="card max-w-[860px] flex flex-col gap-2" aria-labelledby="cles">
        <h2 id="cles" className="text-xl font-semibold m-0">2. Mes clés</h2>
        <p className="m-0 muted text-sm">Une clé par fournisseur d’IA. Elle est vérifiée auprès du fournisseur, puis enregistrée chiffrée.</p>
        {providers.map(p => (
          <div key={p.id} className="flex flex-col gap-2 py-2.5 border-t border-soft">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <strong className="text-[15px] min-w-[150px]">{p.name}</strong>
              <span className="muted">clé ✓ {p.hint}</span>
              <span className={`pill ${p.eu ? 'bg-brand-soft text-brand-dark' : 'bg-warm-soft text-warm-dark'}`}>{p.eu ? 'Europe' : p.where}</span>
              <span className="muted text-xs">{tasks.filter(t => o.tasks[t.id]?.provider === p.id).map(t => t.label).join(' · ') || 'aucune fonction'}</span>
              <span className="ml-auto flex gap-2">
                <form action={removeKey.bind(null, p.id)}><ConfirmButton className="btn btn-danger !min-h-0 !py-1.5" danger confirmLabel="Retirer"
                  message={`Retirer la clé ${p.name} ? Les fonctions qu’il assure n’auront plus d’IA.`}>Retirer</ConfirmButton></form>
              </span>
            </div>
            <details className="text-sm"><summary className="cursor-pointer muted">Changer la clé</summary><div className="mt-2"><KeyForm p={p} /></div></details>
          </div>
        ))}
        <AddKey configured={providers.map(p => p.id)} open={providers.length === 0} />
      </section>

      <section className="card max-w-[860px] flex flex-col gap-4" aria-labelledby="taches">
        <h2 id="taches" className="text-xl font-semibold m-0">3. Réglages généraux</h2>
        <TaskForm enabled={o.enabled} allowNonEu={o.allow_non_eu} retention={o.retention_days} autoCours={o.auto_cours} />
      </section>

      <section className="card max-w-[860px] flex flex-col gap-3" aria-labelledby="file">
        <h2 id="file" className="text-xl font-semibold m-0">4. Travail en arrière-plan</h2>
        <p className="m-0 text-sm muted">Corrections et bilans automatiques, rédaction de cours. Les automatismes sont vérifiés toutes les 30 minutes.</p>
        <AutoRefresh active={jobs.some(j => j.status === 'en_attente' || j.status === 'en_cours')} />
        <RunAutoButton />
        {jobs.length === 0 ? <p className="m-0 text-sm">Aucune tâche pour l’instant.</p> : (
          <>
            <BulkBar formId="bulk-jobs" noun="tâche" feminine actions={[{ label: 'Relancer', action: retryJobs, tone: 'primary' }, { label: 'Retirer', action: deleteJobs, confirm: 'Retirer {n} de la liste ?' }]} />
            {jobs.map(j => (
              <div key={j.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-soft text-sm">
                <BulkCheck formId="bulk-jobs" value={j.id} label={`tâche ${j.id}`} />
                <span className="flex-1 min-w-0"><strong>{({ correction: 'Correction', bilan: 'Bilan', cours: 'Rédaction du cours' } as Record<string, string>)[j.kind]}</strong>{j.label ? ` · ${j.label}` : ''}
                  <span className="block muted text-xs">{j.created_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{j.status === 'en_cours' && j.started_at ? ` · en cours depuis ${Math.max(1, Math.round((Date.now() - j.started_at.getTime()) / 60000))} min${j.progress ? ` · ${j.progress}` : ''}` : ''}{j.attempts > 1 ? ` · tentative ${j.attempts}/3` : ''}{j.error ? ` · erreur précédente : ${j.error}` : ''}</span></span>
                <span className={`pill ${j.status === 'fait' ? 'bg-brand-soft text-brand-dark' : j.status === 'echec' ? 'bg-warm-soft text-warm-dark' : 'bg-soft text-ink-2'}`}>{({ en_attente: 'En attente', en_cours: 'En cours', fait: 'Terminé', echec: 'Échec' } as Record<string, string>)[j.status]}</span>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="card max-w-[860px] flex flex-col gap-2 text-sm">
        <h2 className="text-lg font-semibold m-0 flex items-center gap-2"><ShieldCheck size={18} aria-hidden="true" />Protection des données</h2>
        <ul className="m-0 pl-5 list-disc flex flex-col gap-1.5">
          <li>Rien n’est envoyé pour un enfant sans l’accord de son parent (Famille › Bilan › Confidentialité et IA).</li>
          <li>Jamais de nom : prénoms, identifiants, e-mails, téléphones et adresses sont retirés des réponses avant l’envoi.</li>
          <li>Chaque envoi est consigné ; le parent voit exactement ce qui est parti, chez qui et quand.</li>
          <li>Utilisez une offre <strong>payante</strong> : les offres gratuites peuvent réutiliser les données.</li>
          <li>Les clés sont vérifiées auprès du fournisseur, puis enregistrées chiffrées ; elles ne sont jamais réaffichées.</li>
        </ul>
        <Link href="/confidentialite" className="font-semibold">Voir la page Confidentialité (pour les parents)</Link>
      </section>
    </Screen>
  );
}
