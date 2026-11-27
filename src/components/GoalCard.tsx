import type { GoalView } from '@/lib/goal';

// Objectif de temps vu par l'élève (maquette validée le 27/11/2026) : aujourd'hui en grand, la semaine en 7 cases.
const hm = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
const L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function GoalCard({ g }: { g: GoalView }) {
  const t = g.today, goal = t.goal;
  const pct = goal ? Math.min(1, t.minutes / goal) : 0;
  const R = 38, C = 2 * Math.PI * R;
  return (
    <section aria-label="Mon objectif de temps" className="card flex flex-col gap-4" data-goal-card>
      <div className="flex items-center gap-4">
        <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={goal ? `${t.minutes} minutes sur ${goal} aujourd’hui` : `${t.minutes} minutes aujourd’hui`} className="shrink-0">
          <circle cx="46" cy="46" r={R} fill="none" stroke="var(--color-track)" strokeWidth="10" />
          {pct > 0 && <circle cx="46" cy="46" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 46 46)" />}
          <text x="46" y={goal ? 45 : 50} textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">{t.minutes}</text>
          {goal ? <text x="46" y="61" textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">sur {goal} min</text> : <text x="46" y="64" textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">min</text>}
        </svg>
        <div className="flex flex-col gap-1">
          <strong className="text-[17px]">Aujourd’hui</strong>
          <span className="text-sm text-ink-2" data-goal-today>{goal ? (t.minutes >= goal ? 'Objectif du jour atteint' : `Encore ${goal - t.minutes} min pour ton objectif`) : g.mode === 'jour' ? 'Pas d’objectif aujourd’hui' : `${hm(t.minutes)} de travail`}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[13px]"><span className="muted">Cette semaine</span><strong data-goal-week>{hm(g.week_min)} sur {hm(g.week_goal)}</strong></div>
        <div className="grid grid-cols-7 gap-1.5">
          {g.days.map((d, i) => (
            <span key={d.day} tabIndex={0} data-tip={`${d.minutes} min${d.goal ? ` sur ${d.goal}` : ''}`} data-day-cell={d.met ? 'atteint' : d.goal === null && g.mode === 'jour' ? 'libre' : 'non'}
              className={`h-8 rounded-lg text-xs font-bold grid place-items-center ${d.met ? 'bg-brand text-white' : d.goal === null && g.mode === 'jour' ? 'border border-dashed border-line-strong muted' : d.minutes > 0 ? 'bg-brand-soft text-brand-dark' : 'bg-track text-ink-2'} ${d.today ? 'ring-2 ring-brand' : ''}`}>{L[i]}</span>
          ))}
        </div>
        <span className="text-xs muted">{g.mode === 'jour' ? 'Bleu : objectif atteint · bleu clair : commencé · gris : rien · pointillés : pas d’objectif ce jour-là' : 'Bleu : 10 min ou plus · bleu clair : moins de 10 min · gris : rien'}</span>
      </div>
    </section>
  );
}
