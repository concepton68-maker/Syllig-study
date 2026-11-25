// Classe attendue d'après l'année de naissance (règle française : on entre au CP l'année civile de ses 6 ans,
// la classe ne dépend pas du mois de naissance). Le parent garde la main : redoublement, saut de classe…
export const CLASSES = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6e', '5e', '4e', '3e', 'Seconde', 'Première', 'Terminale'] as const;
// classes de la plateforme, dans le même ordre (null = pas encore de programme)
export const LEVEL_OF_CLASS: Record<string, string> = { '6e': 'sixieme', '5e': 'cinquieme', '4e': 'quatrieme', '3e': 'troisieme-generale', Seconde: 'seconde-generale' };

/** Année de la rentrée en cours (septembre). */
export function schoolYearStart(today = new Date()) { return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1; }

/** Classe attendue pour un enfant né l'année `birthYear`, pendant l'année scolaire en cours. */
export function expectedClass(birthYear: number, today = new Date()): { index: number; name: string | null } {
  const index = schoolYearStart(today) - (birthYear + 6);
  return { index, name: index >= 0 && index < CLASSES.length ? CLASSES[index] : null };
}

export function ageAt(birth: string, today = new Date()) {
  const [y, m] = birth.split('-').map(Number);
  let a = today.getFullYear() - y;
  if (today.getMonth() + 1 < m) a--;
  return a;
}

/** Écart entre la classe choisie et la classe attendue : « en avance d'un an », « un an de retard (redoublement) »… */
export function pathNote(birthYear: number, levelName: string, today = new Date()): string | null {
  const exp = expectedClass(birthYear, today);
  const chosen = CLASSES.findIndex(c => levelName.startsWith(c === 'Seconde' ? 'Seconde' : c));
  if (chosen < 0 || exp.name === null) return null;
  const d = chosen - exp.index;
  if (d === 0) return null;
  return d < 0 ? `${-d} an${d < -1 ? 's' : ''} de décalage par rapport à son âge (classe attendue : ${exp.name}) : redoublement ou entrée tardive` : `En avance de ${d} an${d > 1 ? 's' : ''} (classe attendue : ${exp.name})`;
}
