'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion, SupportText } from '@/lib/course-format';
import { RichText } from '@/components/RichText';
import { Stars, SupportTextView } from '@/components/CourseBlocks';
import { saveExerciseDraft, submitExercises, validateExercises } from './actions';

export type Solved = { solution: string; auto: boolean | null; expected?: string };

export function AnswerInput({ q, value, onChange, disabled, noPaste, onPasteBlocked }: {
  q: PublicQuestion; value: string; onChange: (v: string) => void; disabled?: boolean; noPaste?: boolean; onPasteBlocked?: () => void;
}) {
  const block = noPaste ? (e: React.ClipboardEvent) => { e.preventDefault(); onPasteBlocked?.(); } : undefined;
  if (q.type === 'qcm' && q.options) {
    return (
      <fieldset className="flex flex-col gap-2 border-0 p-0 m-0" disabled={disabled}>
        <legend className="sr-only">Choisis une réponse</legend>
        {q.options.map((o, i) => (
          <label key={i} className={`flex items-center gap-3 min-h-11 px-3.5 rounded-xl border-[1.5px] cursor-pointer ${value === String(i) ? 'border-brand bg-brand-soft' : 'border-line-strong bg-white'}`}>
            <input type="radio" name={q.id} value={i} checked={value === String(i)} onChange={() => onChange(String(i))} />{o}
          </label>
        ))}
      </fieldset>
    );
  }
  if (q.type === 'numeric' || q.type === 'short') {
    return <input className="field" inputMode={q.type === 'numeric' ? 'decimal' : 'text'} value={value} disabled={disabled}
      onChange={e => onChange(e.target.value)} onPaste={block} aria-label={`Ta réponse à ${q.id}`} />;
  }
  return <textarea className="field" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} onPaste={block} aria-label={`Ta réponse à ${q.id}`} />;
}

const LEVEL_NAME = ['Exercices', 'Je repère', 'J’analyse', 'Je rédige'];

// Texte support affiché en permanence à côté des questions
export function TextsAside({ texts }: { texts: SupportText[] }) {
  if (!texts.length) return null;
  return (
    <aside aria-label="Texte support" className="flex-[1_1_380px] lg:max-w-[520px] min-w-0 flex flex-col gap-4 lg:h-full lg:overflow-y-auto pane lg:pr-1 [&>*]:shrink-0">
      {texts.map(t => <SupportTextView key={t.id} t={t} />)}
    </aside>
  );
}

