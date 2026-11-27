// Durées affichées aux parents (demande du propriétaire, 27/11/2026) : toujours HH:MM (« 01:05 » = 1 heure 5 minutes).
// Règle de calcul unique : minutes entières vers le bas (59 s = 0 min) ; une somme affichée avec ses parties est répartie
// au plus grand reste pour que les parties s'additionnent exactement au total.
export const toMin = (sec: number) => Math.floor(Math.max(0, sec) / 60);
export function duree(min: number) {
  const m = Math.max(0, Math.floor(min));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export const dureeSec = (sec: number) => duree(toMin(sec));
/** Minutes de chaque partie (secondes), dont la somme vaut exactement floor(total / 60). */
export function splitMinutes(secs: number[]): number[] {
  const total = toMin(secs.reduce((n, s) => n + Math.max(0, s), 0));
  const sum = secs.reduce((n, s) => n + Math.max(0, s), 0);
  if (!sum) return secs.map(() => 0);
  const parts = secs.map((s, i) => { const x = (Math.max(0, s) / sum) * total; return { i, m: Math.floor(x), r: x - Math.floor(x) }; });
  let left = total - parts.reduce((n, p) => n + p.m, 0);
  for (const p of [...parts].sort((a, b) => b.r - a.r)) { if (left <= 0) break; p.m++; left--; }
  return parts.map(p => p.m);
}
