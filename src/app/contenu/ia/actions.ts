'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { checkKey, saveProviderKey, removeProviderKey, saveTaskSettings, saveCustomProvider, loadAiSettings, storedKey, pingModel, geminiCandidates, defaultModel,
  providerInfo, BUILTIN, TASKS, type AiSettings, type Provider, type Task, type Model } from '@/lib/ai';

export type KeyState = { ok?: string; error?: string } | undefined;
export type TaskState = { ok?: string; error?: string; notes?: string[] } | undefined;
const isProvider = (p: unknown, s: AiSettings): p is Provider => typeof p === 'string' && (p in BUILTIN || p in (s.custom ?? {}));

// Après une nouvelle clé : les tâches sans IA (ou bloquées par la règle Europe) reçoivent le modèle conseillé, si la règle le permet
async function assignDefaults(provider: Provider, key: string, models: Model[], userId: string) {
  const s = await loadAiSettings();
  const info = providerInfo(provider, s);
  const tasks = { ...s.tasks };
  for (const t of Object.keys(TASKS) as Task[]) {
    const cur = tasks[t];
    const curBlocked = !!cur && TASKS[t].studentData && !providerInfo(cur.provider, s).eu && !s.allow_non_eu;   // ex. ancien réglage Gemini, bloqué par la règle Europe
    if ((cur && !curBlocked) || (TASKS[t].studentData && !info.eu && !s.allow_non_eu)) continue;
    if (info.custom && TASKS[t].studentData) continue;   // un fournisseur ajouté n'est jamais choisi d'office pour des données d'élèves
    const m = defaultModel(info, models, t);
    if (m && !(await pingModel(info, key, m))) tasks[t] = { provider, model: m };
  }
  await saveTaskSettings({ ...s, tasks }, userId);
}

