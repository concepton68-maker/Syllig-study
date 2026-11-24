import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { aiOverview, TASKS } from '@/lib/ai';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { ConfirmButton } from '@/components/ConfirmButton';
import { KeyForm, TaskForm, RunAutoButton, AddProviderForm } from './Form';
import { removeKey, retryJobs, deleteJobs } from './actions';
import { sql } from '@/lib/db';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { AutoRefresh } from '@/components/AutoRefresh';

export const metadata = { title: 'IA' };
export const dynamic = 'force-dynamic';

export default async function AiPage() {
  await requireUser('admin');
  const o = await aiOverview();
  const providers = Object.values(o.catalog).map(info => ({ ...info, hint: o.providers[info.id]?.key_hint, models: o.providers[info.id]?.models ?? [] }));
  const jobs = await sql<{ id: string; kind: string; status: string; attempts: number; error: string | null; created_at: Date; finished_at: Date | null; started_at: Date | null; progress: string | null; label: string | null }[]>`
    select j.id::text, j.kind, j.status, j.attempts, j.error, j.created_at, j.finished_at, j.started_at, j.progress,
      coalesce(c.title, s.first_name, (select title from courses x join eval_attempts a on a.course_id = x.id where a.id::text = j.payload->>'attemptId')) as label
    from jobs j left join courses c on c.id::text = j.payload->>'courseId' left join students s on s.id::text = j.payload->>'studentId'
    order by j.id desc limit 40`;
  const status = (t: 'correction' | 'bilan' | 'cours') => { const c = o.tasks[t]; return c ? `${o.catalog[c.provider]?.name ?? c.provider} · ${c.model}${o.ready[t] ? '' : ' (bloqué)'}` : 'aucune IA'; };
  return (
    <Screen top={<PageTitle kicker="IA" title="IA de correction et de bilan"
      sub="L’IA propose ; le parent valide toujours les notes. Les données d’élèves ne partent que chez un fournisseur européen, sauf dérogation explicite." />}>
      <section className="card max-w-[860px] flex flex-col gap-1 text-sm" aria-label="État">
        <p className="m-0">État : {o.enabled ? <strong className="text-brand-dark">active</strong> : <strong>désactivée</strong>}</p>
        <p className="m-0">Correction des copies : <strong>{status('correction')}</strong></p>
        <p className="m-0">Bilan et test de positionnement : <strong>{status('bilan')}</strong></p>
        <p className="m-0">Rédaction des cours : <strong>{status('cours')}</strong>{o.auto_cours ? ' · leçons de rattrapage rédigées automatiquement' : ''}</p>
      </section>

      <section className="card max-w-[860px] flex flex-col gap-4" aria-labelledby="cles">
        <h2 id="cles" className="text-xl font-semibold m-0">1. Clés des fournisseurs</h2>
        {providers.map(p => (
          <div key={p.id} className="rounded-2xl border border-line p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-[16px]">{p.name}</strong>
              <span className={`pill ${p.eu ? 'bg-brand-soft text-brand-dark' : 'bg-warm-soft text-warm-dark'}`}>{p.eu ? 'Données traitées dans l’Union européenne' : p.where === 'États-Unis' ? 'Données traitées aux États-Unis' : `Données traitées hors UE (${p.where})`}</span>
              {p.custom && <span className="pill bg-soft text-ink-2">Ajouté · compatible OpenAI</span>}
              {p.hint && <span className="pill bg-soft text-ink-2">Clé {p.hint} · {p.models.length} modèle{p.models.length > 1 ? 's' : ''}</span>}
              {(p.hint || p.custom) && <form action={removeKey.bind(null, p.id)} className="ml-auto"><ConfirmButton className="btn btn-danger" danger
                confirmLabel={p.custom ? 'Retirer ce fournisseur' : 'Retirer la clé'}
                message={p.custom ? `Retirer ${p.name} (et sa clé) ? Les tâches qui l’utilisent n’auront plus d’IA.` : `Retirer la clé ${p.name} ? Les tâches qui l’utilisent n’auront plus d’IA.`}>{p.custom ? 'Retirer ce fournisseur' : 'Retirer la clé'}</ConfirmButton></form>}
            </div>
            <KeyForm p={p} />
          </div>
        ))}
        <AddProviderForm />
      </section>

      <section className="card max-w-[860px] flex flex-col gap-4" aria-labelledby="taches">
        <h2 id="taches" className="text-xl font-semibold m-0">2. Quelle IA pour quelle tâche</h2>
        <TaskForm providers={providers} tasks={(Object.keys(TASKS) as (keyof typeof TASKS)[]).map(id => ({ id, ...TASKS[id] }))}
          current={o.tasks} enabled={o.enabled} allowNonEu={o.allow_non_eu} retention={o.retention_days} autoCours={o.auto_cours} />
      </section>

      <section className="card max-w-[860px] flex flex-col gap-3" aria-labelledby="file">
        <h2 id="file" className="text-xl font-semibold m-0">3. Travail en arrière-plan</h2>
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
