'use client';
import { useState } from 'react';

// Trajectoire semaine par semaine : investissement et compréhension (même échelle 0–100 %, un seul axe).
// Lignes en SVG étiré (trait constant), points et textes en HTML : lisible du téléphone à l'ordinateur.
export type TPoint = { week: string; label: string; serieux: number | null; comprehension: number | null; minutes: number; measures: number };
const C_S = '#2F4FD8', C_C = '#00b894';

function path(vals: (number | null)[]) {
  const n = vals.length; let d = '', pen = false;
  vals.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    const x = n > 1 ? (i / (n - 1)) * 100 : 50, y = 100 - v;
    d += `${pen ? 'L' : 'M'}${x},${y} `; pen = true;
  });
  return d;
}

export function TrajectoryChart({ points }: { points: TPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const series = [
    { key: 'serieux' as const, label: 'Investissement', color: C_S },
    { key: 'comprehension' as const, label: 'Compréhension', color: C_C },
  ];
  const lastOf = (k: 'serieux' | 'comprehension') => { for (let i = n - 1; i >= 0; i--) if (points[i][k] !== null) return i; return -1; };
  return (
    <div className="flex flex-col gap-1.5" onMouseLeave={() => setHover(null)}>
      <div className="relative h-52 ml-12 mr-3 mt-2">
        {[0, 25, 50, 75, 100].map(t => (
          <span key={t} className="absolute left-0 right-0 border-t border-line" style={{ bottom: `${t}%` }}>
            <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs muted tabular-nums whitespace-nowrap">{t} %</span>
          </span>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
          {series.map(s => {
            // semaines terminées en trait plein ; la semaine en cours (pas finie) en pointillés
            const vals = points.map(p => p[s.key]);
            const cur = vals.at(-1), prev = vals.at(-2);
            return <g key={s.key}>
              <path d={path(vals.slice(0, -1).concat([null]))} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {cur != null && prev != null && <line x1={x(n - 2)} y1={100 - prev} x2={x(n - 1)} y2={100 - cur} stroke={s.color} strokeWidth={2} strokeDasharray="4 4" opacity={0.7} vectorEffect="non-scaling-stroke" />}
            </g>;
          })}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={100} stroke="var(--color-ink-2)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {series.map(s => points.map((p, i) => p[s.key] === null ? null : (
          <span key={`${s.key}${i}`} className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white pointer-events-none" data-point={s.key}
            style={{ left: `${x(i)}%`, bottom: `${p[s.key]}%`, background: i === n - 1 ? 'white' : s.color, boxShadow: i === n - 1 ? `inset 0 0 0 2px ${s.color}` : undefined }} />
        )))}
        {series.map(s => { const i = lastOf(s.key); return i < 0 ? null : (
          <span key={`lbl${s.key}`} className="absolute text-xs font-semibold whitespace-nowrap pointer-events-none -translate-y-1/2 max-sm:hidden"
            style={{ left: `calc(${x(i)}% + 8px)`, bottom: `${points[i][s.key]}%`, color: 'var(--color-ink-2)' }}>{points[i][s.key]} %</span>
        ); })}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, marginLeft: `-${50 / (n - 1)}%`, marginRight: `-${50 / (n - 1)}%` }}>
          {points.map((p, i) => <span key={p.week} data-week={p.week} tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none" />)}
        </div>
        {hover !== null && (
          <div className="absolute top-0 z-10 bg-ink text-white text-xs rounded-md px-2.5 py-1.5 pointer-events-none whitespace-nowrap shadow -translate-x-1/2"
            style={{ left: `${Math.min(82, Math.max(18, x(hover)))}%` }}>
            <strong>Semaine du {points[hover].label}</strong>
            <span className="block">Investissement : {points[hover].serieux ?? '—'}{points[hover].serieux !== null ? ' %' : ''}</span>
            <span className="block">Compréhension : {points[hover].comprehension ?? 'pas de mesure'}{points[hover].comprehension !== null ? ' %' : ''}</span>
            <span className="block opacity-80">{points[hover].minutes} min de travail effectif</span>
          </div>
        )}
      </div>
      <div className="relative h-4 ml-12 mr-3 text-xs muted">
        {points.map((p, i) => (i % 2 === (n - 1) % 2 ? <span key={p.week} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>{i === n - 1 ? 'cette sem.' : p.label}</span> : null))}
      </div>
    </div>
  );
}

// Petite courbe d'une matière (scores successifs)
export function Sparkline({ values, color = '#2F4FD8' }: { values: number[]; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8 block overflow-visible" aria-hidden="true">
      <line x1={0} x2={100} y1={50} y2={50} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={path(values)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
