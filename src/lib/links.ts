import type { Step } from './progress';
export function stepHref(courseId: number, s: Step) {
  const base = `/eleve/cours/${courseId}`;
  if (s.kind === 'lesson') return `${base}/lecon`;
  if (s.kind === 'exercises') return `${base}/exercices`;
  if (s.kind === 'evaluation' || s.kind === 'retry' || s.kind === 'waiting') return `${base}/evaluation`;
  return base;
}
