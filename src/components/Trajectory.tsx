import { TrendingUp } from 'lucide-react';
import type { Trajectory, Trend } from '@/lib/trajectory';
import { TrajectoryChart, Sparkline } from './TrajectoryChart';

// « Où va-t-il ? » : trajectoire de l'investissement, de la compréhension, par matière, et du ressenti.
const arrow = (t: Trend) => t.dir === 'hausse' ? '▲' : t.dir === 'baisse' ? '▼' : t.dir === 'stable' ? '▬' : '';
const tone = (t: Trend, bad = false) => t.dir === 'inconnue' || t.dir === 'stable' ? 'bg-soft text-ink-2' : (t.dir === 'hausse') !== bad ? 'bg-brand-soft text-brand-dark' : 'bg-warm-soft text-warm-dark';

function reading(tr: Trajectory, name: string) {
  const s = tr.serieux.dir, c = tr.comprehension.dir;
  if (s === 'inconnue' && c === 'inconnue') return `Il faut encore quelques semaines de travail pour dessiner la trajectoire de ${name}.`;
  if (s === 'hausse' && c === 'hausse') return 'Il s’investit davantage et comprend mieux : l’effort paie, dites-le-lui.';
  if (s === 'hausse' && c !== 'hausse') return 'Il s’investit davantage ; la compréhension suit souvent avec quelques semaines de décalage. Encouragez la régularité.';
  if (s === 'baisse' && c === 'baisse') return 'Moins d’investissement et une compréhension en baisse : à aborder vite, avec bienveillance (fatigue, découragement, difficulté ?).';
  if (s === 'baisse') return 'Son investissement baisse alors que la compréhension tient : signe de lassitude plutôt que de difficulté. Un objectif court et atteignable peut relancer.';
  if (c === 'hausse') return 'La compréhension progresse à effort constant : il gagne en efficacité.';
  if (c === 'baisse') return 'La compréhension baisse à effort constant : les notions deviennent plus difficiles, il faut sans doute reprendre une base (voir le test de positionnement).';
  return 'Trajectoire stable pour l’instant.';
}

export function TrajectoryCard({ tr, name }: { tr: Trajectory; name: string }) {
  const hasData = tr.weeks.some(w => w.serieux !== null);
  return (
    <section className="card flex flex-col gap-4" aria-labelledby="trajectoire" data-trajectory>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="trajectoire" className="text-xl font-semibold m-0 flex items-center gap-2 mr-auto"><TrendingUp size={20} aria-hidden="true" />Où va-t-il ? La trajectoire sur 12 semaines</h2>
        <span className={`pill ${tone(tr.serieux)}`} data-trend-serieux={tr.serieux.dir}>Investissement {arrow(tr.serieux)} {tr.serieux.text}</span>
        <span className={`pill ${tone(tr.comprehension)}`} data-trend-comprehension={tr.comprehension.dir}>Compréhension {arrow(tr.comprehension)} {tr.comprehension.text}</span>
      </div>
      <p className="m-0 text-sm" data-reading>{reading(tr, name)}</p>
      {hasData && <>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-[3px] rounded" style={{ background: '#2F4FD8' }} />Investissement de la semaine</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-[3px] rounded" style={{ background: '#00b894' }} />Compréhension (3 semaines glissantes, travail sérieux seulement)</span>
        </div>
        <TrajectoryChart points={tr.weeks} />
        <details className="text-sm">
          <summary className="cursor-pointer muted">Voir les chiffres semaine par semaine</summary>
          <table className="w-full mt-2 text-sm">
            <thead><tr className="text-left muted"><th className="py-1 font-medium">Semaine du</th><th className="font-medium">Investissement</th><th className="font-medium">Compréhension</th><th className="font-medium">Travail effectif</th></tr></thead>
            <tbody>{tr.weeks.map(w => <tr key={w.week} className="border-t border-soft"><td className="py-1">{w.label}</td><td>{w.serieux ?? '—'}{w.serieux !== null ? ' %' : ''}</td><td>{w.comprehension ?? '—'}{w.comprehension !== null ? ' %' : ''}</td><td>{w.minutes} min</td></tr>)}</tbody>
          </table>
        </details>
      </>}
      {tr.subjects.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-base font-semibold m-0">Dans quoi il progresse</h3>
          <ul className="list-none m-0 p-0 flex flex-col">
            {tr.subjects.map(s => (
              <li key={s.subject} className="grid grid-cols-[minmax(110px,160px)_1fr_auto] max-sm:grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2 border-t border-soft first:border-t-0" data-subject-trend={s.subject}>
                <span className="text-sm font-semibold">{s.subject}<span className="block muted font-normal text-xs">{s.points.length} mesures</span></span>
                <span className="max-sm:col-span-2 max-sm:order-3"><Sparkline values={s.points.map(p => p.v)} /></span>
                <span className="text-right"><strong className="tabular-nums">{s.last} %</strong><span className={`block pill text-xs mt-0.5 ${tone(s.trend)}`}>{arrow(s.trend)} {s.trend.dir === 'inconnue' ? 'à suivre' : s.trend.text}</span></span>
              </li>
            ))}
          </ul>
          <span className="muted text-xs">Chaque point : une série d’exercices ou une évaluation faite sérieusement (en % de réussite).</span>
        </div>
      )}
      {tr.feelings.some(f => f.values.length >= 2) && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-base font-semibold m-0">Son ressenti, d’un questionnaire à l’autre</h3>
          <ul className="list-none m-0 p-0 grid gap-2 sm:grid-cols-2">
            {tr.feelings.filter(f => f.values.length >= 2).map(f => {
              const a = f.values[0].v, b = f.values.at(-1)!.v, d = b - a;
              const good = f.bad ? d < 0 : d > 0;
              return (
                <li key={f.dim} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm" data-feeling={f.dim}>
                  <span>{f.label}</span>
                  <span className="tabular-nums">{a} % → <strong>{b} %</strong> <span className={Math.abs(d) < 10 ? 'muted' : good ? 'text-brand-dark' : 'text-warm-dark'}>{Math.abs(d) < 10 ? '▬' : d > 0 ? '▲' : '▼'}</span></span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
