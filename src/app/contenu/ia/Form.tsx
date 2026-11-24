'use client';
import { startTransition, useActionState, useEffect, useState } from 'react';
import { saveKey, saveTasks, runAutoNow, addProvider, type KeyState, type TaskState } from './actions';

type Model = { id: string; label: string };
type ProviderView = { id: string; custom?: boolean; name: string; eu: boolean; where: string; help: string; placeholder: string; hint?: string; models: Model[] };

// Page prête (code chargé) : avant, un clic enverrait le formulaire par le navigateur, clé comprise dans l'adresse.
function useReady() { const [r, setR] = useState(false); useEffect(() => setR(true), []); return r; }

// envoi manuel : pas de remise à zéro automatique du formulaire après l'enregistrement
const send = (action: (fd: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); };

export function KeyForm({ p }: { p: ProviderView }) {
  const [state, action, pending] = useActionState<KeyState, FormData>(saveKey, undefined);
  const ready = useReady();
  return (
    <form method="post" onSubmit={send(action)} className="flex flex-col gap-2" data-provider={p.id}>
      <input type="hidden" name="provider" value={p.id} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Clé {p.name} {p.hint && <span className="muted font-normal">(enregistrée : {p.hint} — collez-en une autre pour la remplacer)</span>}
        <input className="field font-mono" name="key" type="password" autoComplete="off" placeholder={p.hint ? 'Clé enregistrée' : p.placeholder} required />
      </label>
      {p.custom && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Modèles à ajouter à la main <span className="muted font-normal">(facultatif, si le fournisseur ne publie pas sa liste ; séparés par des virgules)</span>
          <input className="field font-mono" name="models" autoComplete="off" placeholder="ex. glm-4.6" />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={pending || !ready}>{pending ? 'Vérification…' : 'Vérifier et enregistrer'}</button>
        <span className="muted text-xs">{p.help}</span>
      </div>
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-2.5 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-2.5 text-sm">{state.ok}</p>}
    </form>
  );
}

export function TaskForm({ providers, tasks, current, enabled, allowNonEu, retention, autoCours }: {
  providers: ProviderView[]; tasks: { id: string; label: string; desc: string }[];
  current: Record<string, { provider: string; model: string } | undefined>; enabled: boolean; allowNonEu: boolean; retention: number; autoCours: boolean;
}) {
  const [state, action, pending] = useActionState<TaskState, FormData>(saveTasks, undefined);
  const ready = useReady();
  const usable = providers.filter(p => p.hint);
  return (
    <form method="post" onSubmit={send(action)} className="flex flex-col gap-4">
      {usable.length === 0 && <p className="m-0 text-sm">Enregistrez d’abord au moins une clé ci-dessus.</p>}
      {tasks.map(t => {
        const cur = current[t.id];
        return (
          <label key={t.id} className="flex flex-col gap-1.5 text-sm font-semibold">{t.label}
            <span className="muted font-normal">Données transmises : {t.desc}</span>
            {/* key : après l'enregistrement, la liste reflète le choix réellement retenu (ex. modèle retiré remplacé) */}
            <select key={cur ? `${cur.provider}::${cur.model}` : 'aucune'} className="field" name={`task_${t.id}`} defaultValue={cur ? `${cur.provider}::${cur.model}` : ''}>
              <option value="">— Pas d’IA pour cette tâche —</option>
              {usable.map(p => (
                <optgroup key={p.id} label={`${p.name} · ${p.eu ? 'Union européenne' : p.where}`}>
                  {(p.models.some(m => cur?.provider === p.id && m.id === cur.model) || cur?.provider !== p.id ? p.models : [...p.models, { id: cur.model, label: cur.model }])
                    .map(m => <option key={m.id} value={`${p.id}::${m.id}`}>{m.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        );
      })}
      <label className="flex items-start gap-2.5 text-sm">
        <input key={String(allowNonEu)} type="checkbox" name="allow_non_eu" defaultChecked={allowNonEu} className="w-5 h-5 mt-0.5 accent-[var(--color-warm)]" />
        <span><strong>Dérogation : autoriser l’envoi de données d’élèves hors de l’Union européenne</strong> (Claude, Gemini)
          <span className="block muted">À ne cocher qu’en connaissance de cause : il faut un contrat de sous-traitance avec le fournisseur, et en informer les parents.</span></span>
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <input key={String(autoCours)} type="checkbox" name="auto_cours" defaultChecked={autoCours} className="w-5 h-5 mt-0.5 accent-[var(--color-brand)]" />
        <span><strong>Rédiger automatiquement les leçons de rattrapage</strong> proposées par les bilans (Leçons à créer)
          <span className="block muted">Chaque leçon arrive en brouillon dans « À relire » : rien n’est publié sans vous.</span></span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold max-w-[360px]">Conservation des bilans et du journal des envois
        <select key={retention} className="field" name="retention" defaultValue={String(retention)}>
          <option value="180">6 mois</option><option value="365">1 an</option><option value="730">2 ans</option>
        </select>
      </label>
      <label className="flex items-center gap-2.5 text-sm font-semibold">
        <input key={String(enabled)} type="checkbox" name="enabled" defaultChecked={enabled} className="w-5 h-5 accent-[var(--color-brand)]" />
        IA active (sinon : aucun envoi, pour aucune tâche)
      </label>
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm">{state.ok}{state.notes?.length ? ` ${state.notes.join(' ')}` : ''}</p>}
      <div><button className="btn btn-primary" type="submit" disabled={pending || !ready || usable.length === 0}>{pending ? 'Vérification des modèles…' : 'Enregistrer les réglages'}</button></div>
    </form>
  );
}

export function RunAutoButton() {
  const [state, action, pending] = useActionState<TaskState, FormData>(async () => runAutoNow(), undefined);
  const ready = useReady();
  return (
    <form method="post" onSubmit={send(action)} className="flex flex-wrap items-center gap-3">
      <button className="btn" type="submit" disabled={pending || !ready}>{pending ? 'Vérification…' : 'Vérifier les automatismes maintenant'}</button>
      {state?.ok && <span role="status" className="text-sm">{state.ok}</span>}
    </form>
  );
}

// Ajouter un fournisseur d'IA compatible OpenAI (GLM, OpenAI, OVHcloud, Scaleway, Infomaniak…)
export function AddProviderForm() {
  const [state, action, pending] = useActionState<KeyState, FormData>(addProvider, undefined);
  const ready = useReady();
  return (
    <details className="rounded-2xl border border-dashed border-line-strong p-4" open={!!state}>
      <summary className="cursor-pointer font-semibold">+ Ajouter un fournisseur d’IA</summary>
      <form method="post" onSubmit={send(action)} className="flex flex-col gap-3 mt-3" data-provider="nouveau">
        <p className="m-0 muted text-sm">Pour tout fournisseur dont l’API est compatible OpenAI (la plupart : GLM / Z.ai, OpenAI, DeepSeek, OVHcloud, Scaleway, Infomaniak…). L’adresse et le nom du modèle figurent dans sa documentation.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Nom affiché<input className="field" name="name" required placeholder="ex. GLM (Z.ai)" autoComplete="off" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Adresse de l’API<input className="field font-mono" name="base_url" required placeholder="ex. https://api.z.ai/api/paas/v4" autoComplete="off" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Clé<input className="field font-mono" name="key" type="password" required autoComplete="off" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Modèles <span className="muted font-normal">(facultatif si le fournisseur publie sa liste)</span><input className="field font-mono" name="models" placeholder="ex. glm-4.6" autoComplete="off" /></label>
        </div>
        <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm border-0 p-0 m-0">
          <legend className="font-semibold mb-1">Où les données sont-elles traitées ?</legend>
          <label className="flex items-center gap-2"><input type="radio" name="eu" value="non" defaultChecked className="accent-[var(--color-brand)]" />Hors de l’Union européenne</label>
          <label className="flex items-center gap-2"><input type="radio" name="eu" value="oui" className="accent-[var(--color-brand)]" />Dans l’Union européenne (contrat à l’appui)</label>
          <label className="flex items-center gap-2">Pays / région <input className="field !py-1.5 !min-h-0 w-40" name="where" placeholder="ex. Chine" autoComplete="off" /></label>
        </fieldset>
        <p className="m-0 muted text-xs">Hors UE : utilisable librement pour la rédaction des cours (aucune donnée d’élève), et pour la correction ou le bilan seulement avec la dérogation.</p>
        {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-2.5 text-sm">{state.error}</p>}
        {state?.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-2.5 text-sm">{state.ok}</p>}
        <div><button className="btn btn-primary" type="submit" disabled={pending || !ready}>{pending ? 'Vérification…' : 'Vérifier et ajouter'}</button></div>
      </form>
    </details>
  );
}
