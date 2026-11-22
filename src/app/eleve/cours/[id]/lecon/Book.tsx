'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Block } from '@/lib/course-format';
import { BlockView } from '@/components/CourseBlocks';
import { RichText } from '@/components/RichText';
import { Checkpoint } from './Checkpoint';
import type { CheckpointPublic } from './state';

export type BookPage =
  | { kind: 'intro'; title: string; objectives: string[]; essential?: string }
  | { kind: 'part'; index: number; title: string; blocks: Block[] | null; passed: boolean; hasCheckpoint: boolean }
  | { kind: 'memo'; title: string; memo: { label: string; text: string }[] | null };

// Leçon présentée comme un livre : une page à la fois, plan à gauche, Précédent / Suivant en bas.
export function LessonBook({ courseId, pages, startPage, current, checkpoint, totalParts, lessonDone, exercisesHref, finishAction }: {
  courseId: string; pages: BookPage[]; startPage: number; current: number; checkpoint: CheckpointPublic | null; totalParts: number;
  lessonDone: boolean; exercisesHref: string; finishAction: () => Promise<void>;
}) {
  const [page, setPage] = useState(startPage);
  const body = useRef<HTMLDivElement>(null);
  // après un point de contrôle réussi, la page suivante s'ouvre d'elle-même
  useEffect(() => { setPage(startPage); }, [startPage]);
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [page]);

  const unlocked = (i: number) => {
    const p = pages[i];
    if (p.kind === 'part') return p.blocks !== null;
    if (p.kind === 'memo') return p.memo !== null;
    return true;
  };
  const p = pages[page];
  const canNext = page < pages.length - 1 && unlocked(page + 1);
  const label = (x: BookPage) => x.kind === 'intro' ? 'Objectifs' : x.kind === 'memo' ? 'Fiche mémo' : `${x.index + 1}. ${x.title}`;

  return (
    <div className="flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0">
      <nav aria-label="Plan de la leçon" className="card p-4 flex-[1_1_240px] lg:max-w-[290px] flex flex-col gap-1.5 lg:h-full lg:overflow-y-auto pane [&>*]:shrink-0">
        <span className="lbl px-1.5 pb-1.5">Plan · page {page + 1} sur {pages.length}</span>
        {pages.map((x, i) => {
          const open = unlocked(i), on = i === page, ok = x.kind === 'part' && x.passed;
          return (
            <button key={i} type="button" disabled={!open} onClick={() => setPage(i)} aria-current={on ? 'page' : undefined}
              className={`flex gap-2.5 p-2.5 rounded-xl text-sm font-semibold text-left ${on ? 'bg-brand text-white' : ok ? 'bg-brand-soft text-brand-ink hover:bg-brand-mid' : open ? 'text-ink-2 hover:bg-soft' : 'text-muted-2 cursor-not-allowed'}`}>
              <span className="w-4 shrink-0">{ok ? '✓' : x.kind === 'memo' ? '★' : x.kind === 'intro' ? '◦' : open ? '›' : '–'}</span>
              <span>{label(x)}</span>
            </button>
          );
        })}
        <span className="muted text-xs px-1.5 pt-2">Chaque partie s’ouvre après le point de contrôle de la précédente.</span>
      </nav>

      <article className="card p-0 flex-[999_1_560px] min-w-0 flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
        <div className="h-1.5 bg-track shrink-0"><div className="h-full bg-brand transition-all" style={{ width: `${((page + 1) / pages.length) * 100}%` }} /></div>
        <div ref={body} className="flex-1 min-h-0 overflow-y-auto pane px-6 sm:px-10 py-8 flex flex-col gap-5 [&>*]:shrink-0">
          {p.kind === 'intro' && (
            <>
              <span className="lbl text-brand-dark spark">Avant de commencer</span>
              <h2 className="text-[28px] font-bold">{p.title}</h2>
              {p.objectives.length > 0 && (<div><span className="lbl">À la fin de cette leçon, je sais</span>
                <ul className="mt-2 mb-0 pl-5 list-disc text-[17px] leading-relaxed">{p.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></div>)}
              {p.essential && <BlockView block={{ type: 'callout', kind: 'essentiel', text: p.essential }} />}
              <p className="muted m-0">{totalParts} parties, chacune suivie d’une petite question pour vérifier que c’est compris.</p>
            </>
          )}
          {p.kind === 'part' && p.blocks && (
            <>
              <span className="lbl text-brand-dark spark">Partie {p.index + 1} sur {totalParts}</span>
              <h2 className="text-[28px] font-bold">{p.title}</h2>
              {p.blocks.map((b, j) => <BlockView key={j} block={b} />)}
              {p.index === current && checkpoint && (
                <Checkpoint key={`${p.index}-${checkpoint.attempt}`} courseId={courseId} partIndex={p.index} total={totalParts} initial={checkpoint} />
              )}
              {p.passed && p.hasCheckpoint && <p className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm">✓ Point de contrôle réussi pour cette partie.</p>}
            </>
          )}
          {p.kind === 'memo' && p.memo && (
            <>
              <span className="lbl text-brand-dark spark">Fiche mémo</span>
              <h2 className="text-[28px] font-bold">À retenir en un coup d’œil</h2>
              <table className="tbl"><tbody>{p.memo.map((m, i) => <tr key={i}><td className="font-semibold w-48">{m.label}</td><td><RichText text={m.text} /></td></tr>)}</tbody></table>
              {lessonDone ? (
                <div className="rounded-xl bg-brand-soft border border-brand-mid px-5 py-4 flex flex-wrap justify-between items-center gap-3">
                  <span><strong>Leçon terminée, bravo !</strong> Prochaine étape : t’entraîner.</span>
                  <Link className="btn btn-primary" href={exercisesHref}>② Faire les exercices</Link>
                </div>
              ) : (
                <form action={finishAction} className="flex justify-end"><button className="btn btn-primary" type="submit">J’ai terminé la leçon</button></form>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 border-t border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-surface-2">
          <button className="btn" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Précédent</button>
          <span className="muted text-sm hidden sm:inline">{label(p)}</span>
          <button className="btn btn-primary" type="button" disabled={!canNext} onClick={() => setPage(page + 1)}
            title={!canNext && page < pages.length - 1 ? 'Réussis le point de contrôle pour continuer' : undefined}>
            {page === pages.length - 1 ? 'Fin' : 'Suivant ›'}
          </button>
        </div>
      </article>
    </div>
  );
}
