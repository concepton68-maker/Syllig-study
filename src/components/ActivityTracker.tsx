'use client';
import { useEffect, useRef, useState } from 'react';

// Le temps compte tant que la page de travail est visible et qu'un geste a eu lieu depuis moins de `idleSeconds` (10 min par défaut :
// le délai laisse le temps au brouillon et à la réflexion). Mesuré : page cachée = autre onglet, fenêtre réduite, écran verrouillé,
// autre application sur téléphone ; une fenêtre posée à côté sur ordinateur laisse la page visible.
// Au-delà du délai : « Tu es là ? » avec un compte à rebours de 60 s ; sans réponse, la séance se ferme et le temps s'arrête
// au dernier geste (décision du propriétaire, 26/11/2026). Jamais pendant une évaluation (son chrono officiel continue).
// En plus, sans effet sur le temps : « geste dans la dernière minute » (rythme). Rien de ce qui est tapé n'est transmis.
const COUNTDOWN = 60;

export function ActivityTracker({ kind, courseId, idleSeconds = 600, todaySec, goalMin }: { kind: string; courseId: number | null; idleSeconds?: number; todaySec?: number; goalMin?: number | null }) {
  const session = useRef<string | null>(null);
  const lastInput = useRef(Date.now());
  const [away, setAway] = useState(false);
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(COUNTDOWN);
  // temps du jour affiché en direct : toujours le total compté par le serveur (au chargement, puis renvoyé à chaque signal accepté)
  const [today, setToday] = useState(todaySec ?? 0);

  useEffect(() => {
    let stopped = false;
    const mark = () => { lastInput.current = Date.now(); setPaused(false); setAway(false); setLeft(COUNTDOWN); };
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart', 'mousemove'] as const;
    // capture : le défilement des zones intérieures (pas seulement de la fenêtre) compte comme activité
    events.forEach(e => window.addEventListener(e, mark, { passive: true, capture: true }));
    const isActive = () => document.visibilityState === 'visible' && Date.now() - lastInput.current < idleSeconds * 1000;
    const gesture = () => Date.now() - lastInput.current < 60_000;
    const post = (body: object) => fetch('/api/activity', { method: 'POST', body: JSON.stringify(body), keepalive: true }).then(r => r.json()).catch(() => null);

    post({ action: 'start', kind, courseId }).then(r => { if (!stopped && r?.session) session.current = r.session; });
    const timer = setInterval(() => {
      const idle = Date.now() - lastInput.current;
      setPaused(idle >= idleSeconds * 1000);
      if (idle >= idleSeconds * 1000 && document.visibilityState === 'visible' && kind !== 'evaluation') setAway(true);
      if (session.current) post({ action: 'beat', session: session.current, active: isActive(), gesture: gesture() })
        .then(r => { if (!stopped && typeof r?.today === 'number') setToday(r.today); });
    }, 15_000);
    const end = () => {
      if (session.current) navigator.sendBeacon('/api/activity', JSON.stringify({ action: 'end', session: session.current, active: isActive(), gesture: gesture() }));
      session.current = null;
    };
    window.addEventListener('pagehide', end);
    return () => {
      stopped = true;
      clearInterval(timer);
      events.forEach(e => window.removeEventListener(e, mark, { capture: true }));
      window.removeEventListener('pagehide', end);
      end();
    };
  }, [kind, courseId, idleSeconds]);

  // compte à rebours : sans réponse, la séance se ferme (le temps sans geste n'est pas compté) et l'élève revient à son accueil
  useEffect(() => {
    if (!away) return;
    const t = setInterval(() => setLeft(n => n - 1), 1000);
    return () => clearInterval(t);
  }, [away]);
  const closing = useRef(false);
  useEffect(() => {
    if (!away || left > 0 || closing.current) return;
    closing.current = true;
    const s = session.current;
    session.current = null;
    const abandoned = Math.min(3600, Math.round((Date.now() - lastInput.current) / 1000));
    (s ? fetch('/api/activity', { method: 'POST', body: JSON.stringify({ action: 'end', session: s, active: false, abandoned }) }).catch(() => null) : Promise.resolve())
      .finally(() => { window.location.href = '/eleve?ferme=1'; });
  }, [away, left]);

  const mins = Math.floor(today / 60);
  return (
    <>
      {todaySec !== undefined && (
        <span className="flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap" data-today-bar aria-label={goalMin ? `Aujourd’hui ${mins} minutes sur ${goalMin}` : `Aujourd’hui ${mins} minutes`}>
          {goalMin ? <>{mins >= goalMin ? 'Objectif du jour atteint' : `Aujourd’hui ${mins} / ${goalMin} min`}
            <span className="w-20 h-2 rounded-full bg-track overflow-hidden"><span className="block h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (mins / goalMin) * 100)}%` }} /></span></>
            : <>Aujourd’hui {mins} min</>}
        </span>
      )}
      <span className={`pill ${paused ? 'bg-soft text-ink-2' : 'bg-brand-soft text-brand-dark'}`} aria-live="polite">
        <span className={`w-2 h-2 rounded-full ${paused ? 'bg-muted-2' : 'bg-brand'}`} />
        {paused ? (kind === 'evaluation' ? 'Temps de travail en pause (le chrono de l’évaluation continue)' : 'Temps de travail en pause') : 'Temps de travail compté'}
      </span>
      {away && (
        <div role="dialog" aria-modal="true" aria-labelledby="away-title" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="card max-w-sm flex flex-col gap-3">
            <h2 id="away-title" className="text-xl font-semibold">Tu es là ?</h2>
            <p className="muted m-0">Rien n’a bougé depuis {Math.round(idleSeconds / 60)} min. La séance se ferme dans <strong className="text-ink" data-countdown>{Math.max(0, left)} s</strong>.</p>
            <button className="btn btn-primary" type="button" autoFocus onClick={() => { lastInput.current = Date.now(); setAway(false); setPaused(false); setLeft(COUNTDOWN); }}>Je suis là</button>
          </div>
        </div>
      )}
    </>
  );
}
