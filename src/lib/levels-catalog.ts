// Niveaux scolaires français (demande du propriétaire, 28/11/2026) : l'administrateur ajoute un niveau en le choisissant
// dans cette liste, jamais en le tapant. Les codes sont ceux des dossiers content/<niveau>/ (programme officiel).
export type LevelDef = { code: string; name: string; cycle: string; position: number };
export const LEVEL_CATALOG: LevelDef[] = [
  { code: 'cp', name: 'CP', cycle: 'École élémentaire · cycle 2', position: -5 },
  { code: 'ce1', name: 'CE1', cycle: 'École élémentaire · cycle 2', position: -4 },
  { code: 'ce2', name: 'CE2', cycle: 'École élémentaire · cycle 2', position: -3 },
  { code: 'cm1', name: 'CM1', cycle: 'École élémentaire · cycle 3', position: -2 },
  { code: 'cm2', name: 'CM2', cycle: 'École élémentaire · cycle 3', position: -1 },
  { code: 'sixieme', name: '6e', cycle: 'Collège', position: 1 },
  { code: 'cinquieme', name: '5e', cycle: 'Collège', position: 2 },
  { code: 'quatrieme', name: '4e', cycle: 'Collège', position: 3 },
  { code: 'troisieme-generale', name: '3e générale', cycle: 'Collège', position: 4 },
  { code: 'seconde-generale', name: 'Seconde générale', cycle: 'Lycée', position: 5 },
  { code: 'premiere-generale', name: 'Première générale', cycle: 'Lycée', position: 6 },
  { code: 'premiere-technologique', name: 'Première technologique', cycle: 'Lycée', position: 7 },
  { code: 'terminale-generale', name: 'Terminale générale', cycle: 'Lycée', position: 8 },
  { code: 'terminale-technologique', name: 'Terminale technologique', cycle: 'Lycée', position: 9 },
  { code: 'seconde-pro', name: 'Seconde professionnelle', cycle: 'Lycée professionnel', position: 10 },
  { code: 'premiere-pro', name: 'Première professionnelle', cycle: 'Lycée professionnel', position: 11 },
  { code: 'terminale-pro', name: 'Terminale professionnelle', cycle: 'Lycée professionnel', position: 12 },
  { code: 'cap-1', name: 'CAP 1re année', cycle: 'Lycée professionnel', position: 13 },
  { code: 'cap-2', name: 'CAP 2e année', cycle: 'Lycée professionnel', position: 14 },
];
export const levelDef = (code: string) => LEVEL_CATALOG.find(l => l.code === code) ?? null;

// Matières de chaque niveau (demande du propriétaire, 28/11/2026) : on ajoute une matière en la choisissant dans cette liste.
// Les noms reprennent ceux des programmes (content/<niveau>/programme.json) pour qu'un même enseignement garde le même nom.
const CYCLE2 = ['Français', 'Mathématiques', 'Questionner le monde', 'Enseignement moral et civique', 'Anglais (LV1)', 'Arts plastiques', 'Éducation musicale', 'EPS'];
const CYCLE3 = ['Français', 'Mathématiques', 'Histoire-Géographie', 'Sciences et technologie', 'Enseignement moral et civique', 'Anglais (LV1)', 'Arts plastiques', 'Éducation musicale', 'EPS'];
const COLLEGE = ['Français', 'Mathématiques', 'Histoire-Géographie', 'Enseignement moral et civique', 'Physique-Chimie', 'SVT', 'Technologie', 'Anglais (LV1)',
  'Espagnol (LV2)', 'Allemand (LV2)', 'Italien (LV2)', 'Arts plastiques', 'Éducation musicale', 'EPS', 'Latin', 'Grec'];
const LYCEE_SPE = ['Mathématiques', 'Physique-Chimie', 'SVT', 'SES', 'HGGSP', 'HLP', 'LLCER', 'NSI', 'Sciences de l’ingénieur', 'Arts', 'Littérature et LCA'];
const TECHNO = ['Histoire-Géographie', 'LVA', 'LVB', 'Mathématiques', 'EMC', 'EPS', 'Management', 'Sciences de gestion et numérique', 'Droit et économie',
  'Innovation technologique', 'Ingénierie et développement durable', 'Physique-Chimie et mathématiques', 'Biologie et physiopathologie humaines'];
const PRO = ['Français', 'Histoire-Géographie', 'Enseignement moral et civique', 'Mathématiques', 'Physique-Chimie', 'Anglais (LV1)', 'Prévention santé environnement',
  'Économie-droit', 'Économie-gestion', 'Arts appliqués et cultures artistiques', 'EPS', 'Enseignement professionnel'];
const CAP = PRO.filter(s => !['Économie-droit', 'Économie-gestion'].includes(s));
export const SUBJECT_CATALOG: Record<string, string[]> = {
  cp: CYCLE2, ce1: CYCLE2, ce2: CYCLE2, cm1: CYCLE3, cm2: CYCLE3, sixieme: CYCLE3,
  cinquieme: COLLEGE, quatrieme: COLLEGE, 'troisieme-generale': COLLEGE,
  'seconde-generale': ['Français', 'Mathématiques', 'Histoire-Géographie', 'LVA', 'LVB', 'SES', 'Physique-Chimie', 'SVT', 'SNT', 'EMC', 'EPS', 'Latin', 'Grec'],
  'premiere-generale': ['Français', 'Histoire-Géographie', 'Enseignement scientifique', 'LVA', 'LVB', 'EMC', 'EPS', ...LYCEE_SPE],
  'terminale-generale': ['Philosophie', 'Histoire-Géographie', 'Enseignement scientifique', 'LVA', 'LVB', 'EMC', 'EPS', ...LYCEE_SPE,
    'Mathématiques complémentaires', 'Mathématiques expertes', 'Droit et grands enjeux du monde contemporain'],
  'premiere-technologique': ['Français', ...TECHNO], 'terminale-technologique': ['Philosophie', ...TECHNO],
  'seconde-pro': PRO, 'premiere-pro': PRO, 'terminale-pro': PRO, 'cap-1': CAP, 'cap-2': CAP,
};
export const subjectsFor = (level: string) => SUBJECT_CATALOG[level] ?? [];
