import 'server-only';
import { sql } from './db';
import { studentProfile, type Profile } from './profile';

// « Il ne veut pas » ou « il n'arrive pas » ? Deux mesures séparées, chacune faite de faits mesurés :
//  - l'investissement (sérieux) : régularité, volume, concentration, lecture des leçons, effort pendant les évaluations ;
//  - la compréhension : points de contrôle, exercices, évaluations, test de positionnement —
//    UNIQUEMENT sur le travail fait sérieusement (une copie bâclée mesure le manque de sérieux, pas la compréhension).
// Granularité volontairement grossière : totaux par séance et signaux de 15 s déjà collectés, rien de plus
// (ni frappes, ni captures d'écran, ni sites visités).

export type Part = { key: string; label: string; score: number; weight: number; fact: string };
export type Axis = { score: number | null; parts: Part[] };
export type Quadrant = 'reussite' | 'difficulte' | 'investissement' | 'decrochage';
export type SubjectPoint = { subject: string; serieux: number; comprehension: number; courses: number };
export type Engagement = {
  window_days: number;
  serieux: Axis; comprehension: Axis;
  quadrant: Quadrant | null; near_limit: boolean;
  confidence: 'insuffisant' | 'indicatif' | 'solide'; confidence_why: string;
  subjects: SubjectPoint[];
  excluded_evals: number;
  trend: { last14: number; prev14: number; drop: boolean; after_bad_grade: boolean };
};

export const THRESHOLD = 60;
export const QUADRANT: Record<Quadrant, { title: string; short: string; meaning: string; todo: string[] }> = {
  reussite: {
    title: 'Investi et il comprend', short: 'Sur de bons rails',
    meaning: 'Le travail est régulier et sérieux, et ce qui est fait sérieusement est compris.',
    todo: ['Garder le rythme et le souligner : c’est ce qui paie.', 'Proposer les cours suivants ou des exercices plus difficiles (★★★).'],
  },
  difficulte: {
    title: 'Il travaille, mais il bloque', short: 'N’arrive pas',
    meaning: 'L’élève fait sérieusement son travail, mais les résultats restent faibles : c’est une difficulté de compréhension, pas un manque de volonté.',
    todo: ['Ne pas lui reprocher son manque de travail : il en fait.', 'Faire le test de positionnement pour trouver les bases qui manquent (souvent des années précédentes).',
      'Reprendre les leçons de rattrapage proposées dans le Bilan, une notion à la fois.', 'Valoriser l’effort autant que la note pour éviter le découragement.'],
  },
  investissement: {
    title: 'Il comprend quand il s’y met, mais s’investit peu', short: 'Ne veut pas (ou pas encore)',
    meaning: 'Quand le travail est fait sérieusement, il est réussi : les capacités sont là. Ce qui manque, c’est la régularité ou le sérieux.',
    todo: ['Fixer un cadre : un créneau fixe chaque jour, court (20–30 min) plutôt que long.', 'Un objectif visible et atteignable (temps hebdomadaire dans les réglages), et le féliciter quand il est atteint.',
      'Regarder ensemble les évaluations rendues trop vite ou à moitié vides.', 'Chercher la cause : fatigue, écrans, manque d’intérêt, sentiment que « ça ne sert à rien ».'],
  },
  decrochage: {
    title: 'Peu de travail et des résultats faibles', short: 'À relancer',
    meaning: 'On ne peut pas encore séparer « ne veut pas » et « n’arrive pas » : il y a trop peu de travail sérieux pour mesurer la compréhension. Souvent, un élève qui n’y arrive pas finit par ne plus vouloir.',
    todo: ['D’abord relancer l’activité avec des séances très courtes et faciles à réussir.', 'Faire le test de positionnement, accompagné, pour savoir s’il y a des lacunes de base.',
      'Refaire ce bilan dans deux semaines : la mesure deviendra fiable.'],
  },
};

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const combine = (parts: Part[]) => { const w = parts.reduce((a, p) => a + p.weight, 0); return w ? Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / w) : null; };
const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
// une évaluation est « sérieuse » si l'élève y a passé au moins 30 % du temps et a répondu à 60 % des questions
const seriousEval = (e: { used_min: number | null; allowed_min: number; blank_ratio: number }) => (e.used_min === null || e.used_min >= e.allowed_min * 0.3) && e.blank_ratio < 0.4;
const lessonOk = (l: { expected_min: number; active_min: number }) => !l.expected_min || l.active_min >= l.expected_min * 0.35;

