import { redirect } from 'next/navigation';
import { Compass } from 'lucide-react';
import { requireStudent } from '@/lib/access';
import { placementFor, deadline, finishPlacement } from '@/lib/placement';
import { publicQuestion } from '@/lib/course-format';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { RichText } from '@/components/RichText';
import { startPlacement } from './actions';
import { PlacementRunner } from './Runner';

export const metadata = { title: 'Test de positionnement' };
export const dynamic = 'force-dynamic';

export default async function Placement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student } = await requireStudent();
  let t = await placementFor(student.id, id);
  if (!t) redirect('/eleve');
  // temps écoulé (page fermée pendant le test) : remise automatique avec les réponses enregistrées
  if (t.status === 'en_cours' && (deadline(t) ?? 0) + 60_000 < Date.now()) { await finishPlacement(t, {}); t = (await placementFor(student.id, id))!; }
  const items = t.questions.items;

  if (t.status === 'propose') return (
    <Screen top={<PageTitle kicker="Test de positionnement" title="On fait le point sur tes bases" />}>
      <section className="card max-w-[720px] flex flex-col gap-4">
        <span className="kpi-icon tone-brand !w-12 !h-12" aria-hidden="true"><Compass size={24} /></span>
        <p className="m-0 text-[16px] leading-relaxed"><RichText text={t.questions.consigne || 'Ce test repère ce que tu maîtrises déjà des années précédentes.'} /></p>
        <ul className="m-0 pl-5 list-disc text-[15px] flex flex-col gap-1">
          <li><strong>{items.length} questions courtes</strong>, environ <strong>{t.duration_min} minutes</strong>.</li>
          <li>Il <strong>ne compte pas</strong> dans tes notes : il sert à choisir ce qu’on reprendra avec toi.</li>
          <li>Fais-le seul, sans aide et sans te presser : si tu ne sais pas, laisse vide plutôt que de deviner.</li>
        </ul>
        <form action={startPlacement.bind(null, t.id)}><button className="btn btn-primary min-h-[52px] px-7" type="submit">Commencer le test</button></form>
      </section>
    </Screen>
  );

  if (t.status === 'en_cours') {
    const remaining = Math.max(0, Math.round(((deadline(t) ?? Date.now()) - Date.now()) / 1000));
    return (
      <Screen top={<PageTitle kicker="Test de positionnement" title="Réponds à ton rythme" sub="Tes réponses sont enregistrées au fur et à mesure. Si tu ne sais pas, laisse vide." />} className="lg:overflow-hidden">
        <PlacementRunner id={t.id} items={items.map(q => ({ ...publicQuestion(q), matiere: q.matiere }))} initial={t.answers} remaining={remaining} />
      </Screen>
    );
  }

  const res = new Map((t.results ?? []).map(r => [r.id, r]));
  return (
    <Screen top={<PageTitle kicker="Test de positionnement" title={`Merci ! ${t.score} bonne${(t.score ?? 0) > 1 ? 's' : ''} réponse${(t.score ?? 0) > 1 ? 's' : ''} sur ${t.total}`}
      sub="Ton parent voit ces résultats : ils servent à choisir les leçons à reprendre avec toi. Voici la correction." />}>
      {items.map((q, i) => {
        const r = res.get(q.id);
        return (
          <section key={q.id} className={`card flex flex-col gap-2 border-l-4 ${r?.correct ? 'border-l-[var(--color-brand)]' : 'border-l-[var(--color-warm)]'}`}>
            <span className="text-sm muted">Question {i + 1} · {q.matiere} · {q.notion}</span>
            <p className="m-0 font-medium"><RichText text={q.prompt} /></p>
            <p className="m-0 text-sm">Ta réponse : <strong>{q.type === 'qcm' && t.answers[q.id] ? q.options?.[Number(t.answers[q.id])] ?? '—' : t.answers[q.id] || '(vide)'}</strong> {r?.correct ? '✓' : '✗'}</p>
            <p className="m-0 text-sm rounded-lg bg-surface-2 px-3 py-2"><RichText text={q.explication} /></p>
          </section>
        );
      })}
    </Screen>
  );
}
