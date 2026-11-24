'use client';
import { startTransition, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion } from '@/lib/course-format';
import { RichText } from '@/components/RichText';
import { AnswerProgress } from '@/components/AnswerProgress';
import { AnswerInput } from '../../cours/[id]/exercices/Player';
import { submitPlacement } from './actions';

// Test de positionnement : questions à la suite, réponses enregistrées au fil de l'eau, remise à la fin du temps
export function PlacementRunner({ id, items, initial, remaining }: { id: string; items: (PublicQuestion & { matiere: string })[]; initial: Record<string, string>; remaining: number }) {
  const [answers, setAnswers] = useState(initial);
  const [left, setLeft] = useState(remaining);
  const [confirming, setConfirming] = useState(false);
  const [pending] = useTransition();
  const latest = useRef(answers);
  const dirty = useRef(new Set<string>());
  const sent = useRef(false);
  const endAt = useRef(Date.now() + remaining * 1000);
  const save = useCallback(() => {
    if (!dirty.current.size || sent.current) return;
    const part = Object.fromEntries([...dirty.current].map(k => [k, latest.current[k] ?? '']));
    dirty.current.clear();
    fetch(`/api/positionnement/${id}`, { method: 'POST', body: JSON.stringify({ answers: part }), keepalive: true }).catch(() => null);
  }, [id]);
  const submit = useCallback(() => { if (sent.current) return; sent.current = true; startTransition(() => submitPlacement(id, latest.current)); }, [id]);
  useEffect(() => { const t = setInterval(() => { const s = Math.max(0, Math.round((endAt.current - Date.now()) / 1000)); setLeft(s); if (s === 0) submit(); }, 1000); return () => clearInterval(t); }, [submit]);
  useEffect(() => { const t = setTimeout(save, 700); return () => clearTimeout(t); }, [answers, save]);
  useEffect(() => { const h = () => save(); window.addEventListener('pagehide', h); document.addEventListener('visibilitychange', h); return () => { window.removeEventListener('pagehide', h); document.removeEventListener('visibilitychange', h); }; }, [save]);
  const set = (k: string, v: string) => { const n = { ...latest.current, [k]: v }; latest.current = n; dirty.current.add(k); setAnswers(n); };
  const answered = items.filter(q => (answers[q.id] ?? '').trim()).length;
  const jump = () => { const q = items.find(x => !(latest.current[x.id] ?? '').trim()); if (q) document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  return (
    <section className="card !p-0 flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden" data-exam-focus>
      <AnswerProgress answered={answered} total={items.length} onJump={jump} />
      <div className="flex-1 min-h-0 overflow-y-auto pane p-4 sm:p-6 flex flex-col gap-4 [&>*]:shrink-0">
        {items.map((q, i) => (
          <section key={q.id} id={`q-${q.id}`} className={`rounded-2xl border p-5 flex flex-col gap-3 bg-white scroll-mt-4 ${(answers[q.id] ?? '').trim() ? 'border-brand-mid' : 'border-line'}`}>
            <div className="flex gap-2 items-center text-sm"><strong>Question {i + 1}</strong><span className="pill bg-soft text-ink-2">{q.matiere}</span></div>
            <p className="m-0 text-[16px] font-medium"><RichText text={q.prompt} /></p>
            <AnswerInput q={q} value={answers[q.id] ?? ''} onChange={v => set(q.id, v)} />
          </section>
        ))}
      </div>
      <div className="shrink-0 border-t border-line px-4 sm:px-6 py-3 bg-surface-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm" role="timer" aria-live="off">Temps restant : <strong className="num">{mm}:{ss}</strong></span>
        {confirming ? (
          <span role="alertdialog" aria-label="Confirmer" className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{answered < items.length ? `Il reste ${items.length - answered} question${items.length - answered > 1 ? 's' : ''} sans réponse. Terminer ?` : 'Terminer le test ?'}</span>
            <button className="btn btn-primary" type="button" autoFocus onClick={submit}>Oui, terminer</button>
            <button className="btn" type="button" onClick={() => setConfirming(false)}>Continuer</button>
          </span>
        ) : <button className="btn btn-primary" type="button" disabled={pending} onClick={() => setConfirming(true)}>Terminer le test</button>}
      </div>
    </section>
  );
}
