'use client';
import { useActionState, useState } from 'react';
import { THEMES, type StudentSettings } from '@/lib/settings';
import { saveRulesAction } from './actions';
import { BirthClassFields } from '../Forms';

export function RulesForm({ studentId, s, levels, level }: { studentId: string; s: StudentSettings; levels: { code: string; name: string }[]; level: string }) {
  const [state, action, pending] = useActionState(saveRulesAction, undefined);
  const [mode, setMode] = useState<'semaine' | 'jour'>(s.goal_mode);
  const [daily, setDaily] = useState(s.daily_goal_minutes);
  const [days, setDays] = useState<number[]>(s.goal_days);
  const fmt = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="student" value={studentId} />
      <fieldset className="flex flex-col gap-3 border-0 p-0 m-0" data-profile>
        <legend className="text-base font-semibold mb-1">Profil scolaire</legend>
        <BirthClassFields levels={levels} birth={s.birth} gender={s.gender} level={level} extraTime={s.extra_time} fixedLevel />
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <fieldset className="basis-full flex flex-col gap-3 border-0 p-0 m-0" data-goal-form>
          <legend className="text-sm font-semibold mb-1.5">Objectif de temps de travail</legend>
          <div role="radiogroup" className="flex gap-2">
            {(['jour', 'semaine'] as const).map(m => <label key={m} className={`btn ${mode === m ? 'btn-primary' : ''}`}><input type="radio" name="goal_mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />{m === 'jour' ? 'Par jour' : 'Par semaine'}</label>)}
          </div>
          {mode === 'jour' ? (<>
            <div className="flex flex-wrap gap-4 items-end">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Temps par jour
                <select className="field" name="daily" value={daily} onChange={e => setDaily(Number(e.target.value))}>{[15, 20, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{fmt(m)}</option>)}</select></label>
              <div className="flex flex-col gap-1.5 text-sm font-semibold">Les jours concernés
                <div className="flex gap-1.5">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => { const d = i + 1, on = days.includes(d); return (
                  <label key={d} className={`size-11 rounded-[10px] grid place-items-center cursor-pointer font-semibold ${on ? 'bg-brand text-white' : 'border border-line-strong'}`}>
                    <input type="checkbox" name="goal_days" value={d} checked={on} onChange={() => setDays(x => on ? x.filter(y => y !== d) : [...x, d].sort())} className="sr-only" aria-label={['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i]} />{l}</label>); })}</div>
              </div>
            </div>
            <span className="text-sm text-ink-2" data-goal-week>Soit <strong>{fmt(daily * days.length)} par semaine</strong> ({fmt(daily)} × {days.length} jour{days.length > 1 ? 's' : ''}) : c’est ce chiffre qu’affichent l’Activité, le Bilan et le message du lundi. Un changement s’applique aussi aux jours déjà passés.</span>
          </>) : (
            <label className="flex flex-col gap-1.5 text-sm font-semibold max-w-[260px]">Temps de travail visé par semaine
              <select className="field" name="goal_h" defaultValue={String(s.weekly_goal_minutes / 60)}>{[...new Set([2, 3, 4, 5, 6, 7, 8, 10, s.weekly_goal_minutes / 60])].sort((a, b) => a - b).map(h => <option key={h} value={h}>{fmt(Math.round(h * 60))}</option>)}</select>
              <span className="text-xs muted font-normal">Un changement s’applique aussi aux semaines déjà passées dans l’Activité et le Bilan.</span></label>
          )}
        </fieldset>
        <label className="flex-[1_1_200px] flex flex-col gap-1.5 text-sm font-semibold">Délai avant de retenter une évaluation
          <select className="field" name="retry" defaultValue={String(Math.max(1, s.retry_delay_days))}>{[1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d} jour{d > 1 ? 's' : ''}</option>)}</select>
        </label>
        <label className="flex-[1_1_200px] flex flex-col gap-1.5 text-sm font-semibold">Pause du temps de travail après
          <select className="field" name="idle" defaultValue={String([300, 600, 900].includes(s.idle_seconds) ? s.idle_seconds : 600)}>{[300, 600, 900].map(d => <option key={d} value={d}>{d / 60} min sans rien toucher</option>)}</select>
        </label>
      </div>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="approval" defaultChecked={s.eval_requires_approval} className="mt-1 w-5 h-5" />
        <span><strong>Évaluation avec mon accord</strong><span className="block muted text-sm">L’élève vous envoie une demande avant chaque évaluation (elle apparaît dans « À faire »). Sinon, l’évaluation s’ouvre dès que les exercices sont faits.</span></span>
      </label>
      <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
        <legend className="text-sm font-semibold mb-1.5">Thème d’affichage de son espace <span className="muted font-normal">(l’élève peut aussi le changer)</span></legend>
        <div className="flex flex-wrap gap-2">
          {THEMES.map(t => (
            <label key={t.id} data-theme={t.id} className="flex-[1_1_200px] flex items-start gap-2.5 p-3 rounded-xl border border-line-strong cursor-pointer bg-brand-soft">
              <input type="radio" name="theme" value={t.id} defaultChecked={s.theme === t.id} className="mt-1 w-4 h-4" />
              <span><strong className="text-brand-ink">{t.name}</strong><span className="block text-sm text-ink-2">{t.desc}</span>
                <span className="flex gap-1 mt-1.5" aria-hidden="true"><span className="w-5 h-5 rounded-full" style={{ background: 'var(--side-bg)' }} /><span className="w-5 h-5 rounded-full bg-brand" /><span className="w-5 h-5 rounded-full bg-brand-mid" /><span className="w-5 h-5 rounded-full bg-accent" /></span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
        {state?.ok && <span role="status" className="text-sm text-brand-ink">{state.ok}</span>}
        {state?.error && <span role="alert" className="text-sm text-warm-dark">{state.error}</span>}
      </div>
    </form>
  );
}
