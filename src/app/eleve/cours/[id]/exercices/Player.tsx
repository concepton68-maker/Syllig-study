'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion } from '@/lib/course-format';
import { RichText } from '@/components/RichText';
import { Stars } from '@/components/CourseBlocks';
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
          <label key={i} className={`flex items-center gap-3 min-h-11 px-3.5 rounded-xl border-[1.5px] cursor-pointer ${value === String(i) ? 'border-brand bg-brand-soft' : 'border-[#D0D5DD] bg-white'}`}>
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

export function ExercisesPlayer({ courseId, items, initial, submitted, solved, checked, initialSelf, threshold }: {
  courseId: string; items: PublicQuestion[]; initial: Record<string, string>; submitted: boolean;
  solved: Record<string, Solved> | null; checked: boolean; initialSelf: Record<string, boolean>; threshold: number;
}) {
  const [answers, setAnswers] = useState(initial);
  const [self, setSelf] = useState<Record<string, boolean>>(initialSelf);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  let level = 0;
  return (
    <div className="flex flex-col gap-4">
      {items.map(q => {
        const showLevel = q.stars && q.stars !== level;
        if (q.stars) level = q.stars;
        const sol = solved?.[q.id];
        return (
          <div key={q.id} className="flex flex-col gap-4">
            {showLevel && <h2 className="text-lg font-semibold mt-2">Niveau {'★'.repeat(q.stars!)} · {['', 'Je repère', 'J’analyse', 'Je rédige'][q.stars!]}</h2>}
            <section className="card flex flex-col gap-3">
              <div className="flex gap-2 items-center text-sm"><strong>Ex. {q.id.replace(/^ex/, '')}</strong><Stars n={q.stars} /></div>
              <p className="m-0 text-[16px] font-medium"><RichText text={q.prompt} /></p>
              <AnswerInput q={q} value={answers[q.id] ?? ''} onChange={v => set(q.id, v)} disabled={submitted} />
              {sol && (
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-[#1E2A78]"><strong>Corrigé : </strong><RichText text={sol.solution} /></div>
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
          </div>
        );
      })}

      {!submitted && (
        <div className="card sticky bottom-3 flex flex-wrap items-center justify-between gap-3 border-brand-mid">
          <span className="text-sm"><strong>{answered} / {items.length}</strong> réponses · <span className="muted">{saved === 'saving' ? 'enregistrement…' : saved === 'saved' ? 'brouillon enregistré' : 'tes réponses sont enregistrées au fur et à mesure'}</span></span>
          <button className="btn btn-primary" type="button" disabled={pending || answered === 0}
            onClick={() => { if (answered < items.length && !confirm(`Tu as répondu à ${answered} exercice(s) sur ${items.length}. Voir les corrigés quand même ?`)) return; start(() => submitExercises(courseId, answers)); }}>
            Valider mes réponses et voir les corrigés
          </button>
        </div>
      )}
      {submitted && !checked && (
        <div className="card sticky bottom-3 flex flex-wrap items-center justify-between gap-3 border-brand-mid">
          <span className="text-sm">{allJudged ? <>Résultat : <strong>{score} / 10</strong> exercices réussis.</> : 'Indique pour chaque réponse rédigée si elle est réussie, en la comparant au corrigé.'}</span>
          <button className="btn btn-primary" type="button" disabled={!allJudged || pending} onClick={() => start(() => validateExercises(courseId, self))}>Enregistrer mon résultat</button>
        </div>
      )}
      {checked && (
        <div className="card bg-brand-soft border-brand-mid flex flex-col gap-1">
          <strong>{score} / 10 exercices réussis.</strong>
          <span className="text-sm">{score >= threshold ? 'Tu es prête pour l’évaluation.' : `Conseil : relis les parties indiquées dans les corrigés avant l’évaluation (${threshold}/10 recommandé).`}</span>
        </div>
      )}
    </div>
  );
}
