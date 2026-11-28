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
