'use client';
import { useActionState, useState } from 'react';
import { ITEMS, SCALE } from '@/lib/checkin';
import { saveCheckin } from './actions';

export function CheckinForm() {
  const [state, action, pending] = useActionState(saveCheckin, undefined);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const n = Object.keys(done).length;
  return (
    <form action={action} method="post" className="flex flex-col gap-4" data-checkin>
      {ITEMS.map((it, i) => (
        <fieldset key={it.id} className="card !p-4 flex flex-col gap-3 border-0 m-0">
          <legend className="sr-only">{it.text}</legend>
          <span className="font-semibold text-[15px]" aria-hidden="true"><span className="muted mr-1.5">{i + 1}.</span>{it.text}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SCALE.map((label, v) => (
              <label key={v} className="flex items-center justify-center text-center gap-2 min-h-11 px-2 rounded-xl border border-line-strong cursor-pointer text-sm has-[:checked]:bg-brand has-[:checked]:text-white has-[:checked]:border-brand">
                <input type="radio" name={it.id} value={v} required className="sr-only" onChange={() => setDone(d => ({ ...d, [it.id]: true }))} />{label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="card !p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Ce qui m’aide le plus à travailler <span className="muted font-normal">(facultatif)</span>
          <textarea className="field min-h-20" name="aide" maxLength={300} /></label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Ce qui me bloque ou me décourage <span className="muted font-normal">(facultatif)</span>
          <textarea className="field min-h-20" name="bloque" maxLength={300} /></label>
      </div>
      {state?.error && <p role="alert" className="m-0 rounded-lg bg-warm-soft text-warm-dark px-3 py-2 text-sm">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary min-h-[52px] px-7" type="submit" disabled={pending}>Envoyer mes réponses</button>
        <span className="muted text-sm">{n}/{ITEMS.length} phrases</span>
      </div>
    </form>
  );
}
