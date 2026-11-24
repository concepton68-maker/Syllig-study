'use client';
import { startTransition, useActionState, useEffect, useState } from 'react';
import { saveKey, saveTasks, runAutoNow, saveSlot, saveFunctions, type KeyState, type TaskState } from './actions';
import { PRESETS } from '@/lib/ai-presets';

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

export function TaskForm({ enabled, allowNonEu, retention, autoCours }: { enabled: boolean; allowNonEu: boolean; retention: number; autoCours: boolean }) {
  const [state, action, pending] = useActionState<TaskState, FormData>(saveTasks, undefined);
  const ready = useReady();
  return (
    <form method="post" onSubmit={send(action)} className="flex flex-col gap-4">
      <label className="flex items-start gap-2.5 text-sm">
        <input key={String(allowNonEu)} type="checkbox" name="allow_non_eu" defaultChecked={allowNonEu} className="w-5 h-5 mt-0.5 accent-[var(--color-warm)]" />
        <span><strong>Dérogation : autoriser l’envoi de données d’élèves hors de l’Union européenne</strong>
          <span className="block muted">Permet d’attribuer la correction ou le bilan à un fournisseur hors UE. À ne cocher qu’en connaissance de cause : contrat de sous-traitance avec le fournisseur, parents informés.</span></span>
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
        IA active (sinon : aucun envoi, pour aucune fonction)
      </label>
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm">{state.ok}{state.notes?.length ? ` ${state.notes.join(' ')}` : ''}</p>}
      <div><button className="btn btn-primary" type="submit" disabled={pending || !ready}>{pending ? 'Enregistrement…' : 'Enregistrer les réglages'}</button></div>
    </form>
  );
}

// ── Fonctions attribuables : une case par entrée de la liste centrale (TASKS) ; une nouvelle fonction y apparaît d'elle-même
export type FnTask = { id: string; label: string; desc: string; studentData: boolean };
type FnContext = { tasks: FnTask[]; current: Record<string, { provider: string; model: string } | undefined>; names: Record<string, string>; eu?: Record<string, boolean>; allowNonEu: boolean };

