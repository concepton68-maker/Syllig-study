'use client';
import { useEffect, useState } from 'react';

// Partie « en direct » : état de l'élève à l'instant et frise de la journée, rafraîchis toutes les 10 secondes.
type Live = { state: 'travaille' | 'pause' | 'hors_ligne'; since: string | null; lastSeen: string | null; kind: string | null; course: string | null; sessionMin: number; sessionActiveMin: number };
type Segment = { start: string; end: string; state: 'travail' | 'pause'; kind: string; course: string | null };
type Data = { live: Live; today: { day: string; segments: Segment[]; active: number; pause: number }; now: string };

export const C_WORK = '#2F4FD8', C_PAUSE = '#f47230';
const KIND: Record<string, string> = { lesson: 'Leçon', exercises: 'Exercices', evaluation: 'Évaluation', review: 'Révision', other: 'Travail' };
const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
const dur = (s: number) => { const m = Math.floor(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const ago = (iso: string, now: Date) => {
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'à l’instant'; if (m < 60) return `depuis ${m} min`; if (m < 24 * 60) return `depuis ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  return `depuis le ${new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })}`;
};
// heure de Paris en heures décimales
const parisH = (d: Date) => { const [h, m] = d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).split(':').map(Number); return h + m / 60 + d.getSeconds() / 3600; };

export function LiveBoard({ studentId, name, initial, idleMin = 10 }: { studentId: string; name: string; initial: Data; idleMin?: number }) {
  const [data, setData] = useState<Data>(initial);
  const [tip, setTip] = useState<{ x: number; seg: Segment } | null>(null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      try { const r = await fetch(`/api/parent/live?eleve=${studentId}`, { cache: 'no-store' }); if (r.ok && !stop) setData(await r.json()); } catch { /* réseau : on réessaiera */ }
    };
    const t = setInterval(load, 10_000);
    return () => { stop = true; clearInterval(t); };
  }, [studentId]);

  const { live, today } = data;
  const now = new Date(data.now);
  const label = live.state === 'travaille' ? 'Actif sur une page de travail' : live.state === 'pause' ? 'Page de travail ouverte, sans geste' : 'Aucune page de travail ouverte';
  const dot = live.state === 'travaille' ? C_WORK : live.state === 'pause' ? C_PAUSE : '#98A2B3';
  // fenêtre de la frise : 8 h – 21 h, élargie si besoin
  const hs = today.segments.flatMap(s => [parisH(new Date(s.start)), parisH(new Date(s.end))]);
  const h0 = Math.floor(Math.min(8, ...hs)), h1 = Math.ceil(Math.max(21, parisH(now) > 21 ? parisH(now) : 21, ...hs));
  const W = 1000, x = (h: number) => ((h - h0) / (h1 - h0)) * W;
  const nowH = parisH(now);

  return (
    <>
      <section className="card flex flex-wrap items-center gap-x-6 gap-y-3" data-live={live.state} aria-live="polite">
        <span className="relative flex size-4 shrink-0" aria-hidden>
          {live.state !== 'hors_ligne' && <span className="absolute inline-flex size-full rounded-full opacity-60 animate-ping" style={{ background: dot }} />}
          <span className="relative inline-flex size-4 rounded-full" style={{ background: dot }} />
        </span>
        <span className="flex-[1_1_240px] min-w-0">
          <span className="block text-2xl font-bold" data-live-label>{label}</span>
          <span className="block muted text-sm">
            {live.state === 'hors_ligne'
              ? (live.lastSeen ? `Dernière activité ${ago(live.lastSeen, now).replace('depuis', 'il y a').replace('il y a le', 'le')}` : `${name} n’a encore jamais travaillé sur la plateforme.`)
              : `${live.since ? ago(live.since, now) : ''} · ${KIND[live.kind ?? 'other']}${live.course ? ` : ${live.course}` : ''}`}
          </span>
        </span>
        {live.state !== 'hors_ligne' && (
          <span className="text-sm"><strong className="text-lg">{live.sessionActiveMin} min</strong> actives sur cette page<span className="block muted">sur {live.sessionMin} min depuis son ouverture</span></span>
        )}
        <span className="muted text-xs basis-full">Mise à jour toutes les 10 secondes. « Actif » : page de travail visible, avec un geste dans les {idleMin} dernières minutes (le délai laisse le temps au brouillon). « Sans geste » : rien touché depuis {idleMin} min, ou page cachée (autre onglet, fenêtre réduite, écran verrouillé).</span>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <h2 className="text-lg font-semibold mr-auto">Aujourd’hui, heure par heure</h2>
          <span className="flex items-center gap-1.5 text-sm"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: C_WORK }} /> Actif <strong data-today-active>{dur(today.active)}</strong></span>
          <span className="flex items-center gap-1.5 text-sm"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: C_PAUSE }} /> Sans geste <strong>{dur(today.pause)}</strong></span>
        </div>
        <div className="relative" onMouseLeave={() => setTip(null)}>
          <div className="relative h-[30px] mt-5">
            <svg viewBox={`0 0 ${W} 30`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full block rounded-md" role="img" aria-label={`Frise de la journée : ${dur(today.active)} de travail effectif, ${dur(today.pause)} de pause`}>
              <rect x={0} y={0} width={W} height={30} fill="var(--color-track)" />
              {today.segments.map((s, i) => {
                const a = x(parisH(new Date(s.start))), b = x(parisH(new Date(s.end)));
                const w = Math.max(3, b - a - 1);
                return <rect key={i} data-seg={s.state} x={a} y={0} width={w} height={30} fill={s.state === 'travail' ? C_WORK : C_PAUSE}
                  onMouseEnter={() => setTip({ x: (a + w / 2) / W, seg: s })} onFocus={() => setTip({ x: (a + w / 2) / W, seg: s })} tabIndex={0} />;
              })}
            </svg>
            {nowH >= h0 && nowH <= h1 && (
              <span className="absolute -top-5 bottom-[-6px] border-l-2 border-dashed border-ink pointer-events-none" style={{ left: `${(x(nowH) / W) * 100}%` }}>
                <span className={`absolute -top-0.5 text-[11px] font-semibold whitespace-nowrap ${nowH > h1 - 2 ? 'right-1' : 'left-1'}`}>maintenant</span>
              </span>
            )}
          </div>
          <div className="relative h-5 text-xs muted tabular-nums">
            {Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i).filter(h => h % 2 === 0).map(h => (
              <span key={h} className="absolute top-1 -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(97, Math.max(2, (x(h) / W) * 100))}%` }}>{h} h</span>
            ))}
          </div>
          {tip && (
            <div className="absolute top-3 -translate-x-1/2 -translate-y-full bg-ink text-white text-xs rounded-md px-2.5 py-1.5 pointer-events-none whitespace-nowrap shadow"
              style={{ left: `${Math.min(88, Math.max(12, tip.x * 100))}%` }}>
              <strong>{tip.seg.state === 'travail' ? 'Actif' : 'Sans geste'}</strong> · {hhmm(new Date(tip.seg.start))} – {hhmm(new Date(tip.seg.end))} ({dur((new Date(tip.seg.end).getTime() - new Date(tip.seg.start).getTime()) / 1000)})
              <span className="block opacity-80">{KIND[tip.seg.kind] ?? 'Travail'}{tip.seg.course ? ` · ${tip.seg.course}` : ''}</span>
            </div>
          )}
        </div>
        {today.segments.length === 0 && <span className="muted text-sm">Aucune activité aujourd’hui pour l’instant.</span>}
      </section>
    </>
  );
}
