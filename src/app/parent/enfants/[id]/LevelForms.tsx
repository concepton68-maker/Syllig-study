'use client';
import { useActionState, useState } from 'react';
import { changeLevelAction, followedSubjectsAction, type ResetState } from './actions';

type Lvl = { code: string; name: string; cycle: string | null; courses: number };

// Changer de niveau : passage dans une nouvelle année (archive l'année en cours) ou simple correction
export function LevelForm({ studentId, firstName, current, currentYear, levels }: { studentId: string; firstName: string; current: string; currentYear: string; levels: Lvl[] }) {
  const [state, action, pending] = useActionState(changeLevelAction, undefined as ResetState);
  const [mode, setMode] = useState<'annee' | 'correction'>('annee');
  const [level, setLevel] = useState(levels.find(l => l.code !== current)?.code ?? current);
  const next = (() => { const a = Number(currentYear.slice(0, 4)); return Number.isFinite(a) ? `${a + 1}-${a + 2}` : ''; })();
  const cycles = [...new Set(levels.map(l => l.cycle ?? 'Autres'))];
  const target = levels.find(l => l.code === level);
  return (
    <form action={action} className="flex flex-col gap-4"
      onSubmit={e => { if (!window.confirm(mode === 'annee'
        ? `Clôturer l’année ${currentYear} de ${firstName} et commencer l’année ${next} en ${target?.name} ? Le bilan de l’année en cours sera archivé dans le dossier.`
        : `Corriger le niveau de l’année en cours de ${firstName} en ${target?.name} ?`)) e.preventDefault(); }}>
      <input type="hidden" name="student" value={studentId} />
      <input type="hidden" name="mode" value={mode} />
      <div className="grid gap-3 sm:grid-cols-2">
        {([['annee', 'Passer dans une nouvelle année', `L’année ${currentYear} est clôturée : son bilan est archivé dans le dossier scolaire. Une nouvelle année commence au niveau choisi.`],
           ['correction', 'Corriger le niveau de cette année', 'Le niveau avait été mal choisi : on le corrige sans rien clôturer.']] as const).map(([id, title, text]) => (
          <label key={id} className={`rounded-2xl border-2 p-4 cursor-pointer flex gap-3 ${mode === id ? 'border-brand bg-brand-soft' : 'border-line'}`}>
            <input type="radio" name="_mode" className="mt-1 w-4 h-4" checked={mode === id} onChange={() => setMode(id)} />
            <span><strong className="block">{title}</strong><span className="text-sm text-ink-2">{text}</span></span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1.5 text-sm font-semibold flex-[2_1_260px]">Niveau
          <select className="field" name="level" value={level} onChange={e => setLevel(e.target.value)}>
            {cycles.map(c => (
              <optgroup key={c} label={c}>
                {levels.filter(l => (l.cycle ?? 'Autres') === c).map(l => <option key={l.code} value={l.code}>{l.name}{l.code === current ? ' (actuel)' : ''} · {l.courses} cours au programme</option>)}
              </optgroup>
            ))}
          </select></label>
        {mode === 'annee' && <label className="flex flex-col gap-1.5 text-sm font-semibold flex-[1_1_160px]">Année scolaire
          <input className="field" name="school_year" defaultValue={next} pattern="\d{4}-\d{4}" placeholder="2027-2028" /></label>}
        {mode === 'annee' && <label className="flex flex-col gap-1.5 text-sm font-semibold flex-[2_1_260px]">Remarque (facultatif)
          <input className="field" name="note" maxLength={160} placeholder="Ex. passage en Seconde, redoublement…" /></label>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending || (mode === 'correction' && level === current)}>
          {pending ? 'Enregistrement…' : mode === 'annee' ? 'Commencer la nouvelle année' : 'Corriger le niveau'}</button>
        {state?.error && <span role="alert" className="text-sm text-warm-dark">{state.error}</span>}
        {state?.ok && <span role="status" className="text-sm text-brand-ink">{state.ok}</span>}
      </div>
    </form>
  );
}

// Matières suivies cette année (ex. une seule LV2)
export function SubjectsForm({ studentId, subjects }: { studentId: string; subjects: { id: number; name: string; followed: boolean }[] }) {
  const [state, action, pending] = useActionState(followedSubjectsAction, undefined as ResetState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="student" value={studentId} />
      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
        {subjects.map(m => (
          <label key={m.id} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 cursor-pointer text-sm font-semibold has-[:checked]:border-brand-mid has-[:checked]:bg-brand-soft">
            <input type="checkbox" name="subjects" value={m.id} defaultChecked={m.followed} className="w-4 h-4" />{m.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer les matières'}</button>
        {state?.ok && <span role="status" className="text-sm text-brand-ink">{state.ok}</span>}
        {state?.error && <span role="alert" className="text-sm text-warm-dark">{state.error}</span>}
      </div>
    </form>
  );
}
