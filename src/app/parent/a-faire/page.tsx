import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { ImportCorrections } from '../copies/ImportCorrections';
import { decideEvalRequest, approveRequestsBulk, postponeRequestsBulk, dismissPasswordRequests, answerPasswordRequest } from '../actions';
import { KeyRound } from 'lucide-react';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { aiOverview } from '@/lib/ai';
import { correctWithAiAction, validateProposalsBulk } from '../copies/actions';
import { AiButton } from './AiButton';
import { AutoRefresh } from '@/components/AutoRefresh';

export const metadata = { title: 'À faire' };
export const dynamic = 'force-dynamic';

type Row = { id: string; title: string; first_name: string; attempt_no: number; status: string; submitted_at: Date | null; requested_at: Date | null; final_score: string | null; has_proposal: boolean; ai_running: boolean };
const when = (d: Date | null) => d ? d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

// Tout ce qui attend une action du parent, pour tous les enfants du foyer
export default async function ToDo({ searchParams }: { searchParams: Promise<{ validee?: string; mdp?: string; erreur?: string; ia?: string; iaerr?: string; validees?: string }> }) {
  const sp = await searchParams;
  const { students, user } = await requireParent();
  const aiOn = (await aiOverview()).ready.correction;
  const ids = students.map(s => s.id);
  const rows = ids.length ? await sql<Row[]>`
    select a.id, c.title, s.first_name, a.attempt_no, a.status, a.submitted_at, a.requested_at, a.final_score, (a.proposal is not null) as has_proposal,
      exists (select 1 from jobs j where j.kind = 'correction' and j.payload->>'attemptId' = a.id::text and j.status in ('en_attente', 'en_cours')) as ai_running
    from eval_attempts a join courses c on c.id = a.course_id join students s on s.id = a.student_id
    where a.student_id in ${sql(ids)} and a.status in ('requested', 'submitted', 'graded')
    order by a.status = 'graded', coalesce(a.submitted_at, a.requested_at) desc limit 80` : [];
  const requests = rows.filter(r => r.status === 'requested');
  const pending = rows.filter(r => r.status === 'submitted');
  const graded = rows.filter(r => r.status === 'graded').slice(0, 20);
  const toAi = pending.filter(r => !r.has_proposal && !r.ai_running);
  const multi = students.length > 1;
  const pwRequests = ids.length ? await sql<{ id: string; student_id: string; first_name: string; created_at: Date }[]>`
    select r.id::text, s.id as student_id, s.first_name, r.created_at from password_requests r join students s on s.user_id = r.user_id
    where s.id in ${sql(ids)} and r.done_at is null order by r.created_at` : [];
  const total = requests.length + pending.length + pwRequests.length;

  return (
    <Screen top={<PageTitle kicker="À faire" title={total ? `${total} chose${total > 1 ? 's' : ''} attend${total > 1 ? 'ent' : ''} votre réponse` : 'Rien n’attend votre réponse'}
      sub="Demandes d’évaluation, mots de passe oubliés et copies à valider. Les questions automatiques sont déjà notées ; les réponses rédigées passent par Claude, puis par vous." />}>
      <AutoRefresh active={pending.some(r => r.ai_running)} />
      {sp.ia !== undefined && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>{Number(sp.ia) > 0 ? `${sp.ia} copie${Number(sp.ia) > 1 ? 's' : ''} corrigée${Number(sp.ia) > 1 ? 's' : ''} par l’IA.` : 'Aucune copie corrigée par l’IA.'}</strong> {Number(sp.ia) > 0 && 'Vérifiez les propositions puis validez (une par une, ou toutes d’un coup avec la sélection).'}</p>}
      {sp.iaerr && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm"><strong>Problème :</strong> {sp.iaerr}</p>}
      {sp.validees !== undefined && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>{sp.validees} note{Number(sp.validees) > 1 ? 's' : ''} validée{Number(sp.validees) > 1 ? 's' : ''}.</strong> Les bilans sont visibles dans l’espace de l’élève.</p>}
      {sp.mdp && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>Mot de passe de {sp.mdp} modifié.</strong> Communiquez-le-lui : la connexion est possible tout de suite.</p>}
      {sp.erreur && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm">{sp.erreur}</p>}
      {sp.validee && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>Note validée.</strong> Le bilan est maintenant visible dans l’espace de l’élève.</p>}

      {pwRequests.length > 0 && (
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2"><KeyRound size={20} aria-hidden="true" />Mot de passe oublié</h2>
          <div className="mb-2"><BulkBar formId="bulk-mdp" noun="demande" feminine
            actions={[{ label: 'Marquer comme réglée', action: dismissPasswordRequests }]} /></div>
          {pwRequests.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
              <BulkCheck formId="bulk-mdp" value={r.id} label={r.first_name} />
              <span className="flex-[1_1_220px]"><strong>{r.first_name} a oublié son mot de passe</strong><span className="block muted">Demandé le {when(r.created_at)} · choisissez-en un nouveau et donnez-le-lui</span></span>
              <form action={answerPasswordRequest.bind(null, r.student_id)} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-sm font-semibold">Nouveau mot de passe<input className="field" name="password" type="text" required minLength={8} autoComplete="off" placeholder="8 caractères min." /></label>
                <button className="btn btn-primary" type="submit">Enregistrer</button>
              </form>
            </div>
          ))}
        </section>
      )}

      {requests.length > 0 && (
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Demandes d’évaluation</h2>
          {requests.length > 1 && <div className="mb-2"><BulkBar formId="bulk-demandes" noun="demande" feminine
            actions={[{ label: 'Autoriser', action: approveRequestsBulk, tone: 'primary' }, { label: 'Pas maintenant', action: postponeRequestsBulk, confirm: 'Refuser pour l’instant {n} ? L’élève pourra refaire sa demande plus tard.' }]} /></div>}
          {requests.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
              {requests.length > 1 && <BulkCheck formId="bulk-demandes" value={r.id} label={r.title} />}
              <span className="flex-[1_1_260px]"><strong>{multi ? `${r.first_name} · ` : ''}{r.title}</strong><span className="block muted">Demandée le {when(r.requested_at)}</span></span>
              <form action={decideEvalRequest.bind(null, r.id, true)}><button className="btn btn-primary" type="submit">Autoriser</button></form>
              <form action={decideEvalRequest.bind(null, r.id, false)}><button className="btn" type="submit" data-tip="La demande est refusée pour l’instant ; l’élève pourra la refaire.">Pas maintenant</button></form>
            </div>
          ))}
        </section>
      )}

      <section className="card flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-xl font-semibold">Copies à valider</h2>
          <span className="flex flex-wrap gap-2">
            {aiOn && toAi.length > 0 && <form action={correctWithAiAction}>{toAi.map(r => <input key={r.id} type="hidden" name="ids" value={r.id} />)}<AiButton n={toAi.length} /></form>}
            {pending.length > 0 && <a className={`btn ${aiOn ? '' : 'btn-primary'}`} href="/api/parent/export">Tout exporter pour Claude ({pending.length})</a>}
          </span>
        </div>
        {pending.length === 0 && <span className="muted text-sm py-2">Aucune copie en attente.</span>}
        {pending.length > 0 && <div className="mb-2"><BulkBar formId="bulk-copies" noun="copie" feminine
          actions={[
            ...(aiOn ? [{ label: 'Corriger la sélection avec l’IA', action: correctWithAiAction, tone: 'primary' as const }] : []),
            { label: 'Valider les notes proposées', action: validateProposalsBulk, confirm: 'Valider telles quelles les notes proposées pour {n} ? (les copies sans proposition sont ignorées)' },
            { label: 'Exporter la sélection pour Claude', action: '/api/parent/export', ...(aiOn ? {} : { tone: 'primary' as const }) }]} /></div>}
        {!aiOn && pending.length > 0 && <p className="muted text-sm mt-0 mb-2">Astuce : avec une IA branchée, les copies se corrigent en un clic. {user.roles.includes('admin') ? <Link href="/contenu/ia" className="font-semibold">Brancher une IA de correction</Link> : 'Demandez à l’administrateur de la brancher (espace Contenu › IA de correction).'}</p>}
        {pending.map(r => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
            {pending.length > 0 && <BulkCheck formId="bulk-copies" value={r.id} label={r.title} />}
            <span className="flex-[1_1_260px]"><strong>{multi ? `${r.first_name} · ` : ''}{r.title}</strong><span className="block muted">Tentative {r.attempt_no} · remise le {when(r.submitted_at)}</span></span>
            <span className={`pill ${r.has_proposal ? 'bg-brand-soft text-brand-dark' : 'bg-soft text-ink-2'}`}>{r.has_proposal ? 'Pré-corrigée' : r.ai_running ? 'Correction IA en cours…' : aiOn ? 'À corriger' : 'À exporter'}</span>
            <Link className="btn" href={`/parent/copies/${r.id}`}>{r.has_proposal ? 'Vérifier et valider' : 'Corriger moi-même'}</Link>
          </div>
        ))}
        {pending.length > 0 && (
          <details className="mt-3 rounded-xl bg-surface-2 border border-line px-4 py-3">
            <summary className="cursor-pointer font-semibold text-sm">Importer la réponse de Claude · mode d’emploi</summary>
            <ol className="mt-3 mb-4 pl-5 list-decimal flex flex-col gap-1.5 text-sm">
              <li><strong>Exporter</strong> : un fichier sans nom d’élève, avec questions, réponses, corrigés, barèmes et la consigne pour Claude.</li>
              <li>Le donner à <strong>Claude</strong> sur claude.ai : « Corrige ces copies en suivant la consigne du fichier ». Il répond par un JSON.</li>
              <li><strong>Importer</strong> ce JSON ci-dessous, puis ouvrir chaque copie pour vérifier et valider la note.</li>
            </ol>
            <ImportCorrections />
          </details>
        )}
      </section>

      {graded.length > 0 && (
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Notées récemment</h2>
          {graded.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
              <span className="flex-[1_1_260px]"><strong>{multi ? `${r.first_name} · ` : ''}{r.title}</strong> · tentative {r.attempt_no}</span>
              <strong className="w-16">{Number(r.final_score).toLocaleString('fr-FR')}/20</strong>
              <Link href={`/parent/revoir/copie/${r.id}`} className="font-semibold">Revoir</Link>
            </div>
          ))}
        </section>
      )}
    </Screen>
  );
}
