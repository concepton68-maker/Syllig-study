'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { checkKey, saveProviderKey, removeProviderKey, saveTaskSettings, loadAiSettings, storedKey, pingModel, geminiCandidates, defaultModel,
  PROVIDERS, TASKS, type Provider, type Task } from '@/lib/ai';

export type KeyState = { ok?: string; error?: string } | undefined;
export type TaskState = { ok?: string; error?: string; notes?: string[] } | undefined;
const isProvider = (p: unknown): p is Provider => p === 'mistral' || p === 'claude' || p === 'gemini';

// Clé d'un fournisseur : vérifiée auprès de lui, puis enregistrée chiffrée avec la liste de ses modèles
export async function saveKey(_: KeyState, form: FormData): Promise<KeyState> {
  const u = await requireUser('admin');
  const provider = form.get('provider');
  const key = String(form.get('key') ?? '').trim();
  if (!isProvider(provider)) return { error: 'Fournisseur inconnu.' };
  if (!key) return { error: 'Collez la clé.' };
  const check = await checkKey(provider, key);
  if (!check.ok) return { error: check.error };
  await saveProviderKey(provider, key, check.models, u.id);
  // première clé : les tâches libres reçoivent le modèle conseillé (si la règle Europe le permet)
  const s = await loadAiSettings();
  const tasks = { ...s.tasks };
  for (const t of Object.keys(TASKS) as Task[]) {
    const cur = tasks[t];
    const curBlocked = !!cur && TASKS[t].studentData && !PROVIDERS[cur.provider].eu && !s.allow_non_eu;   // ex. ancien réglage Gemini, bloqué par la règle Europe
    if ((cur && !curBlocked) || (TASKS[t].studentData && !PROVIDERS[provider].eu && !s.allow_non_eu)) continue;
    const m = defaultModel(provider, check.models, t);
    if (m && !(await pingModel(provider, key, m))) tasks[t] = { provider, model: m };
  }
  await saveTaskSettings({ ...s, tasks }, u.id);
  revalidatePath('/contenu/ia'); revalidatePath('/parent', 'layout');
  return { ok: `Clé ${PROVIDERS[provider].name} vérifiée et enregistrée (${check.models.length} modèle${check.models.length > 1 ? 's' : ''} disponible${check.models.length > 1 ? 's' : ''}).` };
}

export async function removeKey(provider: Provider) {
  const u = await requireUser('admin');
  if (isProvider(provider)) await removeProviderKey(provider, u.id);
  revalidatePath('/contenu/ia'); revalidatePath('/parent', 'layout');
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
    if (!isProvider(p) || !s.providers[p]) return { error: `${TASKS[t].label} : pas de clé enregistrée pour ce fournisseur.` };
    if (TASKS[t].studentData && !PROVIDERS[p].eu && !allowNonEu)
      return { error: `${TASKS[t].label} : ${PROVIDERS[p].name} traite les données aux ${PROVIDERS[p].where}. Choisissez Mistral (Union européenne), ou cochez la dérogation en connaissance de cause.` };
    const key = (await storedKey(p))!;
    // essai réel du modèle (Google garde dans sa liste des modèles retirés)
    let model = '';
    const candidates = p === 'gemini' ? geminiCandidates(s.providers[p]!.models, wanted).slice(0, 6) : [wanted];
    let first: string | null = null;
    for (const id of candidates) { const err = await pingModel(p, key, id); if (!err) { model = id; break; } first ??= err; }
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
