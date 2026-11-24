'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { checkKey, saveAiSettings, storedKey, geminiCandidates, pingGemini, CLAUDE_MODELS, type Provider } from '@/lib/ai';

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
  // un changement de fournisseur repart sur le modèle conseillé (le modèle affiché était celui de l'autre fournisseur)
  const asked = check.models.some(m => m.id === wanted) ? wanted : undefined;
  let model = provider === 'claude' ? asked ?? CLAUDE_MODELS[0].id : '';
  let note = '';
  if (provider === 'gemini') {
    // essai réel : Google garde dans sa liste des modèles retirés qui répondent « 404 »
    let first: string | null = null;
    for (const id of geminiCandidates(check.models, asked).slice(0, 6)) {
      const err = await pingGemini(key, id);
      if (!err) { model = id; break; }
      first ??= `${id} : ${err}`;
    }
    if (!model) return { error: `Aucun modèle Gemini ne répond avec cette clé (${first}).`, provider, models: check.models };
    if (asked && model !== asked) note = ` Le modèle ${asked} n’est plus disponible chez Google : ${model} a été choisi à la place.`;
  }
  await saveAiSettings({ provider, model, key: typed || undefined, enabled }, u.id);
  revalidatePath('/contenu/ia'); revalidatePath('/parent', 'layout');
  return { ok: (enabled ? 'Clé vérifiée et enregistrée. La correction par IA est active.' : 'Clé vérifiée et enregistrée. La correction par IA est désactivée.') + note, models: check.models, model, provider };
}
