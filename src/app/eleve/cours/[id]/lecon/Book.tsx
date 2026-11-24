'use client';
import { ConfirmButton } from '@/components/ConfirmButton';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
export function LessonBook({ courseId, pages, startPage, current, checkpoint, totalParts, lessonDone, exercisesHref, finishAction, pointsJustEarned = false }: {
  courseId: string; pages: BookPage[]; startPage: number; current: number; checkpoint: CheckpointPublic | null; totalParts: number;
  lessonDone: boolean; exercisesHref: string; finishAction: () => Promise<void>; pointsJustEarned?: boolean;
}) {
  const [page, setPage] = useState(startPage);
  const router = useRouter();
  // point de contrôle réussi sur cette page : la barre du bas se débloque aussitôt (la page suivante arrive du serveur)
  const [justPassed, setJustPassed] = useState(false);
  useEffect(() => { setJustPassed(false); }, [page]);
  const body = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLElement>(null);
  const first = useRef(true);
  // après un point de contrôle réussi, la page suivante s'ouvre d'elle-même
  useEffect(() => { setPage(startPage); }, [startPage]);
  // chaque nouvelle page s'ouvre en haut (sur téléphone, c'est la page entière qui défile)
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    if (first.current) { first.current = false; return; }
    if (window.matchMedia('(max-width: 1023px)').matches) art.current?.scrollIntoView({ block: 'start' });
  }, [page]);
  // lien direct vers une partie (« Revoir la partie 2 » depuis le bilan) : #partie-2
  useEffect(() => {
    const m = window.location.hash.match(/partie-(\d+)/);
    if (!m) return;
    const i = pages.findIndex(x => x.kind === 'part' && x.index === Number(m[1]) - 1);
    if (i >= 0 && unlocked(i)) setPage(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlocked = (i: number) => {
    const p = pages[i];
    if (p.kind === 'part') return p.blocks !== null;
    if (p.kind === 'memo') return p.memo !== null;
    return true;
  };
  const p = pages[page];
  const canNext = page < pages.length - 1 && (unlocked(page + 1) || justPassed);
  const label = (x: BookPage) => x.kind === 'intro' ? 'Objectifs' : x.kind === 'memo' ? 'Fiche mémo' : `${x.index + 1}. ${x.title}`;

  return (
    <div className="flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0">
      <nav aria-label="Plan de la leçon" className="card p-4 flex-[1_1_240px] lg:max-w-[290px] hidden lg:flex flex-col gap-1.5 lg:h-full lg:overflow-y-auto pane [&>*]:shrink-0">
        <span className="lbl px-1.5 pb-1.5">Plan de la leçon</span>
        {pages.map((x, i) => {
          const open = unlocked(i), on = i === page, ok = x.kind === 'part' && x.passed;
          return (
            <button key={i} type="button" disabled={!open} onClick={() => setPage(i)} aria-current={on ? 'page' : undefined}
              className={`flex gap-2.5 p-2.5 rounded-xl text-sm font-semibold text-left ${on ? 'bg-brand text-white' : ok ? 'bg-brand-soft text-brand-ink hover:bg-brand-mid' : open ? 'text-ink-2 hover:bg-soft' : 'text-muted-2 cursor-not-allowed'}`}>
              <span className="w-4 shrink-0">{ok ? '✓' : !open ? <Lock size={13} className="mt-0.5" aria-label="verrouillée" /> : x.kind === 'memo' ? '★' : x.kind === 'intro' ? '◦' : '›'}</span>
              <span>{label(x)}</span>
            </button>
          );
        })}
        <span className="muted text-xs px-1.5 pt-2">Chaque partie s’ouvre après le point de contrôle de la précédente.</span>
      </nav>

      <article ref={art} className="card p-0 scroll-mt-4 flex-[999_1_560px] min-w-0 flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
        <div className="h-1.5 bg-track shrink-0"><div className="h-full bg-brand transition-all" style={{ width: `${((page + 1) / pages.length) * 100}%` }} /></div>
        <div ref={body} className="flex-1 min-h-0 overflow-y-auto pane px-6 sm:px-10 py-8 flex flex-col gap-5 [&>*]:shrink-0">
          {p.kind === 'intro' && (
            <>
              <span className="lbl spark">Avant de commencer</span>
              <h2 className="text-[28px] font-bold">{p.title}</h2>
              {p.objectives.length > 0 && (<div><span className="lbl">À la fin de cette leçon, je sais</span>
                <ul className="mt-2 mb-0 pl-5 list-disc text-[17px] leading-relaxed">{p.objectives.map((o, i) => <li key={i}><RichText text={o} /></li>)}</ul></div>)}
              {p.essential && <BlockView block={{ type: 'callout', kind: 'essentiel', text: p.essential }} />}
              <p className="muted m-0">{totalParts} parties, chacune suivie d’une petite question pour vérifier que c’est compris.</p>
            </>
          )}
          {p.kind === 'part' && p.blocks && (
            <>
              <span className="lbl spark">Partie {p.index + 1} sur {totalParts}</span>
              <h2 className="text-[28px] font-bold">{p.title}</h2>
              {p.blocks.map((b, j) => <BlockView key={j} block={b} />)}
              {p.index === current && checkpoint && (
                <Checkpoint key={`${p.index}-${checkpoint.attempt}`} courseId={courseId} partIndex={p.index} total={totalParts} initial={checkpoint} onPassed={() => setJustPassed(true)} />
              )}
              {p.passed && p.hasCheckpoint && <p className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm">✓ Point de contrôle réussi pour cette partie.</p>}
            </>
          )}
          {p.kind === 'memo' && p.memo && (
            <>
              <span className="lbl spark">Fiche mémo</span>
              <h2 className="text-[28px] font-bold">À retenir en un coup d’œil</h2>
              <table className="tbl"><tbody>{p.memo.map((m, i) => <tr key={i}><td className="font-semibold w-48">{m.label}</td><td><RichText text={m.text} /></td></tr>)}</tbody></table>
              {lessonDone ? (
                <div className="rounded-xl bg-brand-soft border border-brand-mid px-5 py-4 flex flex-wrap justify-between items-center gap-3">
                  <span><strong>Leçon terminée, bravo !</strong> {pointsJustEarned && <strong className="text-brand-dark">+50 points de progrès. </strong>}Prochaine étape : t’entraîner.</span>
                  <Link className="btn btn-primary" href={exercisesHref}>② Faire les exercices</Link>
                </div>
              ) : (
                <form action={finishAction} className="flex justify-end"><ConfirmButton className="btn btn-primary">J’ai terminé la leçon</ConfirmButton></form>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 border-t border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-surface-2">
          <button className="btn" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Précédent</button>
          <span className={`text-sm text-center ${!canNext && page < pages.length - 1 ? 'text-warm-dark font-semibold' : 'muted hidden sm:inline'}`}>
            {!canNext && page < pages.length - 1 ? 'Réponds au point de contrôle pour débloquer la suite' : label(p)}</span>
          <button className="btn btn-primary" type="button" disabled={!canNext} onClick={() => unlocked(page + 1) ? setPage(page + 1) : router.refresh()}
            data-tip={!canNext && page < pages.length - 1 ? 'Réussis le point de contrôle pour continuer' : undefined}>
            {page === pages.length - 1 ? 'Fin' : 'Suivant ›'}
          </button>
        </div>
      </article>
    </div>
  );
}
