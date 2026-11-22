'use client';
import { useActionState } from 'react';
import { importAction } from './actions';

export function ImportForm() {
  const [state, action, pending] = useActionState(importAction, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 font-semibold text-sm">Fichiers de cours (.json, un ou plusieurs)
        <input className="field py-2" type="file" name="files" accept=".json,application/json" multiple />
      </label>
      <label className="flex flex-col gap-1.5 font-semibold text-sm">ou colle le JSON renvoyé par Claude
        <textarea className="field font-mono text-xs min-h-[220px]" name="json" spellCheck={false} />
      </label>
      <div><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Vérification…' : 'Vérifier et importer en brouillon'}</button></div>
      {state?.errors && state.errors.length > 0 && (
        <div role="alert" className="rounded-xl bg-warm-soft text-warm-dark px-4 py-3">
          <strong className="text-sm">Import refusé, rien n’a été enregistré :</strong>
          <ul className="text-sm mt-2 mb-0 pl-5 list-disc">{state.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {state?.warnings && state.warnings.length > 0 && (
        <div className="rounded-xl bg-soft px-4 py-3">
          <strong className="text-sm">Remarques</strong>
          <ul className="text-sm mt-2 mb-0 pl-5 list-disc">{state.warnings.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
    </form>
  );
}