// Investissement et compréhension sur un ensemble de cours (toute la scolarité sur la plateforme, ou une matière)
function courseAxes(courses: Profile['courses']) {
  const s: Part[] = [], c: Part[] = [];
  const lessons = courses.filter(x => x.lesson.done && x.lesson.expected_min > 0);
  if (lessons.length) {
    const sc = avg(lessons.map(x => clamp(x.lesson.active_min / (x.lesson.expected_min * 0.8))))!;
    s.push({ key: 'lecture', label: 'Lecture des leçons', weight: 20, score: Math.round(sc * 100),
      fact: `${lessons.length} leçon${lessons.length > 1 ? 's' : ''} : ${lessons.reduce((a, x) => a + x.lesson.active_min, 0)} min actives pour ${lessons.reduce((a, x) => a + x.lesson.expected_min, 0)} prévues` });
  }
  const evals = courses.flatMap(x => x.evaluations);
  if (evals.length) {
    const sc = avg(evals.map(e => 0.4 * (e.used_min === null ? 1 : clamp(e.used_min / (e.allowed_min * 0.5))) + 0.4 * (1 - e.blank_ratio) + 0.2 * clamp(1 - 0.15 * Math.max(0, e.focus_losses - 1))))!;
    const quick = evals.filter(e => e.used_min !== null && e.used_min < e.allowed_min * 0.3).length, blank = evals.filter(e => e.blank_ratio >= 0.4).length;
    s.push({ key: 'effort_eval', label: 'Effort pendant les évaluations', weight: 20, score: Math.round(sc * 100),
      fact: `${evals.length} copie${evals.length > 1 ? 's' : ''}${quick ? ` · ${quick} rendue${quick > 1 ? 's' : ''} très vite` : ''}${blank ? ` · ${blank} à moitié vide${blank > 1 ? 's' : ''}` : ''}${!quick && !blank ? ' · temps utilisé et copies remplies' : ''}` });
  }
  // compréhension : seulement là où le travail a été fait sérieusement
  const cp = courses.filter(x => x.checkpoints.parts > 0 && lessonOk(x.lesson));
  if (cp.length) {
    const parts = cp.reduce((a, x) => a + x.checkpoints.parts, 0), ok = cp.reduce((a, x) => a + x.checkpoints.first_try_ok, 0);
    c.push({ key: 'controles', label: 'Points de contrôle réussis du premier coup', weight: 25, score: Math.round((ok / parts) * 100), fact: `${ok} sur ${parts}, leçons lues sérieusement` });
  }
  const ex = courses.filter(x => x.exercises.score !== null);
  if (ex.length) {
    const m = avg(ex.map(x => x.exercises.score!))!;
    c.push({ key: 'exercices', label: 'Exercices', weight: 25, score: Math.round(m * 10), fact: `moyenne ${fr(m)}/10 sur ${ex.length} série${ex.length > 1 ? 's' : ''}` });
  }
  const graded = evals.filter(e => e.status === 'graded' && e.score !== null);
  const kept = graded.filter(seriousEval);
  if (kept.length) {
    const m = avg(kept.map(e => e.score!))!;
    c.push({ key: 'evaluations', label: 'Évaluations faites sérieusement', weight: 35, score: Math.round(m * 5), fact: `moyenne ${fr(m)}/20 sur ${kept.length} copie${kept.length > 1 ? 's' : ''}` });
  }
  return { s, c, excluded: graded.length - kept.length };
}

