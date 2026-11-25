// Questionnaire « Comment je travaille » : 14 affirmations, 4 réponses (pas du tout → tout à fait), 2 questions libres.
// Inspiré de la théorie de l'autodétermination (envie, utilité, pression, perte de sens, sentiment de compétence, autonomie,
// soutien) et des facteurs pratiques (stress, sommeil, téléphone, lieu). Ce n'est pas un test psychologique : c'est le ressenti
// de l'élève, montré au parent pour mieux l'aider, et jamais une note.

export const SCALE = ['Pas du tout', 'Plutôt pas', 'Plutôt oui', 'Tout à fait'] as const;
export type Dim = 'envie' | 'sens' | 'pression' | 'confiance' | 'stress' | 'organisation' | 'soutien' | 'conditions';
export const ITEMS: { id: string; text: string; dim: Dim; reverse?: boolean }[] = [
  { id: 'q1', dim: 'envie', text: 'J’aime apprendre des choses nouvelles.' },
  { id: 'q2', dim: 'envie', text: 'Je suis content(e) quand je comprends quelque chose de difficile.' },
  { id: 'q3', dim: 'sens', text: 'Ce que j’apprends me servira plus tard.' },
  { id: 'q4', dim: 'sens', text: 'Je ne vois pas à quoi servent la plupart des cours.', reverse: true },
  { id: 'q5', dim: 'pression', text: 'Je travaille surtout pour éviter les reproches ou les mauvaises notes.' },
  { id: 'q6', dim: 'confiance', text: 'Si je travaille, je suis capable de réussir.' },
  { id: 'q7', dim: 'confiance', text: 'Quand je bloque sur un exercice, j’abandonne vite.', reverse: true },
  { id: 'q8', dim: 'stress', text: 'Les contrôles me stressent beaucoup.' },
  { id: 'q9', dim: 'stress', text: 'J’ai peur de me tromper.' },
  { id: 'q10', dim: 'organisation', text: 'J’arrive à m’organiser seul(e) pour travailler.' },
  { id: 'q11', dim: 'soutien', text: 'Quand je ne comprends pas, je sais à qui demander de l’aide.' },
  { id: 'q12', dim: 'conditions', text: 'Le soir, je dors assez.' },
  { id: 'q13', dim: 'conditions', text: 'Quand je travaille, mon téléphone me distrait.', reverse: true },
  { id: 'q14', dim: 'conditions', text: 'J’ai un endroit calme pour travailler.' },
];
// libellés côté parent ; « bad » = un score élevé est un signal d'alerte (pression, stress)
export const DIMS: Record<Dim, { label: string; high: string; low: string; bad?: boolean; help: string }> = {
  envie: { label: 'Envie d’apprendre', high: 'Aime apprendre et comprendre.', low: 'Peu de plaisir à apprendre en ce moment.', help: 'Relier les cours à ce qui l’intéresse ; le laisser choisir l’ordre de certains cours.' },
  sens: { label: 'Sens donné au travail', high: 'Voit à quoi sert ce qu’il apprend.', low: 'Ne voit pas bien à quoi servent les cours.', help: 'Parler ensemble de ses projets et de ce à quoi sert concrètement une notion.' },
  pression: { label: 'Travail sous la pression', high: 'Travaille surtout pour éviter les reproches ou les mauvaises notes.', low: 'Ne travaille pas seulement par peur des reproches.', bad: true, help: 'Féliciter l’effort et les progrès plutôt que la note ; éviter les menaces et les comparaisons.' },
  confiance: { label: 'Confiance en ses capacités', high: 'Se sent capable de réussir et persévère.', low: 'Doute de ses capacités, abandonne vite.', help: 'Commencer par des exercices ★ réussis ; montrer ses progrès ; dire « tu n’y arrives pas encore ».' },
  stress: { label: 'Stress des évaluations', high: 'Stresse beaucoup pour les contrôles ou a peur de se tromper.', low: 'Stress maîtrisé.', bad: true, help: 'Dédramatiser l’erreur ; s’entraîner sans note (exercices) ; respirer avant l’évaluation.' },
  organisation: { label: 'Organisation', high: 'S’organise seul(e).', low: 'A du mal à s’organiser seul(e).', help: 'Un créneau fixe et court chaque jour ; la plateforme dit quoi faire ensuite.' },
  soutien: { label: 'Aide disponible', high: 'Sait à qui demander de l’aide.', low: 'Ne sait pas à qui demander de l’aide.', help: 'Lui dire clairement qu’il peut vous demander, et à qui d’autre (professeur, frère, sœur…).' },
  conditions: { label: 'Conditions de travail', high: 'Sommeil, calme et téléphone : conditions plutôt bonnes.', low: 'Sommeil, bruit ou téléphone gênent le travail.', help: 'Téléphone dans une autre pièce pendant le travail ; heure de coucher régulière ; un coin calme.' },
};
export const CHECKIN_EVERY_DAYS = 42;

export function scoreCheckin(answers: Record<string, number>) {
  const by: Partial<Record<Dim, number[]>> = {};
  for (const it of ITEMS) {
    const v = answers[it.id];
    if (typeof v !== 'number' || v < 0 || v > 3) continue;
    (by[it.dim] ??= []).push(it.reverse ? 3 - v : v);
  }
  const scores: Partial<Record<Dim, number>> = {};
  for (const [d, xs] of Object.entries(by) as [Dim, number[]][]) scores[d] = Math.round((xs.reduce((a, b) => a + b, 0) / (xs.length * 3)) * 100);
  return scores;
}
