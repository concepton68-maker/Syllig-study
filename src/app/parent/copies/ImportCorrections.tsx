'use client';
import { useActionState } from 'react';
import { importCorrectionsAction } from './actions';

export function ImportCorrections() {
  const [state, action, pending] = useActionState(importCorrectionsAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Fichier renvoyé par Claude (.json)
        <input className="field py-2" type="file" name="file" accept=".json,application/json" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">ou colle sa réponse
        <textarea className="field font-mono text-xs" name="json" spellCheck={false} />
      </label>
      <div><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Vérification…' : 'Importer les propositions'}</button></div>
      {state?.errors && <div role="alert" className="rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm"><strong>Import refusé, rien n’a été enregistré :</strong><ul className="mt-1.5 mb-0 pl-5 list-disc">{state.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      {state?.ok !== undefined && <p role="status" className="m-0 rounded-xl bg-brand-soft text-[#1E2A78] px-4 py-3 text-sm"><strong>{state.ok} copie{state.ok > 1 ? 's' : ''} pré-corrigée{state.ok > 1 ? 's' : ''}.</strong> Ouvre chaque copie pour vérifier et valider la note.{state.warnings?.length ? ` (${state.warnings.join(' ; ')})` : ''}</p>}
    </form>
  );
}