export async function engagement(studentId: string): Promise<Engagement> {
  const WINDOW = 28;
  const profile = await studentProfile(studentId);
  const [st] = await sql<{ settings: { weekly_goal_minutes?: number } }[]>`select settings from students where id = ${studentId}`;
  const goal = Number(st?.settings?.weekly_goal_minutes ?? 300);
  const [w] = await sql<{ active: number; open: number; sessions: number; days: number; last14: number; prev14: number }[]>`
    select coalesce(sum(active_seconds), 0)::int as active, coalesce(sum(open_seconds), 0)::int as open, count(*)::int as sessions,
      count(distinct (started_at at time zone 'Europe/Paris')::date) filter (where active_seconds >= 600)::int as days,
      coalesce(sum(active_seconds) filter (where started_at > now() - interval '14 days'), 0)::int as last14,
      coalesce(sum(active_seconds) filter (where started_at <= now() - interval '14 days'), 0)::int as prev14
    from work_sessions where student_id = ${studentId} and started_at > now() - make_interval(days => ${WINDOW})`;
  const [bad] = await sql<{ n: number }[]>`select count(*)::int as n from eval_attempts where student_id = ${studentId} and status = 'graded'
    and final_score < 10 and submitted_at between now() - interval '28 days' and now() - interval '10 days'`;

  const s: Part[] = [];
  if (w.sessions > 0) {
    s.push({ key: 'regularite', label: 'Régularité', weight: 25, score: Math.round(clamp(w.days / 16) * 100),
      fact: `${w.days} jour${w.days > 1 ? 's' : ''} avec au moins 10 min de travail sur 4 semaines (repère : 4 par semaine)` });
    s.push({ key: 'volume', label: 'Temps de travail', weight: 15, score: Math.round(clamp(w.active / (goal * 60 * 4)) * 100),
      fact: `${Math.round(w.active / 60)} min effectives sur 4 semaines, pour un objectif de ${goal * 4} min` });
    if (w.open >= 1800) s.push({ key: 'concentration', label: 'Concentration', weight: 20, score: Math.round(clamp((w.active / w.open - 0.4) / 0.45) * 100),
      fact: `${Math.round((w.active / w.open) * 100)} % du temps passé sur une page de travail est réellement actif` });
  }
  const all = courseAxes(profile.courses);
  s.push(...all.s);
  const c = [...all.c];
  const t = profile.placement.at(-1);
  if (t && t.total) c.push({ key: 'positionnement', label: 'Test de positionnement', weight: 15, score: Math.round((t.score / t.total) * 100), fact: `${t.score}/${t.total} le ${new Date(t.date).toLocaleDateString('fr-FR')}` });

  const S = combine(s), C = combine(c);
  // fiabilité : assez de séances pour l'investissement, assez de mesures sérieuses pour la compréhension
  const cMeasures = profile.courses.filter(x => x.checkpoints.parts > 0 && lessonOk(x.lesson)).length + profile.courses.filter(x => x.exercises.score !== null).length
    + profile.courses.flatMap(x => x.evaluations).filter(e => e.status === 'graded' && seriousEval(e)).length + (t ? 1 : 0);
  let confidence: Engagement['confidence'] = 'insuffisant', why = '';
  if (w.sessions < 4 || w.days < 2) why = `Seulement ${w.sessions} séance${w.sessions > 1 ? 's' : ''} sur 4 semaines : il en faut au moins 4, sur 2 jours différents.`;
  else if (cMeasures < 3) why = `Seulement ${cMeasures} mesure${cMeasures > 1 ? 's' : ''} de compréhension sur du travail sérieux : il en faut au moins 3 (leçons, exercices, évaluations).`;
  else if (w.sessions >= 10 && cMeasures >= 6) { confidence = 'solide'; why = `${w.sessions} séances et ${cMeasures} mesures de compréhension : assez pour un portrait fiable.`; }
  else { confidence = 'indicatif'; why = `${w.sessions} séances et ${cMeasures} mesures de compréhension : tendance à confirmer avec un peu plus de travail.`; }

  const quadrant: Quadrant | null = S === null || C === null || confidence === 'insuffisant' ? null
    : S >= THRESHOLD ? (C >= THRESHOLD ? 'reussite' : 'difficulte') : (C >= THRESHOLD ? 'investissement' : 'decrochage');

  // par matière : un point par matière où les deux mesures existent
  const bySubject = new Map<string, Profile['courses']>();
  for (const x of profile.courses) bySubject.set(x.subject, [...(bySubject.get(x.subject) ?? []), x]);
  const subjects: SubjectPoint[] = [];
  for (const [subject, cs] of bySubject) {
    const a = courseAxes(cs), ss = combine(a.s), cc = combine(a.c);
    if (ss !== null && cc !== null) subjects.push({ subject, serieux: ss, comprehension: cc, courses: cs.length });
  }
  const drop = w.prev14 >= 3600 && w.last14 < w.prev14 * 0.6;
  return {
    window_days: WINDOW, serieux: { score: S, parts: s }, comprehension: { score: C, parts: c },
    quadrant, near_limit: S !== null && C !== null && (Math.abs(S - THRESHOLD) < 8 || Math.abs(C - THRESHOLD) < 8),
    confidence, confidence_why: why, subjects, excluded_evals: all.excluded,
    trend: { last14: Math.round(w.last14 / 60), prev14: Math.round(w.prev14 / 60), drop, after_bad_grade: drop && bad.n > 0 },
  };
}
