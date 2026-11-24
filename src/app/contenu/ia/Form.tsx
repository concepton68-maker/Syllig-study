'use client';
import { useActionState, useState } from 'react';
import { saveAi, type AiFormState } from './actions';

type Current = { provider: 'claude' | 'gemini'; model: string; key_hint: string; enabled: boolean; hasKey: boolean } | null;

export function AiForm({ current, claudeModels }: { current: Current; claudeModels: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<AiFormState, FormData>(saveAi, undefined);
  const [provider, setProvider] = useState<'claude' | 'gemini'>(current?.provider ?? 'claude');
  const models = state?.provider === provider && state.models ? state.models
    : provider === 'claude' ? claudeModels
    : current?.provider === 'gemini' ? [{ id: current.model, label: current.model }] : [];
  const model = state?.provider === provider && state.model ? state.model : current?.provider === provider ? current.model : models[0]?.id;
  const hint = current?.provider === provider && current.hasKey ? current.key_hint : '';
  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold mb-2">Fournisseur</legend>
        {([['claude', 'Claude (Anthropic)', 'Clé sur console.anthropic.com › API Keys. Le plus fiable pour corriger des réponses rédigées.'],
           ['gemini', 'Gemini (Google)', 'Clé sur aistudio.google.com › Get API key. Souvent le moins cher.']] as const).map(([v, label, help]) => (
          <label key={v} className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer ${provider === v ? 'border-brand bg-brand-soft' : 'border-line'}`}>
            <input type="radio" name="provider" value={v} checked={provider === v} onChange={() => setProvider(v)} className="mt-1 accent-[var(--color-brand)]" />
            <span><strong>{label}</strong><span className="block muted text-sm">{help}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Clé d’API {hint && <span className="muted font-normal">(enregistrée : {hint} — laissez vide pour la garder)</span>}
        <input className="field font-mono" name="key" type="password" autoComplete="off" placeholder={hint ? 'Clé enregistrée' : provider === 'claude' ? 'sk-ant-…' : 'AIza…'} />
      </label>
      {models.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Modèle
          <select className="field" name="model" defaultValue={model} key={`${provider}-${model}-${models.length}`}>
            {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          {provider === 'gemini' && !state?.models && <span className="muted font-normal">La liste des modèles Gemini s’affiche après la vérification de la clé.</span>}
        </label>
      )}
      <label className="flex items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" name="enabled" defaultChecked={current?.enabled ?? true} className="w-5 h-5 accent-[var(--color-brand)]" />
        Activer la correction par IA (bouton « Corriger avec l’IA » dans Famille › À faire)
      </label>
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm">{state.ok}</p>}
      <div><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Vérification de la clé…' : 'Vérifier et enregistrer'}</button></div>
    </form>
  );
}
