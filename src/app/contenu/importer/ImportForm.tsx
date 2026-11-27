'use client';
import { useActionState } from 'react';
import { importAction } from './actions';

export function ImportForm() {
  const [state, action, pending] = useActionState(importAction, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 font-semibold text-sm">Fichiers de cours (.json, un ou plusieurs, ou un lot renvoyé par Claude)
        <input className="field py-2" type="file" name="files" accept=".json,application/json" multiple />
      </label>
      <label className="flex flex-col gap-1.5 font-semibold text-sm">ou colle le JSON renvoyé par Claude
        <textarea className="field font-mono text-xs min-h-[220px]" name="json" spellCheck={false} />
      </label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="publier" value="1" className="mt-1" data-batch-publish />
        <span><strong>Lot de cours : publier aussitôt les cours corrigés</strong><span className="block muted">Remplace la version visible par les élèves. L’ancienne reste dans l’historique. Sans cette case, ils arrivent dans « À relire ».</span></span></label>
      <div><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Vérification…' : 'Vérifier et importer'}</button></div>
      {state?.summary && (
        <div role="status" className="rounded-xl bg-brand-soft text-brand-dark px-4 py-3" data-batch-summary>
          <strong className="text-sm">Lot importé</strong>
          <ul className="text-sm mt-2 mb-0 pl-5 list-disc">{state.summary.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
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
