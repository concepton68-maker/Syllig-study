'use client';
import { startTransition, useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveKey, saveTasks, runAutoNow, saveSlot, saveAssignments, type KeyState, type TaskState } from './actions';
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
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Nouvelle clé {p.name}
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

// ── « Qui fait quoi » : une ligne par fonction de la liste centrale (TASKS) ; une nouvelle fonction y apparaît d'elle-même
export type FnTask = { id: string; label: string; desc: string; studentData: boolean; fallback?: string };
export type KeyedProvider = { id: string; name: string; eu: boolean; where: string; models: Model[]; defaults: Record<string, string | undefined> };

export function AssignTable({ tasks, providers, current, allowNonEu }: {
  tasks: FnTask[]; providers: KeyedProvider[]; current: Record<string, { provider: string; model: string } | undefined>; allowNonEu: boolean;
}) {
  const [state, action, pending] = useActionState<TaskState, FormData>(saveAssignments, undefined);
  const ready = useReady();
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, { p: string; m: string }>>(() =>
    Object.fromEntries(tasks.map(t => [t.id, { p: current[t.id]?.provider ?? '', m: current[t.id]?.model ?? '' }])));
  // après l'enregistrement : ce qui a réellement été retenu (ex. modèle retiré remplacé)
  useEffect(() => { if (state?.tasks) setSel(Object.fromEntries(tasks.map(t => [t.id, { p: state.tasks![t.id]?.provider ?? '', m: state.tasks![t.id]?.model ?? '' }]))); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  // clé ajoutée depuis une ligne : dès que ses modèles sont connus, le modèle conseillé est choisi
  useEffect(() => {
    let changed = false; const next = { ...sel };
    for (const t of tasks) { const c = next[t.id]; const pr = providers.find(x => x.id === c.p);
      if (pr && !c.m) { next[t.id] = { p: c.p, m: pr.defaults[t.id] ?? pr.models[0]?.id ?? '' }; changed = true; } }
    if (changed) setSel(next);
  }, [providers]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t: string, p: string) => { const pr = providers.find(x => x.id === p); setSel({ ...sel, [t]: { p, m: pr ? (pr.defaults[t] ?? pr.models[0]?.id ?? '') : '' } }); };
  // tous les fournisseurs : ceux qui ont une clé, puis ceux de la liste sans clé (la clé se colle dans la ligne)
  const keyedIds = new Set(providers.map(p => p.id));
  const keyedNames = new Set(providers.map(p => p.name));
  const others = PRESETS.filter(x => x.id !== 'autre' && !keyedIds.has(x.id) && !keyedNames.has(x.name));
  return (
    <form method="post" onSubmit={send(action)} className="flex flex-col gap-3" data-assign>
      <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Fonction</span><span>Fournisseur</span><span>Modèle</span>
      </div>
      {tasks.map(t => {
        const cur = sel[t.id];
        const pr = providers.find(x => x.id === cur.p);
        const preset = cur.p.startsWith('new:') ? PRESETS.find(x => x.id === cur.p.slice(4)) : undefined;
        const models = pr ? (pr.models.some(m => m.id === cur.m) || !cur.m ? pr.models : [...pr.models, { id: cur.m, label: cur.m }]) : [];
        const lock = (eu: boolean) => t.studentData && !eu && !allowNonEu;
        return (
          <div key={t.id} className="grid gap-2 md:gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] items-center rounded-xl border border-line px-3 py-2.5" data-task={t.id}>
            <span className="text-sm"><strong>{t.label}</strong>
              <span className="block muted text-xs">{t.studentData ? 'Données d’élèves (sans nom) : fournisseur européen' : 'Aucune donnée d’élève : tout fournisseur'}</span>
              {pr && lock(pr.eu) && <span className="block text-xs font-semibold text-warm-dark">⚠ bloqué : {pr.name} est hors UE et la dérogation n’est pas accordée. Choisissez une IA européenne.</span>}</span>
            <select className="field" name={`task_${t.id}`} value={cur.p} onChange={e => pick(t.id, e.target.value)} aria-label={`Fournisseur pour ${t.label}`}>
              <option value="">{t.fallback ? `— Même IA que « ${tasks.find(x => x.id === t.fallback)?.label ?? t.fallback} » —` : '— Aucune IA —'}</option>
              <optgroup label="Clé enregistrée">
                {providers.map(p => <option key={p.id} value={p.id} disabled={lock(p.eu)}>{p.name}{lock(p.eu) ? ' — 🔒 hors UE' : p.eu ? ' · Europe' : ''}</option>)}
              </optgroup>
              <optgroup label="Clé à ajouter">
                {others.map(x => <option key={x.id} value={`new:${x.id}`} disabled={lock(x.eu)}>{x.name}{lock(x.eu) ? ' — 🔒 hors UE' : x.eu ? ' · Europe' : ''}</option>)}
              </optgroup>
            </select>
            {pr ? (
              <select className="field" name={`model_${t.id}`} value={cur.m} onChange={e => setSel({ ...sel, [t.id]: { ...cur, m: e.target.value } })} aria-label={`Modèle pour ${t.label}`}>
                {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            ) : preset ? (
              <InlineKey preset={preset.id} onSaved={id => { setSel(s0 => ({ ...s0, [t.id]: { p: id, m: '' } })); router.refresh(); }} />
            ) : <span className="muted text-sm">—</span>}
          </div>
        );
      })}
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-2.5 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-2.5 text-sm">{state.ok}{state.notes?.length ? ` ${state.notes.join(' ')}` : ''}</p>}
      <div><button className="btn btn-primary" type="submit" disabled={pending || !ready || Object.values(sel).some(x => x.p.startsWith('new:'))}>{pending ? 'Vérification…' : 'Enregistrer'}</button></div>
    </form>
  );
}

// Clé collée directement dans une ligne de « Qui fait quoi » (pas de formulaire imbriqué : appel direct de l'action)
function InlineKey({ preset, onSaved }: { preset: string; onSaved: (providerId: string) => void }) {
  const p = PRESETS.find(x => x.id === preset)!;
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const verify = async () => {
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.set('preset', preset); fd.set('key', key.trim()); fd.set('models', p.modelsHint ?? ''); fd.set('base_url', p.base ?? '');
    const r = await saveSlot(undefined, fd);
    setBusy(false);
    if (r?.ok && r.provider) onSaved(r.provider); else setErr(r?.error ?? 'Vérification impossible.');
  };
  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-2">
        <input className="field font-mono flex-1 min-w-0" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (key.trim()) void verify(); } }} placeholder={`Collez la clé ${p.name}`} aria-label={`Clé ${p.name}`} />
        <button type="button" className="btn btn-primary" disabled={busy || !key.trim()} onClick={() => void verify()}>{busy ? '…' : 'Vérifier'}</button>
      </span>
      {err ? <span role="alert" className="text-xs font-semibold text-warm-dark">{err}</span> : <span className="muted text-xs">{p.help}</span>}
    </span>
  );
}

