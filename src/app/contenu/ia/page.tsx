import { requireUser } from '@/lib/auth';
import { aiSettings, CLAUDE_MODELS } from '@/lib/ai';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { AiForm } from './Form';

export const metadata = { title: 'IA de correction' };
export const dynamic = 'force-dynamic';

export default async function AiPage() {
  await requireUser('admin');
  const s = await aiSettings();
  return (
    <Screen top={<PageTitle kicker="IA de correction" title="Correction des copies par IA"
      sub="L’IA propose les points et les commentaires des réponses rédigées ; la note n’est définitive qu’après votre validation." />}>
      <section className="card max-w-[760px] flex flex-col gap-4">
        <p className="m-0 text-sm">
          État : {s?.hasKey ? (s.enabled ? <strong className="text-brand-dark">active</strong> : <strong>désactivée</strong>) : <strong>pas encore configurée</strong>}
          {s?.hasKey && <> · {s.provider === 'claude' ? 'Claude' : 'Gemini'} · <code>{s.model}</code> · clé {s.key_hint}</>}
        </p>
        <AiForm current={s && { provider: s.provider, model: s.model, key_hint: s.key_hint, enabled: s.enabled, hasKey: s.hasKey }} claudeModels={CLAUDE_MODELS} />
      </section>
      <section className="card max-w-[760px] flex flex-col gap-2 text-sm">
        <h2 className="text-lg font-semibold m-0">Bon à savoir</h2>
        <ul className="m-0 pl-5 list-disc flex flex-col gap-1.5">
          <li>Seules les réponses rédigées partent chez le fournisseur, <strong>sans le nom de l’élève</strong> ; les QCM et les calculs sont corrigés par la plateforme.</li>
          <li>La clé est vérifiée auprès du fournisseur, puis enregistrée chiffrée. Elle n’est jamais réaffichée.</li>
          <li>Le coût est facturé par le fournisseur sur votre compte (quelques centimes par copie au plus).</li>
        </ul>
      </section>
    </Screen>
  );
}
