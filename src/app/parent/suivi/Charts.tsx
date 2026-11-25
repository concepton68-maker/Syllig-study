'use client';
import { useState } from 'react';
import { C_WORK, C_PAUSE } from './LiveBoard';

const dur = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };

// 7 derniers jours : barres empilées temps actif / temps sans geste (page ouverte).
// En HTML (pas en SVG mis à l'échelle) pour que les textes restent lisibles sur téléphone.
export function WeekBars({ days, goalMin }: { days: { day: string; label: string; active: number; pause: number }[]; goalMin: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const goal = goalMin * 60;
  const max = Math.max(goal * 1.2, ...days.map(d => d.active + d.pause), 600);
  const step = max > 4 * 3600 ? 3600 : max > 2 * 3600 ? 1800 : max > 3600 ? 1200 : 600;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="flex flex-col gap-1.5" onMouseLeave={() => setHover(null)}>
      <div className="relative h-44 ml-12" role="img" aria-label="Temps de travail des 7 derniers jours (détail dans « Voir les chiffres »)">
        {ticks.map(t => (
          <span key={t} className="absolute left-0 right-0 border-t border-line" style={{ bottom: pct(t) }}>
            <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs muted tabular-nums">{dur(t)}</span>
          </span>
        ))}
        <div className="absolute inset-0 grid grid-cols-7">
          {days.map((d, i) => (
            <div key={d.day} data-day={d.day} tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              className={`relative flex flex-col-reverse items-center outline-none ${hover === i ? 'bg-soft' : ''}`}>
              {d.active > 0 && <span data-bar="travail" className="w-[55%] max-w-11 rounded-[4px]" style={{ height: pct(d.active), background: C_WORK }} />}
              {d.pause > 0 && <span data-bar="pause" className="w-[55%] max-w-11 rounded-[4px]" style={{ height: `calc(${pct(d.pause)} - ${d.active > 0 ? 2 : 0}px)`, marginBottom: d.active > 0 ? 2 : 0, background: C_PAUSE }} />}
            </div>
          ))}
        </div>
        {goal > 0 && <span className="absolute left-0 right-0 border-t-2 border-dashed border-ink-2 pointer-events-none" style={{ bottom: pct(goal) }} />}
        {hover !== null && (
          <div className="absolute top-0 bg-ink text-white text-xs rounded-md px-2.5 py-1.5 pointer-events-none whitespace-nowrap shadow -translate-x-1/2 z-10"
            style={{ left: `${Math.min(80, Math.max(20, ((hover + 0.5) / days.length) * 100))}%` }}>
            <strong>{new Date(`${days[hover].day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
            <span className="block">Actif : {dur(days[hover].active)}</span>
            <span className="block">Sans geste : {dur(days[hover].pause)}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 ml-12 text-xs text-center">
        {days.map((d, i) => <span key={d.day} className={i === days.length - 1 ? 'font-bold text-ink' : 'muted'}>{i === days.length - 1 ? 'auj.' : d.label}</span>)}
      </div>
    </div>
  );
}

// Barre de répartition (une seule barre segmentée, légende avec valeurs)
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <span className="muted text-sm">Pas encore de travail sur cette période.</span>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-5 w-full gap-[2px]" role="img" aria-label={parts.map(p => `${p.label} ${Math.round((p.value / total) * 100)} %`).join(', ')}>
        {parts.filter(p => p.value > 0).map((p, i, arr) => (
          <span key={p.label} data-tip={`${p.label} · ${dur(p.value)}`} tabIndex={0} style={{ flexGrow: p.value, background: p.color }}
            className={`min-w-[4px] ${i === 0 ? 'rounded-l' : ''} ${i === arr.length - 1 ? 'rounded-r' : ''}`} />
        ))}
      </div>
      <ul className="list-none m-0 p-0 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {parts.filter(p => p.value > 0).map(p => (
          <li key={p.label} className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: p.color }} />{p.label} <strong>{Math.round((p.value / total) * 100)} %</strong><span className="muted">({dur(p.value)})</span></li>
        ))}
      </ul>
    </div>
  );
}

// Liste de barres horizontales (une seule teinte : on compare des quantités)
export function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <span className="muted text-sm">Pas encore de travail sur cette période.</span>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2">
      {rows.map(r => (
        <li key={r.label} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-3 rounded-full bg-track overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: C_WORK }} /></span>
          <strong className="tabular-nums">{dur(r.value)}</strong>
        </li>
      ))}
    </ul>
  );
}
