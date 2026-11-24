import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { ImportCorrections } from '../copies/ImportCorrections';
import { decideEvalRequest, approveRequestsBulk, postponeRequestsBulk } from '../actions';
import { BulkBar, BulkCheck } from '@/components/Bulk';

export const metadata = { title: 'À faire' };
export const dynamic = 'force-dynamic';

type Row = { id: string; title: string; first_name: string; attempt_no: number; status: string; submitted_at: Date | null; requested_at: Date | null; final_score: string | null; has_proposal: boolean };
const when = (d: Date | null) => d ? d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

// Tout ce qui attend une action du parent, pour tous les enfants du foyer
export default async function ToDo({ searchParams }: { searchParams: Promise<{ validee?: string }> }) {
  const sp = await searchParams;
  const { students } = await requireParent();
  const ids = students.map(s => s.id);
  const rows = ids.length ? await sql<Row[]>`
    select a.id, c.title, s.first_name, a.attempt_no, a.status, a.submitted_at, a.requested_at, a.final_score, (a.proposal is not null) as has_proposal
    from eval_attempts a join courses c on c.id = a.course_id join students s on s.id = a.student_id
    where a.student_id in ${sql(ids)} and a.status in ('requested', 'submitted', 'graded')
    order by a.status = 'graded', coalesce(a.submitted_at, a.requested_at) desc limit 80` : [];
  const requests = rows.filter(r => r.status === 'requested');
  const pending = rows.filter(r => r.status === 'submitted');
  const graded = rows.filter(r => r.status === 'graded').slice(0, 20);
  const multi = students.length > 1;
  const total = requests.length + pending.length;

  return (
    <Screen top={<PageTitle kicker="À faire" title={total ? `${total} chose${total > 1 ? 's' : ''} attend${total > 1 ? 'ent' : ''} votre réponse` : 'Rien n’attend votre réponse'}
      sub="Demandes d’évaluation et copies à valider. Les questions automatiques sont déjà notées ; les réponses rédigées passent par Claude, puis par vous." />}>
      {sp.validee && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>Note validée.</strong> Le bilan est maintenant visible dans l’espace de l’élève.</p>}

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
              <form action={decideEvalRequest.bind(null, r.id, false)}><button className="btn" type="submit" title="La demande est refusée pour l’instant ; l’élève pourra la refaire.">Pas maintenant</button></form>
            </div>
          ))}
        </section>
      )}

      <section className="card flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-xl font-semibold">Copies à valider</h2>
          {pending.length > 0 && <a className="btn btn-primary" href="/api/parent/export">Tout exporter pour Claude ({pending.length})</a>}
        </div>
        {pending.length === 0 && <span className="muted text-sm py-2">Aucune copie en attente.</span>}
        {pending.length > 1 && <div className="mb-2"><BulkBar formId="bulk-copies" noun="copie" feminine
          actions={[{ label: 'Exporter la sélection pour Claude', action: '/api/parent/export', tone: 'primary' }]} /></div>}
        {pending.map(r => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
            {pending.length > 1 && <BulkCheck formId="bulk-copies" value={r.id} label={r.title} />}
            <span className="flex-[1_1_260px]"><strong>{multi ? `${r.first_name} · ` : ''}{r.title}</strong><span className="block muted">Tentative {r.attempt_no} · remise le {when(r.submitted_at)}</span></span>
            <span className={`pill ${r.has_proposal ? 'bg-brand-soft text-brand-dark' : 'bg-soft text-ink-2'}`}>{r.has_proposal ? 'Pré-corrigée par Claude' : 'À exporter'}</span>
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
              <Link href={`/parent/copies/${r.id}`} className="font-semibold">Voir</Link>
            </div>
          ))}
        </section>
      )}
    </Screen>
  );
}
