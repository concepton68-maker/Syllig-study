// Générateur de consigne Claude pour un cours précis (code pur, utilisable côté navigateur).
// La consigne contient tout ce que Claude doit savoir : un seul copier-coller suffit.

export type OfficialSource = { texte: string; reference?: string; application?: string; lien?: string; contenu?: string };

export type PromptContext = {
  code: string;                // code attribué (existant ou prochain libre)
  isNewVersion: boolean;       // le cours a déjà un contenu publié
  level: { code: string; name: string };
  subject: string;
  chapter: string;
  title: string;
  priority: string;
  officialNote: string | null;
  sources: OfficialSource[];
  sourcesChecked: string | null;
  siblings: { title: string; code: string | null; hasContent: boolean }[];
  knownSkills: { id: string; label: string }[];
  skillPrefix: string;
  example: string;             // JSON d'un cours de référence (C001)
  exampleCode: string;
};

export type PromptOptions = {
  lessonMinutes: number;
  partsMin: number;
  partsMax: number;
  exercises: number;
  evalVariants: number;
  evalMinutes: number;
  remarks: string;
  includeExample: boolean;
};

export const DEFAULT_OPTIONS: PromptOptions = {
  lessonMinutes: 30, partsMin: 3, partsMax: 6, exercises: 10, evalVariants: 2, evalMinutes: 25, remarks: '', includeExample: true,
};

// Réglages proposés automatiquement selon le niveau, la matière et le type de cours (modifiables avant de copier la consigne)
const LEVEL_TIMES: [RegExp, { lesson: number; evalMin: number; label: string }][] = [
  [/^(sixieme|cinquieme)/, { lesson: 20, evalMin: 20, label: 'début de collège : leçons courtes' }],
  [/^quatrieme/, { lesson: 25, evalMin: 25, label: '4e' }],
  [/^troisieme/, { lesson: 30, evalMin: 25, label: '3e : format proche du brevet' }],
  [/^seconde/, { lesson: 35, evalMin: 30, label: 'lycée (Seconde)' }],
  [/^(premiere|terminale)/, { lesson: 40, evalMin: 40, label: 'cycle terminal : épreuves plus longues' }],
];
export function suggestOptions(c: PromptContext): { options: PromptOptions; reasons: string[] } {
  const o: PromptOptions = { ...DEFAULT_OPTIONS };
  const reasons: string[] = [];
  const lv = LEVEL_TIMES.find(([re]) => re.test(c.level.code))?.[1];
  if (lv) { o.lessonMinutes = lv.lesson; o.evalMinutes = lv.evalMin; reasons.push(`niveau ${c.level.name} (${lv.label}) : leçon ${lv.lesson} min, évaluation ${lv.evalMin} min`); }
  if (/fran[cç]ais|histoire|philo|lettres/i.test(c.subject)) { o.evalMinutes += 5; reasons.push(`${c.subject} : +5 min d’évaluation pour la rédaction`); }
  if (c.chapter === 'Remise à niveau') {
    o.lessonMinutes = Math.min(o.lessonMinutes, 20); o.partsMin = 2; o.partsMax = 4; o.exercises = 8; o.evalMinutes = 20;
    o.remarks = 'Leçon de remise à niveau : partir des bases, exemples très guidés et progressifs, vocabulaire simple, une seule difficulté à la fois. Exercices surtout « je repère » et « j’analyse ».';
    reasons.push('remise à niveau : leçon courte (20 min), 2 à 4 parties, 8 exercices très guidés, évaluation de 20 min');
  } else if (c.priority === 'prioritaire') {
    o.exercises = 12; reasons.push('notion prioritaire : 12 exercices pour bien l’ancrer');
  }
  return { options: o, reasons };
}

const PRIORITY: Record<string, string> = { prioritaire: 'prioritaire (notion de base à maîtriser tôt)', ensuite: 'standard', mis_de_cote: 'secondaire' };

