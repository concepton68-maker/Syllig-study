// Règles parentales par élève (stockées dans students.settings), avec valeurs par défaut du cadrage.
export type StudentSettings = {
  weekly_goal_minutes: number;   // objectif de temps actif par semaine
  retry_delay_days: number;      // délai avant une nouvelle tentative d'évaluation
  eval_requires_approval: boolean;
  idle_seconds: number;          // inactivité avant pause du chrono
};
export const DEFAULT_SETTINGS: StudentSettings = {
  weekly_goal_minutes: 300,
  retry_delay_days: 3,
  eval_requires_approval: false,
  idle_seconds: 60,
};
export const settingsOf = (raw: unknown): StudentSettings => ({ ...DEFAULT_SETTINGS, ...((raw as object) ?? {}) });

// Seuils de maîtrise (section 5 du cadrage) — réglages, pas du code métier dispersé.
export const MASTERY = {
  labels: ['Pas encore commencé', 'Découverte', 'En construction', 'Presque acquis', 'Acquis', 'Maîtrisé'],
  exercisesNearly: 8,     // exercices ≥ 8/10 → presque acquis
  evalNearly: 10,         // éval ≥ 10 → presque acquis
  evalAcquired: 14,       // éval ≥ 14 → acquis
  evalMastered: 16,       // éval ≥ 16 au moins N jours après la leçon → maîtrisé
  masteredDelayDays: 3,
};
export function reviewDelayDays(score: number) {
  if (score < 10) return 3;
  if (score < 14) return 7;
  if (score < 17) return 14;
  return 30;
}
