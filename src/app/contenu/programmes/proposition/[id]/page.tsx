import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getProposal } from '@/lib/programme-proposal';
import { levelDef } from '@/lib/levels-catalog';
import { PaneScreen, Panes, Pane } from '@/components/Layout';
import { applyProposalAction } from '../../actions';
import { ProposalTree } from './ProposalTree';

export const metadata = { title: 'Programme proposé' };
export const dynamic = 'force-dynamic';

// Vérifier le programme proposé avant de l'ajouter (maquette validée le 28/11/2026) : tout est coché, on décoche ce qui ne convient pas
export default async function Proposition({ params }: { params: Promise<{ id: string }> }) {
  await requireUser('admin');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const pr = await getProposal(id);
  if (!pr) notFound();
  const def = levelDef(pr.level_code);
  const subjects = pr.data.subjects;
  const nCh = subjects.reduce((a, s) => a + s.chapters.length, 0), nCo = subjects.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.courses.length, 0), 0);
  return (
    <PaneScreen top={<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="m-0 text-[22px] font-bold">Programme proposé · {def?.name ?? pr.level_code}</h1>
      <span className="text-[13px] muted">{subjects.length} matière{subjects.length > 1 ? 's' : ''} · {nCh} chapitre{nCh > 1 ? 's' : ''} · {nCo} cours · {pr.source === 'ia' ? 'proposé par l’IA' : 'préparé par Claude'} — décoche ce qui ne convient pas</span>
    </div>}>
      <Panes><Pane className="flex-1">
        {pr.applied_at
          ? <section className="card flex flex-col gap-2" data-proposal-applied><strong>Ce programme a déjà été ajouté.</strong>
              <Link href={`/contenu/programmes?niveau=${pr.level_code}`}>Voir le programme de {def?.name}</Link></section>
          : <ProposalTree id={pr.id} level={pr.level_code} subjects={subjects} ignored={pr.data.ignored ?? []} action={applyProposalAction.bind(null, pr.id)} />}
      </Pane></Panes>
    </PaneScreen>
  );
}