export function buildPrompt(c: PromptContext, o: PromptOptions): string {
  const lines: string[] = [];
  const p = (s = '') => lines.push(s);

  p(`Tu es auteur de cours pour Syllig Study, une plateforme française de suivi scolaire (élève de ${c.level.name}).`);
  p(`Rédige ${c.isNewVersion ? 'une **nouvelle version complète**' : 'un **cours complet**'} sur la notion ci-dessous, au format JSON \`syllig-course/1\`, en suivant exactement la structure de l'exemple fourni${o.includeExample ? ' à la fin de ce message' : ' en pièce jointe'} (${c.exampleCode}).`);
  p();
  p('## Fiche du cours (à reprendre à l\'identique dans le JSON)');
  p(`- code : ${c.code}`);
  p(`- level : ${c.level.code}`);
  p(`- subject : ${c.subject}`);
  p(`- chapter : ${c.chapter}`);
  p(`- title : ${c.title}`);
  p(`- priorité dans le parcours : ${PRIORITY[c.priority] ?? c.priority}`);
  if (c.officialNote) p(`- remarque sur le programme : ${c.officialNote}`);
  p();

  if (c.sources.length) {
    p(`## Programme officiel de référence (${c.subject})`);
    for (const s of c.sources) {
      p(`- ${s.texte}${s.reference ? ` — ${s.reference}` : ''}${s.application ? ` (${s.application})` : ''}${s.lien ? ` — ${s.lien}` : ''}`);
      if (s.contenu) p(`  Ce que dit ce texte : ${s.contenu}`);
    }
    if (c.sourcesChecked) p(`(Sources vérifiées le ${c.sourcesChecked}.) Reste strictement dans ce programme ; signale-le en tête de ta réponse si la notion demandée en sort.`);
    p();
  }

  const others = c.siblings.filter(s => s.title !== c.title);
  if (others.length) {
    p(`## Les autres cours du chapitre « ${c.chapter} » (pour ne pas les traiter ici)`);
    for (const s of others) p(`- ${s.title}${s.code ? ` (${s.code})` : ''}${s.hasContent ? ' — déjà rédigé' : ''}`);
    p('Concentre-toi sur la notion de ce cours ; tu peux renvoyer brièvement à un cours voisin, sans le refaire.');
    p();
  }

  p('## Compétences (champ « skills »)');
  if (c.knownSkills.length) {
    p(`Compétences déjà utilisées en ${c.subject} : réutilise ces identifiants EXACTS quand ils correspondent, pour que la carte de progression reste cohérente d'un cours à l'autre.`);
    for (const s of c.knownSkills) p(`- ${s.id} : ${s.label}`);
    p(`Pour une compétence nouvelle, crée un identifiant court commençant par « ${c.skillPrefix}- » (minuscules, tirets).`);
  } else {
    p(`Déclare 4 à 8 compétences propres à la notion. Identifiants courts commençant par « ${c.skillPrefix}- » (minuscules, tirets), libellés clairs (« Identifier la focalisation »).`);
  }
  p();

  p('## Exigences pédagogiques');
  p(`- Conforme au programme officiel ; vocabulaire et difficulté adaptés à un élève de ${c.level.name}.`);
  p('- **Textes et exemples originaux** : aucun extrait de manuel ni d\'œuvre sous droits. Une œuvre du domaine public peut être citée brièvement, avec sa source.');
  p(`- Leçon d'environ ${o.lessonMinutes} min, en ${o.partsMin} à ${o.partsMax} parties. Blocs possibles : text, heading, list, table, callout (retiens, definition, attention, plus, methode, essentiel), quote, formula (LaTeX, pour les maths et sciences). Termine par une fiche mémo (« memo »).`);
  p('- Chaque partie se termine par un **point de contrôle** : 2 à 4 variantes de QCM, une seule bonne réponse, un indice (« hint ») qui renvoie à la partie sans donner la réponse, et une « explanation ».');
  p(`- Exercices : environ ${o.exercises}, en trois niveaux (« stars » 1 = je repère, 2 = j'analyse, 3 = je rédige), chacun avec un corrigé (« solution »). Préfère « qcm », « numeric » ou « short » quand une correction automatique est fiable${/math|physique|chimie|svt|ses|snt/i.test(c.subject) ? ' (calculs : « numeric » avec « tolerance » si besoin)' : ''}.`);
  p(`- Évaluation de ${o.evalMinutes} min, total **exactement 20 points**, en sections (connaissances, application/analyse, rédaction). Propose **${o.evalVariants} sujet${o.evalVariants > 1 ? 's' : ''} équivalent${o.evalVariants > 1 ? 's' : ''}** (« variants ») de même difficulté, pour permettre une nouvelle tentative.`);
  p('- Pour chaque question d\'évaluation : « points », « solution » et un barème détaillé critère par critère (« rubric ») — il sert à la correction.');
  p('- Chaque question porte « skills », « cognitive » (connaitre, appliquer, analyser, rediger) et « lesson_part » (numéro de la partie à revoir).');
  p('- Ton bienveillant, consignes claires, phrases courtes, tutoiement de l\'élève.');
  if (o.remarks.trim()) { p(); p('## Demandes particulières pour ce cours'); p(o.remarks.trim()); }
  p();
  p('## Exigences techniques');
  p('- Réponds UNIQUEMENT par le JSON complet, sans texte avant ni après, sans commentaires.');
  p('- « format » = "syllig-course/1". « code », « level », « subject », « chapter » et « title » exactement comme dans la fiche.');
  p('- Identifiants : ex1, ex2… pour les exercices ; q1, q2… pour l\'évaluation (uniques dans chaque sujet). Les textes supports ont un « id » (t1, t2…) cité dans « text_ref ».');
  p('- Index des bonnes réponses de QCM à partir de 0. Mise en forme permise dans les textes : **gras**, *italique*, retour à la ligne \\n.');
  p('- Vérifie avant de répondre : total de chaque sujet = 20 points, chaque question a un corrigé, chaque point de contrôle a au moins 2 variantes, toutes les compétences citées sont déclarées.');
  if (o.includeExample) {
    p();
    p(`## Exemple de référence (${c.exampleCode}) — structure à suivre, contenu à ne pas recopier`);
    p('```json');
    p(c.example);
    p('```');
  }
  return lines.join('\n');
}

export const SKILL_PREFIX: Record<string, string> = {
  'Français': 'fr', 'Mathématiques': 'ma', 'Histoire-Géographie': 'hg', 'LVA': 'lva', 'LVB': 'lvb', 'SES': 'ses',
  'Physique-Chimie': 'pc', 'SVT': 'svt', 'SNT': 'snt', 'EMC': 'emc', 'EPS': 'eps',
};
