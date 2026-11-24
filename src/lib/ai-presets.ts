// Fournisseurs proposés dans la liste « Fournisseur » (Contenu › IA). Les trois premiers ont une intégration dédiée ;
// les autres passent par l'API compatible OpenAI (adresse préremplie, modifiable). « Autre » : adresse à saisir.
export type Preset = { id: string; name: string; builtin?: boolean; base?: string; eu: boolean; where: string; help: string; modelsHint?: string };

export const PRESETS: Preset[] = [
  { id: 'mistral', name: 'Mistral (France)', builtin: true, eu: true, where: 'Union européenne', help: 'Clé sur console.mistral.ai › API Keys (offre payante).' },
  { id: 'claude', name: 'Claude (Anthropic)', builtin: true, eu: false, where: 'États-Unis', help: 'Clé sur console.anthropic.com › API Keys (crédits API, distincts de l’abonnement claude.ai).' },
  { id: 'gemini', name: 'Gemini (Google)', builtin: true, eu: false, where: 'États-Unis', help: 'Clé sur aistudio.google.com › Get API key (offre payante).' },
  { id: 'glm', name: 'GLM (Z.ai)', base: 'https://api.z.ai/api/paas/v4', eu: false, where: 'Chine / Singapour', help: 'Clé sur z.ai › API Keys.', modelsHint: 'glm-4.6' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', base: 'https://api.openai.com/v1', eu: false, where: 'États-Unis', help: 'Clé sur platform.openai.com › API keys.' },
  { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com/v1', eu: false, where: 'Chine', help: 'Clé sur platform.deepseek.com › API keys.' },
  { id: 'scaleway', name: 'Scaleway (France)', base: 'https://api.scaleway.ai/v1', eu: true, where: 'Union européenne', help: 'Clé sur console.scaleway.com › Generative APIs (vérifiez l’adresse dans leur documentation).' },
  { id: 'ovhcloud', name: 'OVHcloud AI Endpoints (France)', base: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', eu: true, where: 'Union européenne', help: 'Clé sur le manager OVHcloud › AI Endpoints (vérifiez l’adresse dans leur documentation).' },
  { id: 'autre', name: 'Autre (API compatible OpenAI)', eu: false, where: '', help: 'Adresse de l’API et nom du modèle : voir la documentation du fournisseur.' },
];