export function ExercisesPlayer({ courseId, items, texts, initial, submitted, solved, checked, initialSelf, threshold, after }: {
  courseId: string; items: PublicQuestion[]; texts: SupportText[]; initial: Record<string, string>; submitted: boolean;
  solved: Record<string, Solved> | null; checked: boolean; initialSelf: Record<string, boolean>; threshold: number; after?: React.ReactNode;
}) {
  const [answers, setAnswers] = useState(initial);
  const [self, setSelf] = useState<Record<string, boolean>>(initialSelf);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levels = [...new Set(items.map(q => q.stars ?? 0))].sort();
  const [tab, setTab] = useState(levels[0]);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [tab]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const set = (id: string, v: string) => {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    setSaved('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await saveExerciseDraft(courseId, next); setSaved('saved'); }, 1200);
  };
  const answered = items.filter(q => (answers[q.id] ?? '').trim()).length;
  const openIds = items.filter(q => solved?.[q.id]?.auto === null).map(q => q.id);
  const allJudged = openIds.every(id => id in self);
  const success = items.filter(q => (solved?.[q.id]?.auto ?? self[q.id]) === true).length;
  const score = Math.round((10 * success) / items.length);
  const shown = items.filter(q => (q.stars ?? 0) === tab);
  const tabIdx = levels.indexOf(tab);

  return (
    <div className="flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0">
      <TextsAside texts={texts} />
      <section className="card p-0 flex-[999_1_560px] min-w-0 flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
        <div role="tablist" aria-label="Niveaux" className="shrink-0 flex flex-wrap gap-2 px-4 pt-4 pb-3 border-b border-line">
          {levels.map(l => {
            const qs = items.filter(q => (q.stars ?? 0) === l);
            const done = qs.filter(q => (answers[q.id] ?? '').trim()).length;
            return (
              <button key={l} role="tab" type="button" aria-selected={tab === l} onClick={() => setTab(l)}
                className={`navlink gap-1.5 border ${tab === l ? 'bg-brand text-white border-brand hover:bg-brand-dark hover:text-white' : 'border-line'}`}>
                {l ? <span className={tab === l ? '' : 'text-warm'}>{'★'.repeat(l)}</span> : null}<span>{LEVEL_NAME[l]}</span><span className="opacity-80 font-normal">· {done}/{qs.length}</span>
              </button>
            );
          })}
        </div>
        <div ref={list} role="tabpanel" className="flex-1 min-h-0 overflow-y-auto pane p-4 sm:p-6 flex flex-col gap-4 [&>*]:shrink-0">
          {shown.map(q => {
            const sol = solved?.[q.id];
            return (
              <section key={q.id} className="rounded-2xl border border-line p-5 flex flex-col gap-3 bg-white">
                <div className="flex gap-2 items-center text-sm"><strong>Ex. {q.id.replace(/^ex/, '')}</strong><Stars n={q.stars} /></div>
                <p className="m-0 text-[16px] font-medium"><RichText text={q.prompt} /></p>
                <AnswerInput q={q} value={answers[q.id] ?? ''} onChange={v => set(q.id, v)} disabled={submitted} />
                {sol && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink"><strong>Corrigé : </strong><RichText text={sol.solution} /></div>
                    {sol.auto !== null ? (
                      <span className={`pill self-start ${sol.auto ? 'bg-brand text-white' : 'bg-soft text-ink-2'}`}>{sol.auto ? 'Réussi' : 'Pas encore'} · corrigé automatiquement</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ton auto-correction">
                        <span className="text-sm font-semibold">Compare avec le corrigé :</span>
                        <button type="button" disabled={checked} className={`btn ${self[q.id] === true ? 'btn-primary' : ''}`} onClick={() => setSelf({ ...self, [q.id]: true })}>Réussi</button>
                        <button type="button" disabled={checked} className={`btn ${self[q.id] === false ? 'bg-soft border-ink-2' : ''}`} onClick={() => setSelf({ ...self, [q.id]: false })}>Pas encore</button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
          {tabIdx < levels.length - 1 && (
            <button type="button" className="btn self-end" onClick={() => setTab(levels[tabIdx + 1])}>Niveau suivant : {LEVEL_NAME[levels[tabIdx + 1]]} ›</button>
          )}

        </div>
        <div className="shrink-0 border-t border-line px-4 sm:px-6 py-3 bg-surface-2 flex flex-wrap items-center justify-between gap-3">
          {!submitted && (<>
            <span className="text-sm"><strong>{answered} / {items.length}</strong> réponses · <span className="muted">{saved === 'saving' ? 'enregistrement…' : saved === 'saved' ? 'brouillon enregistré' : 'enregistrées au fur et à mesure'}</span></span>
            <button className="btn btn-primary" type="button" disabled={pending || answered === 0}
              onClick={() => { if (answered < items.length && !confirm(`Tu as répondu à ${answered} exercice(s) sur ${items.length}. Voir les corrigés quand même ?`)) return; start(() => submitExercises(courseId, answers)); }}>
              Valider mes réponses et voir les corrigés
            </button>
          </>)}
          {submitted && !checked && (<>
            <span className="text-sm">{allJudged ? <>Score : <strong>{score}/10</strong> · {success} exercice{success > 1 ? 's' : ''} réussi{success > 1 ? 's' : ''} sur {items.length}.</> : 'Pour chaque réponse rédigée, indique si elle est réussie en la comparant au corrigé (tous les onglets).'}</span>
            <button className="btn btn-primary" type="button" disabled={!allJudged || pending} onClick={() => start(() => validateExercises(courseId, self))}>Enregistrer mon résultat</button>
          </>)}
          {checked && (
            <>
              <span className="text-sm"><strong>Score : {score}/10</strong> · {success} réussi{success > 1 ? 's' : ''} sur {items.length} · <strong className="text-brand-dark">+50 points de progrès</strong>. {score >= threshold ? 'Tu peux passer à l’évaluation.' : `Conseil : relis les parties indiquées dans les corrigés avant l’évaluation (${threshold}/10 conseillé).`}</span>
              {after}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
