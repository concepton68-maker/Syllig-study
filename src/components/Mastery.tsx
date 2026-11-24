import { MASTERY } from '@/lib/settings';

const STYLE = [
  'bg-white border border-dashed border-line-strong text-muted',
  'bg-soft text-ink-2',                    // découverte
  'bg-accent-soft text-brand-dark',        // en construction
  'bg-brand-soft text-brand-dark',         // presque acquis
  'bg-brand-mid text-brand-ink',           // acquis
  'bg-brand text-white',                   // maîtrisé
];
export function MasteryPill({ level, started = false }: { level: number; started?: boolean }) {
  // leçon commencée mais pas encore de niveau : on le dit, plutôt que « Pas encore commencé »
  if (level === 0 && started) return <span className="pill bg-soft text-ink-2">Leçon en cours</span>;
  return <span className={`pill ${STYLE[level]}`}>{MASTERY.labels[level]}</span>;
}
export const masteryStyle = (level: number) => STYLE[level];
