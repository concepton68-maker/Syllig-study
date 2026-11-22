import { MASTERY } from '@/lib/settings';

const STYLE = [
  'bg-white border border-dashed border-line-strong text-muted',
  'bg-warm-soft text-warm-dark',
  'bg-warm-mid text-warm-dark',
  'bg-line text-ink',
  'bg-brand-mid text-brand-ink',
  'bg-brand text-white',
];
export function MasteryPill({ level }: { level: number }) {
  return <span className={`pill ${STYLE[level]}`}>{MASTERY.labels[level]}</span>;
}
export const masteryStyle = (level: number) => STYLE[level];