// Clé d'un fournisseur : vérifiée auprès de lui, puis enregistrée chiffrée avec la liste de ses modèles
export async function saveKey(_: KeyState, form: FormData): Promise<KeyState> {
  const u = await requireUser('admin');
  const s = await loadAiSettings();
  const provider = form.get('provider');
  const key = String(form.get('key') ?? '').trim();
  if (!isProvider(provider, s)) return { error: 'Fournisseur inconnu.' };
  if (!key) return { error: 'Collez la clé.' };
  const info = providerInfo(provider, s);
  const manual = String(form.get('models') ?? '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).slice(0, 10);
  const check = await checkKey(info, key, manual);
  if (!check.ok) return { error: check.error };
  await saveProviderKey(provider, key, check.models, u.id);
  await assignDefaults(provider, key, check.models, u.id);
  revalidatePath('/contenu', 'layout'); revalidatePath('/parent', 'layout');
  return { ok: `Clé ${info.name} vérifiée et enregistrée (${check.models.length} modèle${check.models.length > 1 ? 's' : ''} disponible${check.models.length > 1 ? 's' : ''}).` };
}

// Ajouter un fournisseur (API compatible OpenAI : GLM, OpenAI, OVHcloud, Scaleway, Infomaniak…)
export async function addProvider(_: KeyState, form: FormData): Promise<KeyState> {
  const u = await requireUser('admin');
  const name = String(form.get('name') ?? '').trim().slice(0, 60);
  const raw = String(form.get('base_url') ?? '').trim().replace(/\/+$/, '').replace(/\/(chat\/completions|models)$/, '');
  const key = String(form.get('key') ?? '').trim();
  const eu = form.get('eu') === 'oui';
  const where = String(form.get('where') ?? '').trim().slice(0, 60);
  if (!name || !raw || !key) return { error: 'Nom, adresse de l’API et clé sont obligatoires.' };
  let url: URL;
  try { url = new URL(raw); } catch { return { error: 'Adresse de l’API invalide (exemple : https://api.z.ai/api/paas/v4).' }; }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) return { error: 'L’adresse doit commencer par https:// (connexion chiffrée).' };
  const id = `x-${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'ia'}`;
  if (id in BUILTIN) return { error: 'Ce nom est réservé.' };
  const info = { id, kind: 'openai' as const, name, eu, where: eu ? 'Union européenne' : where || 'hors Union européenne', base: raw, custom: true, help: '', placeholder: '' };
  const manual = String(form.get('models') ?? '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).slice(0, 10);
  const check = await checkKey(info, key, manual);
  if (!check.ok) return { error: check.error };
  await saveCustomProvider(id, { name, base_url: raw, eu, where: info.where }, u.id);
  await saveProviderKey(id, key, check.models, u.id);
  await assignDefaults(id, key, check.models, u.id);
  revalidatePath('/contenu', 'layout'); revalidatePath('/parent', 'layout');
  return { ok: `${name} ajouté : clé vérifiée, ${check.models.length} modèle${check.models.length > 1 ? 's' : ''} disponible${check.models.length > 1 ? 's' : ''}. Choisissez-le ci-dessous pour une tâche.` };
}

export async function removeKey(provider: Provider) {
  const u = await requireUser('admin');
  if (isProvider(provider, await loadAiSettings())) await removeProviderKey(provider, u.id);
  revalidatePath('/contenu', 'layout'); revalidatePath('/parent', 'layout');
}

// Une IA par tâche, règle Europe, conservation des données
export async function saveTasks(_: TaskState, form: FormData): Promise<TaskState> {
  const u = await requireUser('admin');
  const s = await loadAiSettings();
  const allowNonEu = form.get('allow_non_eu') === 'on';
  const enabled = form.get('enabled') === 'on';
  const retention = [180, 365, 730].includes(Number(form.get('retention'))) ? Number(form.get('retention')) : 365;
  const tasks: typeof s.tasks = {};
  const notes: string[] = [];
  for (const t of Object.keys(TASKS) as Task[]) {
    const v = String(form.get(`task_${t}`) ?? '');
    if (!v) continue;
    const [p, wanted] = v.split('::') as [Provider, string];
    if (!isProvider(p, s) || !s.providers[p]) return { error: `${TASKS[t].label} : pas de clé enregistrée pour ce fournisseur.` };
    const info = providerInfo(p, s);
    if (TASKS[t].studentData && !info.eu && !allowNonEu)
      return { error: `${TASKS[t].label} : ${info.name} traite les données ${info.where === 'États-Unis' ? 'aux États-Unis' : `hors de l’Union européenne (${info.where})`}. Choisissez un fournisseur européen, ou cochez la dérogation en connaissance de cause.` };
    const key = (await storedKey(p))!;
    // essai réel du modèle (Google garde dans sa liste des modèles retirés)
    let model = '';
    const candidates = p === 'gemini' ? geminiCandidates(s.providers[p]!.models, wanted).slice(0, 6) : [wanted];
    let first: string | null = null;
    for (const id of candidates) { const err = await pingModel(info, key, id); if (!err) { model = id; break; } first ??= err; }
    if (!model) return { error: `${TASKS[t].label} : le modèle ${wanted} ne répond pas (${first}).` };
    if (model !== wanted) notes.push(`${TASKS[t].label} : ${wanted} n’est plus disponible, ${model} a été choisi à la place.`);
    tasks[t] = { provider: p, model };
  }
  await saveTaskSettings({ tasks, enabled, allow_non_eu: allowNonEu, retention_days: retention, auto_cours: form.get('auto_cours') === 'on' }, u.id);
  revalidatePath('/contenu/ia'); revalidatePath('/parent', 'layout');
  return { ok: enabled ? 'Réglages enregistrés. L’IA est active.' : 'Réglages enregistrés. L’IA est désactivée.', notes };
}

// Lance tout de suite la vérification des automatismes (bilans réguliers, leçons de rattrapage)
export async function runAutoNow(): Promise<TaskState> {
  await requireUser('admin');
  const { scheduleAuto } = await import('@/lib/automation');
  const r = await scheduleAuto();
  revalidatePath('/contenu', 'layout');
  return { ok: `Vérification faite : ${r.bilans} bilan${r.bilans > 1 ? 's' : ''} et ${r.cours} cours mis en file d’attente.` };
}

// File d'attente : relancer ou retirer des tâches (actions groupées)
export async function retryJobs(form: FormData) {
  await requireUser('admin');
  const ids = form.getAll('ids').map(String).filter(x => /^\d+$/.test(x));
  if (ids.length) await sql`update jobs set status = 'en_attente', run_after = now(), attempts = 0, error = null where id in ${sql(ids)} and status in ('echec', 'fait')`;
  (await import('@/lib/jobs')).kick();
  revalidatePath('/contenu', 'layout');
}
export async function deleteJobs(form: FormData) {
  await requireUser('admin');
  const ids = form.getAll('ids').map(String).filter(x => /^\d+$/.test(x));
  if (ids.length) await sql`delete from jobs where id in ${sql(ids)} and status <> 'en_cours'`;
  revalidatePath('/contenu', 'layout');
}