// ── « Mes clés » : ajouter une clé (fournisseur dans la liste + clé ; la technique est dans « Options avancées »)
export function AddKey({ configured, open }: { configured: string[]; open: boolean }) {
  const [shown, setShown] = useState(open);
  const [state, action, pending] = useActionState<KeyState, FormData>(saveSlot, undefined);
  const ready = useReady();
  const [id, setId] = useState('');
  const p = PRESETS.find(x => x.id === id);
  if (state?.ok) return <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-2.5 text-sm">✓ {state.ok} Choisissez-le ci-dessus, dans « Qui fait quoi ».</p>;
  if (!shown) return <div><button type="button" className="btn inline-flex items-center gap-2" onClick={() => setShown(true)}><span aria-hidden="true" className="text-lg leading-none">+</span>Ajouter une clé</button></div>;
  const other = p?.id === 'autre';
  return (
    <form method="post" onSubmit={send(action)} className="rounded-xl border border-line p-3 flex flex-col gap-3" data-slot>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-end">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Fournisseur
          <select className="field" name="preset" value={id} onChange={e => setId(e.target.value)} required>
            <option value="">— Choisir —</option>
            {PRESETS.filter(x => !(x.builtin && configured.includes(x.id))).map(x => <option key={x.id} value={x.id}>{x.name}{x.where ? ` · ${x.eu ? 'Europe' : x.where}` : ''}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Clé
          <input className="field font-mono" name="key" type="password" autoComplete="off" required disabled={!p} placeholder={p ? 'Collez la clé' : 'Choisissez le fournisseur'} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={pending || !ready || !p}>{pending ? 'Vérification…' : 'Vérifier et enregistrer'}</button>
      </div>
      {p && <p className="m-0 muted text-xs">{p.help}</p>}
      {other && (
        // « Autre » : ces informations sont indispensables
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Nom affiché<input className="field" name="name" required autoComplete="off" placeholder="ex. Infomaniak" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Adresse de l’API<input className="field font-mono" name="base_url" required placeholder="https://…" autoComplete="off" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Modèle<input className="field font-mono" name="models" autoComplete="off" placeholder="nom du modèle" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Où sont traitées les données ?
            <select className="field" name="eu" defaultValue="non"><option value="non">Hors Union européenne</option><option value="oui">Dans l’Union européenne</option></select></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Pays<input className="field" name="where" autoComplete="off" placeholder="ex. Suisse" /></label>
        </div>
      )}
      {p && !p.builtin && !other && (
        <details className="text-sm">
          <summary className="cursor-pointer muted">Options avancées (adresse de l’API, modèle)</summary>
          <div className="grid gap-3 sm:grid-cols-2 mt-2">
            <label className="flex flex-col gap-1.5 font-semibold">Adresse de l’API<input key={p.id} className="field font-mono" name="base_url" defaultValue={p.base ?? ''} autoComplete="off" /></label>
            <label className="flex flex-col gap-1.5 font-semibold">Modèle <span className="muted font-normal">(si le fournisseur ne publie pas sa liste)</span>
              <input key={`m-${p.id}`} className="field font-mono" name="models" defaultValue={p.modelsHint ?? ''} autoComplete="off" /></label>
          </div>
        </details>
      )}
      {state?.error && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-2.5 text-sm">{state.error}</p>}
    </form>
  );
}