function FunctionChecks({ providerId, eu, models, defaults, ctx, prefill }: {
  providerId: string; eu: boolean; models: Model[]; defaults: Record<string, string | undefined>; ctx: FnContext; prefill?: (t: FnTask) => boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
      <legend className="text-sm font-semibold mb-1">Utilisé pour</legend>
      {ctx.tasks.map(t => {
        const cur = ctx.current[t.id];
        const blocked = t.studentData && !eu && !ctx.allowNonEu;
        const mine = cur?.provider === providerId;
        const checked = prefill ? prefill(t) : mine;
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <label className={`flex items-center gap-2 min-w-[260px] ${blocked ? 'opacity-55' : ''}`}>
              <input type="checkbox" name={`fn_${t.id}`} defaultChecked={!blocked && checked} disabled={blocked} className="w-5 h-5 accent-[var(--color-brand)]" />
              <span><strong>{t.label}</strong>
                <span className="block muted text-xs">{blocked ? 'Données d’élèves hors UE : nécessite la dérogation (Réglages généraux)' : cur && !mine ? `Actuellement : ${ctx.names[cur.provider] ?? cur.provider} — cocher pour le remplacer` : t.studentData ? 'Données d’élèves (sans nom)' : 'Aucune donnée d’élève'}</span></span>
            </label>
            {!blocked && models.length > 0 && (
              <select key={`${providerId}-${t.id}-${mine ? cur!.model : ''}`} className="field !py-1.5 !min-h-0 flex-1 min-w-[200px]" name={`model_${t.id}`} defaultValue={mine ? cur!.model : defaults[t.id] ?? models[0].id} aria-label={`Modèle pour ${t.label}`}>
                {(mine && !models.some(m => m.id === cur!.model) ? [...models, { id: cur!.model, label: cur!.model }] : models).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

// Carte d'un fournisseur enregistré : ses fonctions
export function FunctionsForm({ providerId, eu, models, defaults, ctx }: { providerId: string; eu: boolean; models: Model[]; defaults: Record<string, string | undefined>; ctx: FnContext }) {
  const [state, action, pending] = useActionState<TaskState, FormData>(saveFunctions, undefined);
  const ready = useReady();
  return (
    <form method="post" onSubmit={send(action)} className="flex flex-col gap-3" data-functions={providerId}>
      <input type="hidden" name="provider" value={providerId} />
      <FunctionChecks providerId={providerId} eu={eu} models={models} defaults={defaults} ctx={ctx} />
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-2.5 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-2.5 text-sm">{state.ok}{state.notes?.length ? ` ${state.notes.join(' ')}` : ''}</p>}
      <div><button className="btn" type="submit" disabled={pending || !ready}>{pending ? 'Vérification des modèles…' : 'Enregistrer les fonctions'}</button></div>
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

// Lignes « Fournisseur » à ajouter : on choisit dans la liste, on colle la clé ; « + » ajoute une ligne de plus
export function NewProviders({ configured, startWith, ctx }: { configured: string[]; startWith: number; ctx: FnContext }) {
  const [n, setN] = useState(startWith);
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: n }, (_, i) => <ProviderSlot key={i} index={i} configured={configured} ctx={ctx} />)}
      <div><button type="button" className="btn inline-flex items-center gap-2" onClick={() => setN(n + 1)}><span aria-hidden="true" className="text-lg leading-none">+</span>Ajouter un fournisseur</button></div>
    </div>
  );
}

function ProviderSlot({ index, configured, ctx }: { index: number; configured: string[]; ctx: FnContext }) {
  const [state, action, pending] = useActionState<KeyState, FormData>(saveSlot, undefined);
  const ready = useReady();
  const choices = PRESETS.filter(p => !(p.builtin && configured.includes(p.id)));
  const [id, setId] = useState('');
  const p = PRESETS.find(x => x.id === id);
  if (state?.ok) return <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-2.5 text-sm">✓ {state.ok}</p>;
  return (
    <form method="post" onSubmit={send(action)} className="rounded-2xl border border-line p-4 flex flex-col gap-3" data-slot={index}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Fournisseur
          <select className="field" name="preset" value={id} onChange={e => setId(e.target.value)} required>
            <option value="">— Choisir —</option>
            {choices.map(c => <option key={c.id} value={c.id}>{c.name}{c.where ? ` · ${c.eu ? 'UE' : c.where}` : ''}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Clé
          <input className="field font-mono" name="key" type="password" autoComplete="off" required disabled={!p} placeholder={p ? 'Collez la clé' : 'Choisissez d’abord le fournisseur'} />
        </label>
      </div>
      {p && !p.builtin && (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.id === 'autre' && <label className="flex flex-col gap-1.5 text-sm font-semibold">Nom affiché<input className="field" name="name" required autoComplete="off" placeholder="ex. Infomaniak" /></label>}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Adresse de l’API
            <input key={p.id} className="field font-mono" name="base_url" required defaultValue={p.base ?? ''} placeholder="https://…" autoComplete="off" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Modèle(s) <span className="muted font-normal">(facultatif si le fournisseur publie sa liste)</span>
            <input key={`m-${p.id}`} className="field font-mono" name="models" defaultValue={p.modelsHint ?? ''} autoComplete="off" placeholder="ex. nom-du-modele" /></label>
          {p.id === 'autre' && (
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm border-0 p-0 m-0 sm:col-span-2">
              <legend className="font-semibold mb-1">Données traitées</legend>
              <label className="flex items-center gap-2"><input type="radio" name="eu" value="non" defaultChecked />Hors UE</label>
              <label className="flex items-center gap-2"><input type="radio" name="eu" value="oui" />Dans l’UE (contrat à l’appui)</label>
              <label className="flex items-center gap-2">Pays <input className="field !py-1.5 !min-h-0 w-36" name="where" autoComplete="off" placeholder="ex. Suisse" /></label>
            </fieldset>
          )}
        </div>
      )}
      {p && (
        // proposé : les fonctions sans IA (ou bloquées par la règle Europe) que ce fournisseur peut prendre
        <FunctionChecks key={p.id} providerId={p.builtin ? p.id : `x-new`} eu={p.id === 'autre' ? false : p.eu} models={[]} defaults={{}} ctx={ctx}
          prefill={t => { const cur = ctx.current[t.id]; const free = !cur || (t.studentData && !ctx.allowNonEu && !ctx.eu?.[cur.provider]); return free && (p.eu || !t.studentData || ctx.allowNonEu); }} />
      )}
      {p && <p className="m-0 muted text-xs">{p.help}{p.where && ` Données traitées : ${p.eu ? 'dans l’Union européenne' : p.where}${p.eu ? '' : ' (correction et bilan seulement avec la dérogation ; libre pour les cours)'}.`}</p>}
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-2.5 text-sm">{state.error}</p>}
      <div><button className="btn btn-primary" type="submit" disabled={pending || !ready || !p}>{pending ? 'Vérification…' : 'Vérifier et enregistrer'}</button></div>
    </form>
  );
}
