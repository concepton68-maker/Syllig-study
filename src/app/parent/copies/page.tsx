import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { ImportCorrections } from './ImportCorrections';

export const metadata = { title: 'Copies à corriger' };
export const dynamic = 'force-dynamic';

type Row = { id: string; title: string; attempt_no: number; status: string; submitted_at: Date; final_score: string | null; has_proposal: boolean; auto_only: boolean };

export default async function Copies({ searchParams }: { searchParams: Promise<{ eleve?: string; validee?: string }> }) {
  const sp = await searchParams;
  const { students, student } = await requireParent(sp.eleve);
  if (!student) return null;
  const rows = await sql<Row[]>`
    select a.id, c.title, a.attempt_no, a.status, a.submitted_at, a.final_score, (a.proposal is not null) as has_proposal, false as auto_only
    from eval_attempts a join courses c on c.id = a.course_id
    where a.student_id = ${student.id} and a.status in ('submitted', 'graded') order by a.status = 'submitted' desc, a.submitted_at desc limit 60`;
  const pending = rows.filter(r => r.status === 'submitted');
  const graded = rows.filter(r => r.status === 'graded');
  return (
    <>
      <ChildPicker students={students} current={student} path="/parent/copies" />
      <PageTitle kicker="Copies à corriger" title={pending.length ? `${pending.length} copie${pending.length > 1 ? 's' : ''} de ${student.first_name} en attente` : 'Aucune copie en attente'}
        sub="Les questions automatiques sont déjà notées. Les réponses rédigées sont corrigées par Claude, puis validées par vous." />
      {sp.validee && <p role="status" className="m-0 rounded-xl bg-brand-soft text-[#1E2A78] px-4 py-3 text-sm"><strong>Note validée.</strong> Le bilan est maintenant visible dans l’espace de {student.first_name}.</p>}

      <section className="card flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Corriger avec Claude, en 3 étapes</h2>
        <ol className="m-0 pl-5 list-decimal flex flex-col gap-2 text-[15px]">
          <li><strong>Exporter</strong> les copies en attente : un fichier sans nom d’élève, avec questions, réponses, corrigés, barèmes et la consigne pour Claude.
            <div className="mt-2"><a className={`btn ${pending.length ? 'btn-primary' : 'pointer-events-none opacity-50'}`} href={`/api/parent/export?eleve=${student.id}`} aria-disabled={!pending.length}>Exporter les copies ({pending.length})</a></div></li>
          <li><strong>Donner ce fichier à Claude</strong> sur claude.ai, avec ce message : « Corrige ces copies en suivant la consigne du fichier. » Claude répond par un fichier JSON.</li>
          <li><strong>Importer</strong> sa réponse ci-dessous, puis ouvrir chaque copie pour vérifier et valider la note.</li>
        </ol>
        <ImportCorrections />
      </section>

      {pending.length > 0 && (
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2">En attente de validation</h2>
          {pending.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
              <span className="flex-[1_1_260px]"><strong>{r.title}</strong><span className="block muted">Tentative {r.attempt_no} · remise le {r.submitted_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></span>
              <span className={`pill ${r.has_proposal ? 'bg-brand-soft text-brand-dark' : 'bg-soft text-ink-2'}`}>{r.has_proposal ? 'Pré-corrigée par Claude' : 'À exporter'}</span>
              <Link className="btn" href={`/parent/copies/${r.id}`}>{r.has_proposal ? 'Vérifier et valider' : 'Corriger moi-même'}</Link>
            </div>
          ))}
        </section>
      )}
      {graded.length > 0 && (
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Déjà notées</h2>
          {graded.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
              <span className="flex-[1_1_260px]"><strong>{r.title}</strong> · tentative {r.attempt_no}</span>
              <strong className="w-16">{Number(r.final_score).toLocaleString('fr-FR')}/20</strong>
              <Link href={`/parent/copies/${r.id}`} className="font-semibold">Voir</Link>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
