'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion, SupportText } from '@/lib/course-format';
import { RichText } from '@/components/RichText';

import { AnswerInput, TextsAside } from '../exercices/Player';
import { submitEvaluation } from './actions';

type Section = { label: string; questions: PublicQuestion[] };

export function EvalRunner({ courseId, attemptId, remaining, sections, texts, initial, total }: {
  courseId: string; attemptId: string; remaining: number; sections: Section[]; texts: SupportText[]; initial: Record<string, string>; total: number;
}) {
  const [answers, setAnswers] = useState(initial);
  const [left, setLeft] = useState(remaining);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endAt = useRef(Date.now() + remaining * 1000);
  const latest = useRef(answers);
  const hiddenSince = useRef<number | null>(null);
  const submitted = useRef(false);

  const post = useCallback((body: object) =>
    fetch(`/api/eval/${attemptId}`, { method: 'POST', body: JSON.stringify(body), keepalive: true }).catch(() => null), [attemptId]);

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    start(() => submitEvaluation(courseId, attemptId, latest.current));
  }, [courseId, attemptId]);

  // Chrono : l'échéance vient du serveur ; à zéro, la copie est remise automatiquement
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submit();
    }, 1000);
    return () => clearInterval(t);
  }, [submit]);

  // Sauvegarde automatique toutes les 10 s si changement
  const dirty = useRef(false);
  useEffect(() => {
    const t = setInterval(() => { if (dirty.current) { dirty.current = false; post({ action: 'save', answers: latest.current }); } }, 10_000);
    return () => clearInterval(t);
  }, [post]);

  // Départ de la page (navigation, fermeture) : dernière sauvegarde
  useEffect(() => {
    const onHide = () => { if (!submitted.current) post({ action: 'save', answers: latest.current }); };
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); onHide(); };
  }, [post]);

  // Sorties de fenêtre : enregistrées, présentées sans accusation
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenSince.current = Date.now(); post({ action: 'focus_lost' }); post({ action: 'save', answers: latest.current }); }
      else if (hiddenSince.current) {
        post({ action: 'focus_back', seconds: (Date.now() - hiddenSince.current) / 1000 });
        hiddenSince.current = null;
        setNotice('Tu as quitté la fenêtre de l’évaluation. C’est noté dans ton journal, comme prévu dans les règles.');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [post]);

  const set = (id: string, v: string) => { const n = { ...answers, [id]: v }; setAnswers(n); latest.current = n; dirty.current = true; };
  const all = sections.flatMap(s => s.questions);
  const answered = all.filter(q => (answers[q.id] ?? '').trim()).length;
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  const [tab, setTab] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [tab]);
  const sec = sections[tab];

  return (
    <div data-exam-focus className="flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0">
      <TextsAside texts={texts} />
      <section className="card p-0 flex-[999_1_560px] min-w-0 flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-line flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`pill text-base px-4 py-1.5 ${left <= 120 ? 'bg-warm-soft text-warm-dark' : 'bg-brand-soft text-brand-dark'}`} role="timer" aria-live="off">
              Temps restant {mm}:{ss}
            </span>
            <span className="sr-only" aria-live="assertive">{[300, 60, 10].includes(left) ? `Il reste ${left >= 60 ? `${left / 60} minute${left > 60 ? 's' : ''}` : `${left} secondes`}.` : ''}</span>
            <span className="text-sm muted">{answered} / {all.length} réponses · sauvegarde automatique</span>
          </div>
          <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-2">
            {sections.map((s, i) => {
              const done = s.questions.filter(q => (answers[q.id] ?? '').trim()).length;
              return (
                <button key={i} role="tab" type="button" aria-selected={tab === i} onClick={() => setTab(i)}
                  className={`navlink gap-1.5 border ${tab === i ? 'bg-brand text-white border-brand hover:bg-brand-dark hover:text-white' : 'border-line'}`}>
                  {s.label.split(' (')[0]} <span className="opacity-80 font-normal">· {done}/{s.questions.length}</span>
                </button>
              );
            })}
          </div>
          {notice && <p role="status" className="m-0 rounded-xl bg-soft px-4 py-2.5 text-sm">{notice}</p>}
        </div>
        <div ref={list} role="tabpanel" className="flex-1 min-h-0 overflow-y-auto pane p-4 sm:p-6 flex flex-col gap-4 [&>*]:shrink-0">
          <h2 className="text-lg font-semibold m-0">{sec.label}</h2>
          {sec.questions.map(q => (
            <section key={q.id} className="rounded-2xl border border-line p-5 flex flex-col gap-3 bg-white">
              <div className="flex gap-2 items-center text-sm"><strong>{q.id.toUpperCase()}</strong><span className="pill bg-soft text-ink-2">{q.points} pt{(q.points ?? 0) > 1 ? 's' : ''}</span></div>
              <p className="m-0 text-[16px] font-medium"><RichText text={q.prompt} /></p>
              <AnswerInput q={q} value={answers[q.id] ?? ''} onChange={v => set(q.id, v)} noPaste
                onPasteBlocked={() => { post({ action: 'paste_blocked' }); setNotice('Le collage est désactivé pendant l’évaluation : écris ta réponse toi-même.'); }} />
            </section>
          ))}
          {tab < sections.length - 1 && <button type="button" className="btn self-end" onClick={() => setTab(tab + 1)}>Section suivante ›</button>}
        </div>
        <div className="shrink-0 border-t border-line px-4 sm:px-6 py-3 bg-surface-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm">Notée sur {total}. Les corrigés s’ouvrent juste après la remise.</span>
          <button className="btn btn-primary" type="button" disabled={pending}
            onClick={() => { if (confirm(answered < all.length ? `Il reste ${all.length - answered} question(s) sans réponse. Remettre ta copie ?` : 'Remettre ta copie ?')) submit(); }}>
            {pending ? 'Remise…' : 'Remettre ma copie'}
          </button>
        </div>
      </section>
    </div>
  );
}
