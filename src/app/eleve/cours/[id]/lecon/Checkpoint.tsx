'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { answerCheckpoint, type CheckpointResult } from './actions';
import type { CheckpointPublic } from './state';

export function Checkpoint({ courseId, partIndex, total, initial }: { courseId: string; partIndex: number; total: number; initial: CheckpointPublic }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [res, setRes] = useState<CheckpointResult | null>(null);
  const [pending, start] = useTransition();

  const choose = (i: number) => {
    if (pending || res?.correct) return;
    setPicked(i);
    start(async () => setRes(await answerCheckpoint(courseId, partIndex, i)));
  };
  const retry = () => { if (res?.next) setQ(res.next); setPicked(null); setRes(null); };

  return (
    <section aria-label="Point de contrôle" className="card p-7 border-2 border-brand flex flex-col gap-3.5">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="lbl text-brand-dark">Point de contrôle · partie {partIndex + 1} sur {total}</span>
        {q.attempt > 0 && <span className="muted text-sm">Nouvelle question</span>}
      </div>
      {q.quote && <p className="prose-lesson italic m-0">« {q.quote} »</p>}
      <strong className="text-base">{q.prompt}</strong>
      <div className="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const chosen = picked === i;
          const cls = chosen && res ? (res.correct ? 'border-brand bg-brand-soft' : 'border-warm bg-warm-soft') : 'border-[#D0D5DD] bg-white hover:border-brand';
          return (
            <button key={i} type="button" onClick={() => choose(i)} aria-pressed={chosen}
              className={`flex items-center gap-3 min-h-12 px-4 rounded-xl border-[1.5px] text-left font-semibold text-[15px] cursor-pointer ${cls}`} disabled={pending || !!res}>
              <span className="w-[26px] h-[26px] rounded-lg bg-soft inline-flex items-center justify-center text-sm">{String.fromCharCode(65 + i)}</span>{o}
            </button>
          );
        })}
      </div>
      {res?.correct && (
        <div role="status" className="rounded-xl px-4 py-3 bg-brand-soft text-[#1E2A78] text-sm">
          <strong>Bien vu !</strong> {res.message} <strong>+10 points de progrès.</strong>
          <div className="mt-3"><button className="btn btn-primary" type="button" onClick={() => router.refresh()}>{res.lessonDone ? 'Voir la fiche mémo' : 'Continuer vers la partie suivante'}</button></div>
        </div>
      )}
      {res && !res.correct && (
        <div role="status" className="rounded-xl px-4 py-3 bg-warm-soft text-warm-dark text-sm">
          <strong>Presque !</strong> {res.message} Te tromper ici ne compte pas dans ta note : c’est fait pour apprendre.
          <div className="mt-3"><button className="btn" type="button" onClick={retry}>Réessayer avec une autre question</button></div>
        </div>
      )}
    </section>
  );
}
