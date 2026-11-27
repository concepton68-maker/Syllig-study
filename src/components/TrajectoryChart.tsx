'use client';
import { useState } from 'react';
import { duree } from '@/lib/duration';

// Graphiques de la trajectoire : barres (temps par semaine) et courbes de réussite (même unité, un seul axe 0–100 %).
// Lignes en SVG étiré (trait constant), points, textes et bulles en HTML : lisible du téléphone à l'ordinateur.
export type Bar = { key: string; label: string; value: number; current?: boolean; tip: string[] };
export type Line = { key: string; label: string; color: string; values: ({ v: number; tip: string } | null)[] };

function path(vals: (number | null)[]) {
  const n = vals.length; let d = '', pen = false;
  vals.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${n > 1 ? (i / (n - 1)) * 100 : 50},${100 - v} `; pen = true;
  });
  return d;
}

function Tip({ x, lines }: { x: number; lines: string[] }) {
  return (
    <div className="absolute top-0 z-10 bg-ink text-white text-xs rounded-md px-2.5 py-1.5 pointer-events-none whitespace-nowrap shadow -translate-x-1/2" style={{ left: `${Math.min(82, Math.max(18, x))}%` }}>
      <strong>{lines[0]}</strong>{lines.slice(1).map(l => <span key={l} className="block">{l}</span>)}
    </div>
  );
}

export function WeeklyBars({ bars, goal, unit = 'min' }: { bars: Bar[]; goal?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(goal ? goal * 1.15 : 0, ...bars.map(b => b.value), 30);
  const step = max > 600 ? 120 : max > 240 ? 60 : 30;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return (
    <div className="flex flex-col gap-1.5" onMouseLeave={() => setHover(null)}>
      <div className="relative h-40 ml-12 mr-1">
        {ticks.map(t => <span key={t} className="absolute left-0 right-0 border-t border-line" style={{ bottom: `${(t / max) * 100}%` }}>
          <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs muted tabular-nums whitespace-nowrap">{unit === 'hhmm' ? duree(t) : `${t} ${unit}`}</span></span>)}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
          {bars.map((b, i) => (
            <div key={b.key} data-bar-week={b.key} tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              className={`relative flex flex-col-reverse items-center outline-none ${hover === i ? 'bg-soft' : ''}`}>
              {b.value > 0 && <span className="w-[55%] max-w-9 rounded-[4px]" style={{ height: `${(b.value / max) * 100}%`, background: b.current ? 'transparent' : '#2F4FD8', border: b.current ? '2px dashed #2F4FD8' : undefined }} />}
            </div>
          ))}
        </div>
        {goal ? <span className="absolute left-0 right-0 border-t-2 border-dashed border-ink-2 pointer-events-none" style={{ bottom: `${(goal / max) * 100}%` }} /> : null}
        {hover !== null && <Tip x={((hover + 0.5) / bars.length) * 100} lines={bars[hover].tip} />}
      </div>
      <div className="grid ml-12 mr-1 text-[11px] text-center muted" style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
        {bars.map((b, i) => <span key={b.key} className={i % 2 === (bars.length - 1) % 2 ? '' : 'max-sm:invisible'}>{b.current ? 'cette sem.' : b.label}</span>)}
      </div>
    </div>
  );
}

export function RateLines({ lines, labels }: { lines: Line[]; labels: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  return (
    <div className="flex flex-col gap-1.5" onMouseLeave={() => setHover(null)}>
      <div className="relative h-44 ml-12 mr-3 mt-2">
        {[0, 25, 50, 75, 100].map(t => <span key={t} className="absolute left-0 right-0 border-t border-line" style={{ bottom: `${t}%` }}>
          <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs muted tabular-nums whitespace-nowrap">{t} %</span></span>)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
          {lines.map(l => <path key={l.key} d={path(l.values.map(v => v?.v ?? null))} fill="none" stroke={l.color} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={100} stroke="var(--color-ink-2)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {lines.map(l => l.values.map((v, i) => v === null ? null : (
          <span key={`${l.key}${i}`} data-point={l.key} className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white pointer-events-none" style={{ left: `${x(i)}%`, bottom: `${v.v}%`, background: l.color }} />
        )))}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, marginLeft: `-${50 / Math.max(1, n - 1)}%`, marginRight: `-${50 / Math.max(1, n - 1)}%` }}>
          {labels.map((lb, i) => <span key={i} data-week={i} tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none" />)}
        </div>
        {hover !== null && <Tip x={x(hover)} lines={[`Semaine du ${labels[hover]}`, ...lines.map(l => `${l.label} : ${l.values[hover]?.tip ?? 'pas de mesure'}`)]} />}
      </div>
      <div className="relative h-4 ml-12 mr-3 text-[11px] muted">
        {labels.map((lb, i) => (i % 2 === (n - 1) % 2 ? <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>{i === n - 1 ? 'cette sem.' : lb}</span> : null))}
      </div>
    </div>
  );
}

// Petite courbe d'une matière : chaque résultat dans l'ordre du temps
export function Sparkline({ values, color = '#2F4FD8' }: { values: number[]; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8 block overflow-visible" aria-hidden="true">
      <line x1={0} x2={100} y1={50} y2={50} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={path(values)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
