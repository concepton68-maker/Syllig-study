'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion, SupportText } from '@/lib/course-format';
import { RichText } from '@/components/RichText';
import { SupportTextView } from '@/components/CourseBlocks';
import { AnswerInput } from '../exercices/Player';
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

  return (
    <div className="flex flex-col gap-5">
      <div className="card sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 border-brand-mid">
        <span className={`pill text-base px-4 py-1.5 ${left <= 120 ? 'bg-warm-soft text-warm-dark' : 'bg-brand-soft text-brand-dark'}`} role="timer" aria-live={left <= 60 ? 'assertive' : 'off'}>
          Temps restant {mm}:{ss}
        </span>
        <span className="text-sm muted">{answered} / {all.length} réponses · sauvegarde automatique</span>
      </div>
      {notice && <p role="status" className="m-0 rounded-xl bg-soft px-4 py-3 text-sm">{notice}</p>}
      {texts.map(t => <SupportTextView key={t.id} t={t} />)}
      {sections.map((s, si) => (
        <div key={si} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold mt-2">{s.label}</h2>
          {s.questions.map(q => (
            <section key={q.id} className="card flex flex-col gap-3">
              <div className="flex gap-2 items-center text-sm"><strong>{q.id.toUpperCase()}</strong><span className="pill bg-soft text-ink-2">{q.points} pt{(q.points ?? 0) > 1 ? 's' : ''}</span></div>
              <p className="m-0 text-[16px] font-medium"><RichText text={q.prompt} /></p>
              <AnswerInput q={q} value={answers[q.id] ?? ''} onChange={v => set(q.id, v)} noPaste
                onPasteBlocked={() => { post({ action: 'paste_blocked' }); setNotice('Le collage est désactivé pendant l’évaluation : écris ta réponse toi-même.'); }} />
            </section>
          ))}
        </div>
      ))}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">Évaluation notée sur {total}. Tu pourras voir les corrigés juste après la remise.</span>
        <button className="btn btn-primary" type="button" disabled={pending}
          onClick={() => { if (confirm(answered < all.length ? `Il reste ${all.length - answered} question(s) sans réponse. Remettre ta copie ?` : 'Remettre ta copie ?')) submit(); }}>
          {pending ? 'Remise…' : 'Remettre ma copie'}
        </button>
      </div>
    </div>
  );
}
