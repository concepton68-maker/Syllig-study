'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { checkKey, saveAiSettings, storedKey, CLAUDE_MODELS, type Provider } from '@/lib/ai';

export type AiFormState = { ok?: string; error?: string; models?: { id: string; label: string }[]; model?: string; provider?: Provider } | undefined;

// Enregistre le fournisseur, la clé (vérifiée auprès du fournisseur) et le modèle
export async function saveAi(_: AiFormState, form: FormData): Promise<AiFormState> {
  const u = await requireUser('admin');
  const provider: Provider = form.get('provider') === 'gemini' ? 'gemini' : 'claude';
  const typed = String(form.get('key') ?? '').trim();
  const enabled = form.get('enabled') === 'on';
  const key = typed || await storedKey(provider);
  if (!key) return { error: provider === 'claude' ? 'Collez votre clé Anthropic (elle commence par « sk-ant- »).' : 'Collez votre clé Google AI Studio.', provider };
  const check = await checkKey(provider, key);
  if (!check.ok) return { error: check.error, provider };
  const wanted = String(form.get('model') ?? '');
  const fallback = provider === 'claude' ? CLAUDE_MODELS[0].id
    : (check.models.find(m => /flash/i.test(m.id) && !/lite|preview|exp/i.test(m.id)) ?? check.models[0]).id;
  const model = check.models.some(m => m.id === wanted) ? wanted : fallback;
  await saveAiSettings({ provider, model, key: typed || undefined, enabled }, u.id);
  revalidatePath('/contenu/ia'); revalidatePath('/parent', 'layout');
  return { ok: enabled ? 'Clé vérifiée et enregistrée. La correction par IA est active.' : 'Clé vérifiée et enregistrée. La correction par IA est désactivée.', models: check.models, model, provider };
}
