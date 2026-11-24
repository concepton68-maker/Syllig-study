// Page restée ouverte pendant une mise en ligne : elle réclame des fichiers ou des actions de l'ancienne version.
// On le reconnaît à ces messages, et on recharge la page une seule fois (les réponses sont déjà enregistrées côté serveur).
const PATTERNS = [/ChunkLoadError/i, /Loading chunk/i, /Loading CSS chunk/i, /dynamically imported module/i,
  /Failed to find Server Action/i, /Server Action .* was not found/i, /older or newer deployment/i, /Failed to fetch RSC payload/i];

export const isStaleBuildError = (msg: unknown) => PATTERNS.some(p => p.test(String(msg ?? '')));

export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem('ss_reload_version') ?? 0);
    if (Date.now() - last < 30_000) return false;           // pas de boucle de rechargements
    sessionStorage.setItem('ss_reload_version', String(Date.now()));
  } catch { /* stockage indisponible : on recharge quand même */ }
  window.location.reload();
  return true;
}
