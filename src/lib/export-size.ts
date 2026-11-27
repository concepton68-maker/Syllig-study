// Poids d'un export de cours pour Claude (demande du propriétaire, 27/11/2026), calculé avant l'export.
// Taille : caractères du JSON (mesurée). Tokens : estimation, environ 3 caractères par token pour un JSON en français.
// Repère : une conversation Claude contient environ 200 000 tokens, et la réponse doit aussi y tenir.
export const CHARS_PER_TOKEN = 3;
export const CONSIGNE_CHARS = 1500;
export const FIT_TOKENS = 120_000;   // tient bien dans une conversation, avec de la place pour la réponse
export const MAX_TOKENS = 180_000;   // au-delà : trop gros pour une seule conversation

export function sizeInfo(chars: number) {
  const tokens = Math.round(chars / CHARS_PER_TOKEN);
  const ko = chars / 1000;
  const size = ko >= 1000 ? `${(ko / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(ko))} Ko`;
  const level = tokens <= FIT_TOKENS ? 'ok' : tokens <= MAX_TOKENS ? 'limite' : 'trop';
  return { size, tokens, level } as const;
}
export const tokensLabel = (t: number) => `environ ${(Math.round(t / 1000) * 1000).toLocaleString('fr-FR')} tokens`;
