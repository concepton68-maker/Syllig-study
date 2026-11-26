'use client';
import { useEffect, useRef, useState } from 'react';

// Le temps compte tant que la page de travail est visible et qu'un geste a eu lieu depuis moins de `idleSeconds` (10 min par défaut :
// le délai laisse le temps au brouillon et à la réflexion). Mesuré : page cachée = autre onglet, fenêtre réduite, écran verrouillé,
// autre application sur téléphone ; une fenêtre posée à côté sur ordinateur laisse la page visible.
// Rien de ce qui est tapé n'est transmis : seulement « actif » ou « inactif ».
export function ActivityTracker({ kind, courseId, idleSeconds = 600 }: { kind: string; courseId: number | null; idleSeconds?: number }) {
  const session = useRef<string | null>(null);
  const lastInput = useRef(Date.now());
  const [away, setAway] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let stopped = false;
    const mark = () => { lastInput.current = Date.now(); setPaused(false); setAway(false); };
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart', 'mousemove'] as const;
    // capture : le défilement des zones intérieures (pas seulement de la fenêtre) compte comme activité
    events.forEach(e => window.addEventListener(e, mark, { passive: true, capture: true }));
    const isActive = () => document.visibilityState === 'visible' && Date.now() - lastInput.current < idleSeconds * 1000;
    const post = (body: object) => fetch('/api/activity', { method: 'POST', body: JSON.stringify(body), keepalive: true }).then(r => r.json()).catch(() => null);

    post({ action: 'start', kind, courseId }).then(r => { if (!stopped && r?.session) session.current = r.session; });
    const timer = setInterval(() => {
      const idle = Date.now() - lastInput.current;
      setPaused(idle >= idleSeconds * 1000);
      if (idle >= idleSeconds * 1000 && document.visibilityState === 'visible' && kind !== 'evaluation') setAway(true);   // jamais pendant une évaluation
      if (session.current) post({ action: 'beat', session: session.current, active: isActive() });
    }, 15_000);
    const end = () => {
      if (session.current) navigator.sendBeacon('/api/activity', JSON.stringify({ action: 'end', session: session.current, active: isActive() }));
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

  return (
    <>
      <span className={`pill ${paused ? 'bg-soft text-ink-2' : 'bg-brand-soft text-brand-dark'}`} aria-live="polite">
        <span className={`w-2 h-2 rounded-full ${paused ? 'bg-muted-2' : 'bg-brand'}`} />
        {paused ? (kind === 'evaluation' ? 'Temps de travail en pause (le chrono de l’évaluation continue)' : 'Temps de travail en pause') : 'Temps de travail compté'}
      </span>
      {away && (
        <div role="dialog" aria-modal="true" aria-labelledby="away-title" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="card max-w-sm flex flex-col gap-3">
            <h2 id="away-title" className="text-xl font-semibold">Tu es là ?</h2>
            <p className="muted m-0">Le temps de travail est en pause. Il reprend dès que tu continues.</p>
            <button className="btn btn-primary" type="button" autoFocus onClick={() => { lastInput.current = Date.now(); setAway(false); setPaused(false); }}>Je reprends</button>
          </div>
        </div>
      )}
    </>
  );
}
