'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion, SupportText } from '@/lib/course-format';
import { RichText } from '@/components/RichText';
import { Stars, SupportTextView } from '@/components/CourseBlocks';
import { AnswerProgress } from '@/components/AnswerProgress';
import { submitExercises, validateExercises } from './actions';
import { FigureView } from '@/components/Figure';

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
            <input type="radio" name={q.id} value={i} checked={value === String(i)} onChange={() => onChange(String(i))} /><span><RichText text={o} /></span>
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

export function ExercisesPlayer({ courseId, items, texts, initial, submitted, solved, checked, initialSelf, threshold, after, instructions, pointsJustEarned = false }: {
  courseId: string; items: PublicQuestion[]; texts: SupportText[]; initial: Record<string, string>; submitted: boolean;
  solved: Record<string, Solved> | null; checked: boolean; initialSelf: Record<string, boolean>; threshold: number; after?: React.ReactNode; instructions?: React.ReactNode; pointsJustEarned?: boolean;
}) {
  const [answers, setAnswers] = useState(initial);
  const [self, setSelf] = useState<Record<string, boolean>>(initialSelf);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levels = [...new Set(items.map(q => q.stars ?? 0))].sort();
  const [tab, setTab] = useState(levels[0]);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [tab]);

  // Sauvegarde fiable : seules les réponses modifiées sont envoyées (le serveur fusionne), moins d'une seconde
  // après la frappe, et aussitôt qu'on quitte la page (Quitter, onglet, rechargement) grâce à keepalive.
  const latest = useRef(answers);
  const dirty = useRef(new Set<string>());
  const touched = useRef(new Set<string>());
  const flush = useRef(() => {});
  flush.current = () => {
    if (submitted || dirty.current.size === 0) return;
    const part = Object.fromEntries([...dirty.current].map(k => [k, latest.current[k] ?? '']));
    dirty.current.clear();
    setSaved('saving');
    fetch(`/api/exercices/${courseId}`, { method: 'POST', body: JSON.stringify({ answers: part }), keepalive: true })
      .then(r => { setSaved(r.ok ? 'saved' : 'idle'); if (!r.ok) Object.keys(part).forEach(k => dirty.current.add(k)); })
      .catch(() => { Object.keys(part).forEach(k => dirty.current.add(k)); setSaved('idle'); });
  };
  useEffect(() => {
    const onHide = () => flush.current();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); if (timer.current) clearTimeout(timer.current); flush.current(); };
  }, []);
  // à l'ouverture : on relit les réponses enregistrées (une sauvegarde a pu arriver après l'affichage de la page)
  useEffect(() => {
    if (submitted) return;
    fetch(`/api/exercices/${courseId}`).then(r => r.ok ? r.json() : null).then((d: { answers?: Record<string, string> } | null) => {
      if (!d?.answers) return;
      const merged = { ...latest.current };
      for (const [k, v] of Object.entries(d.answers)) if (!touched.current.has(k) && v.trim() && v !== merged[k]) merged[k] = v;
      latest.current = merged; setAnswers(merged);
    }).catch(() => null);
  }, [courseId, submitted]);

  const set = (id: string, v: string) => {
    const next = { ...latest.current, [id]: v };
    latest.current = next; setAnswers(next);
    dirty.current.add(id); touched.current.add(id);
    setSaved('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush.current(), 600);
  };
  const answered = items.filter(q => (answers[q.id] ?? '').trim()).length;
  const openIds = items.filter(q => solved?.[q.id]?.auto === null).map(q => q.id);
  const allJudged = openIds.every(id => id in self);
  const success = items.filter(q => (solved?.[q.id]?.auto ?? self[q.id]) === true).length;
  const score = Math.round((10 * success) / items.length);
  const shown = items.filter(q => (q.stars ?? 0) === tab);
  const tabIdx = levels.indexOf(tab);
  // aller à la prochaine question sans réponse (change d'onglet si besoin, puis fait défiler jusqu'à elle)
  const jump = () => {
    const q = levels.flatMap(l => items.filter(x => (x.stars ?? 0) === l)).find(x => !(answers[x.id] ?? '').trim());
    if (!q) return;
    setTab(q.stars ?? 0);
    setTimeout(() => {
      const el = document.getElementById(`q-${q.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el?.querySelector('input, textarea') as HTMLElement | null)?.focus({ preventScroll: true });
    }, 60);
  };

  // après la remise : aller à la prochaine réponse rédigée à comparer avec le corrigé
  const toCheckIds = openIds.filter(id => !(id in self));
  const jumpToCheck = () => {
    const q = levels.flatMap(l => items.filter(x => (x.stars ?? 0) === l)).find(x => toCheckIds.includes(x.id));
    if (!q) return;
    setTab(q.stars ?? 0); setConfirmSave(false);
    setTimeout(() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  return (
    <div className="flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0">
      <TextsAside texts={texts} />
      <section className="card p-0 flex-[999_1_560px] min-w-0 flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
        {!submitted && <AnswerProgress answered={answered} total={items.length} onJump={jump} />}
        <div role="tablist" aria-label="Niveaux" className="shrink-0 flex flex-wrap gap-2 px-4 pt-4 pb-3 border-b border-line qtabs">
          {levels.map(l => {
            const qs = items.filter(q => (q.stars ?? 0) === l);
            const done = qs.filter(q => (answers[q.id] ?? '').trim()).length;
            const toCheck = submitted && !checked ? qs.filter(q => openIds.includes(q.id) && !(q.id in self)).length : 0;
            return (
              <button key={l} role="tab" type="button" aria-selected={tab === l} onClick={() => setTab(l)}
                className={`navlink gap-1.5 border ${tab === l ? 'bg-brand text-white border-brand hover:bg-brand-dark hover:text-white' : 'border-line'}`}>
                {l ? <span className={tab === l ? '' : 'text-warm'}>{'★'.repeat(l)}</span> : null}<span>{LEVEL_NAME[l]}</span>{toCheck > 0 ? <span className="pill bg-warm-soft text-warm-dark ml-1">{toCheck} à vérifier</span> : <span className="opacity-80 font-normal">· {done}/{qs.length}</span>}
              </button>
            );
          })}
        </div>
        <div ref={list} role="tabpanel" className="flex-1 min-h-0 overflow-y-auto pane p-4 sm:p-6 flex flex-col gap-4 [&>*]:shrink-0">
          {instructions && tabIdx === 0 && <div className="rounded-2xl bg-surface-2 border border-line px-4 py-3 text-sm text-ink-2"><strong className="text-ink">Consigne · </strong>{instructions}</div>}
          {shown.map(q => {
            const sol = solved?.[q.id];
            return (
              <section key={q.id} id={`q-${q.id}`} className={`rounded-2xl border p-5 flex flex-col gap-3 bg-white scroll-mt-4 ${!submitted && (answers[q.id] ?? '').trim() ? 'border-brand-mid' : 'border-line'}`}>
                <div className="flex gap-2 items-center text-sm"><strong>Ex. {q.id.replace(/^ex/, '')}</strong><Stars n={q.stars} /></div>
                <p className="m-0 text-[16px] font-medium"><RichText text={q.prompt} /></p>
                {q.figure && <FigureView f={q.figure} />}
                <AnswerInput q={q} value={answers[q.id] ?? ''} onChange={v => set(q.id, v)} disabled={submitted} />
                {sol && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink"><strong>Corrigé : </strong><RichText text={sol.solution} /></div>
                    {sol.auto !== null ? (
                      <span className={`pill self-start ${sol.auto ? 'bg-brand text-white' : 'bg-soft text-ink-2'}`}>{sol.auto ? 'Réussi' : 'Pas encore'} · corrigé automatiquement</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ton auto-correction">
                        <span className="text-sm font-semibold">Compare avec le corrigé :</span>
                        <button type="button" disabled={checked || !(answers[q.id] ?? '').trim()} data-tip={!(answers[q.id] ?? '').trim() ? 'Pas de réponse : compte « Pas encore »' : undefined} aria-pressed={self[q.id] === true} className={`btn ${self[q.id] === true ? 'btn-primary' : ''}`} onClick={() => setSelf({ ...self, [q.id]: true })}>Réussi</button>
                        <button type="button" disabled={checked} aria-pressed={self[q.id] === false} className={`btn ${self[q.id] === false ? '!bg-warm-soft !border-warm !text-warm-dark' : ''}`} onClick={() => setSelf({ ...self, [q.id]: false })}>Pas encore</button>
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
{confirming && !pending ? (
              <span role="alertdialog" aria-label="Confirmer" className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Tu as répondu à {answered} exercice{answered > 1 ? 's' : ''} sur {items.length}. Voir les corrigés quand même ?</span>
                <button className="btn btn-primary" type="button" autoFocus onClick={() => start(() => submitExercises(courseId, latest.current))}>Oui, voir les corrigés</button>
                <button className="btn" type="button" onClick={() => setConfirming(false)}>Continuer</button>
              </span>
            ) : (
              <button className="btn btn-primary" type="button" disabled={pending || answered === 0}
                onClick={() => { if (answered < items.length) setConfirming(true); else start(() => submitExercises(courseId, latest.current)); }}>
                Valider mes réponses et voir les corrigés
              </button>
            )}
          </>)}
          {submitted && !checked && (<>
            <span className="text-sm">{allJudged ? <>Score : <strong>{score}/10</strong> · {success} exercice{success > 1 ? 's' : ''} réussi{success > 1 ? 's' : ''} sur {items.length}.</> : `Compare tes réponses rédigées avec le corrigé : encore ${openIds.filter(id => !(id in self)).length} à vérifier (voir les onglets marqués).`}</span>
            {/* jamais bloquant : une réponse non comparée compte « Pas encore », l'élève peut toujours passer à l'évaluation */}
            {confirmSave && !allJudged && !pending ? (
              <span role="alertdialog" aria-label="Confirmer" className="flex flex-wrap items-center gap-2" data-confirm-save>
                <span className="text-sm font-semibold">{toCheckIds.length} réponse{toCheckIds.length > 1 ? 's' : ''} pas encore comparée{toCheckIds.length > 1 ? 's' : ''} : elle{toCheckIds.length > 1 ? 's' : ''} compteront « Pas encore ».</span>
                <button className="btn" type="button" autoFocus onClick={jumpToCheck}>Les comparer</button>
                <button className="btn btn-primary" type="button" onClick={() => start(() => validateExercises(courseId, self))}>Enregistrer quand même</button>
              </span>
            ) : (
              <span className="flex flex-wrap gap-2">
                {!allJudged && <button className="btn" type="button" onClick={jumpToCheck}>Prochaine à comparer</button>}
                <button className="btn btn-primary" type="button" disabled={pending} onClick={() => { if (allJudged) start(() => validateExercises(courseId, self)); else setConfirmSave(true); }}>Enregistrer mon résultat</button>
              </span>
            )}
          </>)}
          {checked && (
            <>
              <span className="text-sm"><strong>Score : {score}/10</strong> · {success} réussi{success > 1 ? 's' : ''} sur {items.length} {pointsJustEarned && <> · <strong className="text-brand-dark">+50 points de progrès</strong></>}. {score >= threshold ? 'Tu peux passer à l’évaluation.' : `Conseil : relis les parties indiquées dans les corrigés avant l’évaluation (${threshold}/10 conseillé).`}</span>
              {after}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
