import { TrendingUp } from 'lucide-react';
import { MIN_ITEMS, type Trajectory } from '@/lib/trajectory';
import { WeeklyBars, RateLines } from './TrajectoryChart';
import { duree } from '@/lib/duration';

// Trajectoire sur 12 semaines : les mesures semaine après semaine et une comparaison chiffrée. Aucune extrapolation, aucune cause supposée.
const C_CP = '#2F4FD8', C_EX = '#00b894';
const ratio = (ok: number, t: number) => t ? (t >= MIN_ITEMS ? `${Math.round((ok / t) * 100)} % (${ok} sur ${t})` : `${ok} sur ${t} (trop peu pour un %)`) : null;

export function TrajectoryCard({ tr, name, goalMin }: { tr: Trajectory; name: string; goalMin: number }) {
  const any = tr.weeks.some(w => w.minutes > 0 || w.cp_total || w.ex_total);
  const labels = tr.weeks.map(w => w.label);
  return (
    <section className="card flex flex-col gap-4" aria-labelledby="trajectoire" data-trajectory>
      <h2 id="trajectoire" className="text-xl font-semibold m-0 flex items-center gap-2"><TrendingUp size={20} aria-hidden="true" />Évolution sur 12 semaines</h2>
      {!any ? <p className="m-0 text-sm muted">Pas encore de travail mesuré pour {name} sur cette période.</p> : <>
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold m-0">Les 4 dernières semaines terminées, comparées aux 4 précédentes</h3>
          <ul className="list-none m-0 p-0 grid gap-x-6 sm:grid-cols-2" data-compare>
            {tr.compare.map(c => (
              <li key={c.label} className="flex items-baseline justify-between gap-3 py-1.5 border-t border-soft text-sm" data-compare-row={c.label} data-dir={c.dir}>
                <span>{c.label}</span>
                <span className="tabular-nums whitespace-nowrap">{c.before} → <strong>{c.after}</strong> <span aria-hidden="true" className={c.dir === 'none' || c.dir === 'same' ? 'muted' : c.dir === c.better ? 'text-brand-dark' : 'text-warm-dark'}>{c.dir === 'up' ? '▲' : c.dir === 'down' ? '▼' : c.dir === 'same' ? '=' : ''}</span></span>
              </li>
            ))}
          </ul>
          {tr.compareNote && <span className="muted text-xs" data-rule-note>{tr.compareNote} Pas de flèche sur le temps ni sur les jours.</span>}
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold m-0">Temps de travail par semaine</h3>
          <span className="muted text-xs">Ligne pointillée : l’objectif que vous avez fixé ({duree(goalMin)}). Semaine en cours en pointillés : elle n’est pas finie.</span>
          <WeeklyBars unit="hhmm" goal={goalMin} bars={tr.weeks.map(w => ({ key: w.week, label: w.label, value: w.minutes, current: w.current,
            tip: w.started ? [`Semaine du ${w.label}${w.current ? ' (en cours)' : ''}`, `${duree(w.minutes)} de travail`, `${w.days} jour${w.days > 1 ? 's' : ''} avec 10 min ou plus`] : [`Semaine du ${w.label}`, 'avant la première activité'] }))} />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold m-0">Réussite par semaine</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-[3px] rounded" style={{ background: C_CP }} />Contrôles de leçon réussis du premier coup</span>
            <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-[3px] rounded" style={{ background: C_EX }} />Exercices réussis (corrigés par la plateforme)</span>
          </div>
          <RateLines labels={labels} lines={[
            { key: 'cp', label: 'Contrôles', color: C_CP, values: tr.weeks.map(w => w.cp_total >= MIN_ITEMS ? { v: Math.round((w.cp_ok / w.cp_total) * 100), tip: ratio(w.cp_ok, w.cp_total)! } : null) },
            { key: 'ex', label: 'Exercices', color: C_EX, values: tr.weeks.map(w => w.ex_total >= MIN_ITEMS ? { v: Math.round((w.ex_ok / w.ex_total) * 100), tip: ratio(w.ex_ok, w.ex_total)! } : null) },
          ]} />
          <span className="muted text-xs">Un point n’apparaît que les semaines avec au moins 5 questions (en dessous, trop peu de questions pour un pourcentage) ; le nombre de questions est indiqué au survol et dans le tableau.</span>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer muted">Voir les chiffres semaine par semaine</summary>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-sm min-w-[560px]">
              <thead><tr className="text-left muted"><th className="py-1 font-medium">Semaine du</th><th className="font-medium">Travail</th><th className="font-medium">Jours</th><th className="font-medium">Contrôles 1er coup</th><th className="font-medium">Exercices</th><th className="font-medium">Copies sans question vide</th></tr></thead>
              <tbody>{tr.weeks.map(w => <tr key={w.week} className="border-t border-soft"><td className="py-1">{w.label}{w.current ? ' (en cours)' : ''}</td><td>{w.started ? duree(w.minutes) : '—'}</td><td>{w.started ? w.days : '—'}</td>
                <td>{w.cp_total ? `${w.cp_ok}/${w.cp_total}` : '—'}</td><td>{w.ex_total ? `${w.ex_ok}/${w.ex_total}` : '—'}</td><td>{w.notes.length ? w.notes.map(x => `${x.toLocaleString('fr-FR')}/20`).join(', ') : '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </>}
      {tr.subjects.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-base font-semibold m-0">Par matière : chaque résultat, du plus ancien au plus récent</h3>
          <ul className="list-none m-0 p-0 flex flex-col">
            {tr.subjects.map(s => (
              <li key={s.subject} className="flex flex-col gap-1 py-2 border-t border-soft first:border-t-0 text-sm" data-subject-trend={s.subject}>
                <strong>{s.subject}</strong>
                {s.exercices.length > 0 && <span className="grid grid-cols-[110px_1fr] max-sm:grid-cols-1 gap-x-3 items-center">
                  <span className="muted">Exercices ({s.exercices.length})</span>
                  <span className="flex flex-wrap gap-1">{s.exercices.slice(-8).map((e, i) => <span key={i} className="pill bg-soft text-ink-2 tabular-nums">{e.ok}/{e.total}</span>)}</span></span>}
                {s.copies.length > 0 && <span className="grid grid-cols-[110px_1fr] max-sm:grid-cols-1 gap-x-3 items-center">
                  <span className="muted">Copies sans question vide ({s.copies.length})</span>
                  <span className="flex flex-wrap gap-1">{s.copies.slice(-8).map((c, i) => <span key={i} className="pill bg-soft text-ink-2 tabular-nums">{c.note.toLocaleString('fr-FR')}/20</span>)}</span></span>}
              </li>
            ))}
          </ul>
          <span className="muted text-xs">Exercices : questions corrigées par la plateforme réussies sur le total de la série (8 dernières séries). Copies : notes des évaluations sans question vide (8 dernières).</span>
        </div>
      )}
      {tr.feelings.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3" data-feelings>
          <h3 className="text-base font-semibold m-0">Ce qui a changé dans ses réponses au questionnaire</h3>
          <ul className="list-none m-0 p-0 flex flex-col">
            {tr.feelings.map(f => (
              <li key={f.id} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-1.5 border-t border-soft first:border-t-0 text-sm" data-feeling={f.id}>
                <span>« {f.text} »</span>
                <span className="muted">{f.answers.map(a => a.label).join(' → ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
