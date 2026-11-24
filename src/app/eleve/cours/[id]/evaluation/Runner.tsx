'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { PublicQuestion, SupportText } from '@/lib/course-format';
import { RichText } from '@/components/RichText';
import { AnswerProgress } from '@/components/AnswerProgress';

import { AnswerInput, TextsAside } from '../exercices/Player';
import { submitEvaluation } from './actions';
import { isStaleBuildError, reloadOnceForNewVersion } from '@/lib/stale-build';

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

  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    setFailed(false);
    start(async () => {
      try { await submitEvaluation(courseId, attemptId, latest.current); }
      catch (e) {
        if (String((e as { digest?: string })?.digest ?? '').startsWith('NEXT_REDIRECT')) throw e;   // redirection vers le bilan
        if (isStaleBuildError((e as Error)?.message) && reloadOnceForNewVersion()) return;          // nouvelle version en ligne : les réponses sont déjà enregistrées
        submitted.current = false; setFailed(true);                                                 // réseau coupé… : l'élève peut réessayer
      }
    });
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
  // seules les réponses modifiées sont envoyées (le serveur fusionne) : une page affichée trop tôt n'efface jamais rien
  const dirty = useRef(new Set<string>());
  const touched = useRef(new Set<string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePart = useCallback(() => {
    if (submitted.current || dirty.current.size === 0) return;
    const part = Object.fromEntries([...dirty.current].map(k => [k, latest.current[k] ?? '']));
    dirty.current.clear();
    post({ action: 'save', answers: part });
  }, [post]);
  useEffect(() => {
    const t = setInterval(savePart, 10_000);
    return () => clearInterval(t);
  }, [post]);

  // Départ de la page (navigation, fermeture) : dernière sauvegarde
  useEffect(() => {
    const onHide = () => savePart();
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); onHide(); };
  }, [post]);

  // Sorties de fenêtre : enregistrées, présentées sans accusation
  useEffect(() => {
    const onVis = () => {
      // la sortie n'est comptée qu'au retour dans la fenêtre : recharger ou changer de page ne compte pas comme une sortie
      if (document.visibilityState === 'hidden') { hiddenSince.current = Date.now(); savePart(); }
      else if (hiddenSince.current) {
        post({ action: 'focus_lost' });
        post({ action: 'focus_back', seconds: (Date.now() - hiddenSince.current) / 1000 });
        hiddenSince.current = null;
        setNotice('Tu as quitté la fenêtre de l’évaluation. Reste sur cette page jusqu’à la fin.');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [post]);

  const set = (id: string, v: string) => {
    const n = { ...latest.current, [id]: v }; setAnswers(n); latest.current = n;
    dirty.current.add(id); touched.current.add(id);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(savePart, 700);
  };
  // à l'ouverture : on relit les réponses enregistrées (une sauvegarde a pu arriver après l'affichage de la page)
  useEffect(() => {
    fetch(`/api/eval/${attemptId}`).then(r => r.ok ? r.json() : null).then((d: { answers?: Record<string, string> } | null) => {
      if (!d?.answers) return;
      const merged = { ...latest.current };
      for (const [k, v] of Object.entries(d.answers)) if (!touched.current.has(k) && v.trim() && v !== merged[k]) merged[k] = v;
      latest.current = merged; setAnswers(merged);
    }).catch(() => null);
  }, [attemptId]);
  const all = sections.flatMap(s => s.questions);
  const answered = all.filter(q => (answers[q.id] ?? '').trim()).length;
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  const [tab, setTab] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [tab]);
  const sec = sections[tab];
  const jump = () => {
    const i = sections.findIndex(x => x.questions.some(q => !(answers[q.id] ?? '').trim()));
    if (i < 0) return;
    const q = sections[i].questions.find(q => !(answers[q.id] ?? '').trim())!;
    setTab(i);
    setTimeout(() => {
      const el = document.getElementById(`q-${q.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el?.querySelector('input, textarea') as HTMLElement | null)?.focus({ preventScroll: true });
    }, 60);
  };

  return (
    <div data-exam-focus className="flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0">
      <TextsAside texts={texts} />
      <section className="card p-0 flex-[999_1_560px] min-w-0 flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
        <AnswerProgress answered={answered} total={all.length} onJump={jump} />
        <div className="shrink-0 px-4 pt-3 pb-3 border-b border-line flex flex-col gap-3 qtabs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`pill text-base px-4 py-1.5 ${left <= 120 ? 'bg-warm-soft text-warm-dark' : 'bg-brand-soft text-brand-dark'}`} role="timer" aria-live="off">
              Temps restant {mm}:{ss}
            </span>
            <span className="sr-only" aria-live="assertive">{[300, 60, 10].includes(left) ? `Il reste ${left >= 60 ? `${left / 60} minute${left > 60 ? 's' : ''}` : `${left} secondes`}.` : ''}</span>
            <span className="text-sm muted">Sauvegarde automatique</span>
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
            <section key={q.id} id={`q-${q.id}`} className={`rounded-2xl border p-5 flex flex-col gap-3 bg-white scroll-mt-4 ${(answers[q.id] ?? '').trim() ? 'border-brand-mid' : 'border-line'}`}>
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
{failed && <span role="alert" className="text-sm font-semibold text-warm-dark">La remise n’a pas abouti (connexion ?). Réessaie : tes réponses sont gardées.</span>}
          {confirming && !pending ? (
            <span role="alertdialog" aria-label="Confirmer la remise" className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{answered < all.length ? `Il reste ${all.length - answered} question${all.length - answered > 1 ? 's' : ''} sans réponse. Remettre ta copie ?` : 'Remettre ta copie ?'}</span>
              <button className="btn btn-primary" type="button" autoFocus onClick={submit}>Oui, remettre</button>
              <button className="btn" type="button" onClick={() => setConfirming(false)}>Continuer</button>
            </span>
          ) : (
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => setConfirming(true)}>
              {pending ? 'Remise…' : 'Remettre ma copie'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
