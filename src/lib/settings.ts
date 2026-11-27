// Règles parentales par élève (stockées dans students.settings), avec valeurs par défaut du cadrage.
export type StudentSettings = {
  weekly_goal_minutes: number;   // objectif de temps de travail par semaine (calculé « par jour × jours » si goal_mode = 'jour')
  goal_mode: 'semaine' | 'jour'; // objectif réglé par semaine, ou par jour sur les jours choisis
  daily_goal_minutes: number;    // objectif par jour (si goal_mode = 'jour')
  goal_days: number[];           // jours concernés, 1 = lundi … 7 = dimanche
  retry_delay_days: number;      // délai avant une nouvelle tentative d'évaluation
  eval_requires_approval: boolean;
  idle_seconds: number;          // sans aucun geste, page au premier plan : pause du temps compté (10 min par défaut : brouillon, réflexion…)
  theme: ThemeId;                // thème d'affichage de l'espace élève
  ai_correction: boolean;        // consentement du parent (RGPD) : copies corrigées par l'IA
  ai_bilan: boolean;             // consentement du parent (RGPD) : bilan pédagogique et test de positionnement par l'IA
  auto_correction: boolean;      // automatisme : copie corrigée par l'IA dès sa remise
  auto_bilan: 'off' | '3_evals' | 'hebdo';   // automatisme : bilan toutes les 3 évaluations notées, ou chaque semaine
  auto_test: boolean;            // automatisme : test de positionnement proposé dès qu'un bilan en prépare un
  birth: string | null;          // mois de naissance « AAAA-MM » (classe attendue, âge) — jamais envoyé à l'IA
  gender: 'fille' | 'garcon' | null;   // pour accorder les textes (il / elle)
  extra_time: boolean;           // aménagement (PAP, PPS) : temps majoré d'un tiers aux évaluations
};
export const THEMES = [
  { id: 'glacier', kind: 'girly', name: 'Girly ✦ Ice blue', desc: 'Bleu nuit, bleu glacier et rose poudré, titres arrondis' },
  { id: 'rose', kind: 'girly', name: 'Framboise', desc: 'Rose framboise, lilas et bleu glacier' },
  { id: 'lavande', kind: 'girly', name: 'Lavande', desc: 'Violet lavande, prune et touches de menthe' },
  { id: 'peche', kind: 'girly', name: 'Pêche corail', desc: 'Corail, pêche et lilas, ambiance coucher de soleil' },
  { id: 'barbe', kind: 'girly', name: 'Barbe à papa', desc: 'Rose bonbon et turquoise sur fond violet' },
  { id: 'etoile', kind: 'girly', name: 'Nuit étoilée', desc: 'Violet profond, doré et rose, très chic' },
  { id: 'graphite', kind: 'garcon', name: 'Graphite & Volt', desc: 'Graphite, orange volt et vert néon' },
  { id: 'lagon', kind: 'neutre', name: 'Lagon', desc: 'Bleu-vert franc et vert' },
  { id: 'classique', kind: 'neutre', name: 'Classique', desc: 'Bleu sobre' },
] as const;
export const THEME_KINDS = [
  { id: 'girly', label: 'Girly' }, { id: 'garcon', label: 'Garçon' }, { id: 'neutre', label: 'Neutres' },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];
export const isTheme = (t: unknown): t is ThemeId => THEMES.some(x => x.id === t);
export const DEFAULT_SETTINGS: StudentSettings = {
  weekly_goal_minutes: 300,
  goal_mode: 'semaine',
  daily_goal_minutes: 30,
  goal_days: [1, 2, 3, 4, 5],
  retry_delay_days: 3,
  eval_requires_approval: false,
  idle_seconds: 600,
  theme: 'classique',
  ai_correction: false,
  ai_bilan: false,
  auto_correction: false,
  auto_bilan: 'off',
  auto_test: false,
  birth: null,
  gender: null,
  extra_time: false,
};
/** Durée d'une évaluation pour cet élève (tiers-temps éventuel). */
export const evalMinutes = (base: number, s: Pick<StudentSettings, 'extra_time'>) => s.extra_time ? Math.ceil(base * 4 / 3) : base;
export const settingsOf = (raw: unknown): StudentSettings => {
  const s = { ...DEFAULT_SETTINGS, ...((raw as object) ?? {}) } as StudentSettings;
  const days = Array.isArray(s.goal_days) ? [...new Set(s.goal_days.map(Number).filter(d => d >= 1 && d <= 7))].sort() : [1, 2, 3, 4, 5];
  return { ...s, goal_mode: s.goal_mode === 'jour' ? 'jour' : 'semaine', goal_days: days, retry_delay_days: Math.max(1, s.retry_delay_days), idle_seconds: [300, 600, 900].includes(Number(s.idle_seconds)) ? Number(s.idle_seconds) : 600 };   // au moins 1 jour entre deux tentatives
};

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
