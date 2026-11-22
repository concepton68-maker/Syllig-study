import 'server-only';
import { sql } from './db';
import { evalQuestions, type CourseDocument, type Question } from './course-format';
import type { Attempt } from './evaluation';

export type QuestionResult = { q: Question; answer: string; points: number | null; max: number; comment?: string; auto: boolean };

// Données d'un bilan : résultats par question, comparaison avec la tentative précédente, compétences
export async function bilanData(a: Attempt, doc: CourseDocument) {
  const qs = evalQuestions(doc, a.variant);
  const final = a.status === 'graded';
  const results: QuestionResult[] = qs.map(q => {
    const auto = !!a.auto_scores && q.id in a.auto_scores;
    const points = final ? a.scores?.[q.id] ?? 0 : auto ? a.auto_scores![q.id] : null;
    return { q, answer: a.answers[q.id] ?? '', points, max: q.points ?? 0, comment: a.feedback?.[q.id], auto };
  });
  const [prev] = await sql<{ best: string | null; first: string | null }[]>`
    select max(final_score) as best, (array_agg(final_score order by attempt_no))[1] as first from eval_attempts
    where student_id = ${a.student_id} and course_id = ${a.course_id} and status = 'graded' and attempt_no < ${a.attempt_no}`;
  const skills = new Map(doc.skills.map(s => [s.id, s.label]));
  const bySkill = new Map<string, { got: number; max: number }>();
  for (const r of results) if (r.points !== null) for (const s of r.q.skills ?? []) {
    const x = bySkill.get(s) ?? { got: 0, max: 0 };
    x.got += r.points; x.max += r.max; bySkill.set(s, x);
  }
  const skillRows = [...bySkill].map(([id, v]) => ({ id, label: skills.get(id) ?? id, ratio: v.max ? v.got / v.max : 0 }));
  return {
    results, final,
    total: final ? Number(a.final_score) : null,
    provisional: results.filter(r => r.auto).reduce((s, r) => s + (r.points ?? 0), 0),
    provisionalMax: results.filter(r => r.auto).reduce((s, r) => s + r.max, 0),
    previousBest: prev?.best === null || prev?.best === undefined ? null : Number(prev.best),
    first: prev?.first === null || prev?.first === undefined ? null : Number(prev.first),
    wins: skillRows.filter(s => s.ratio >= 0.75).sort((x, y) => y.ratio - x.ratio),
    nextStep: skillRows.filter(s => s.ratio < 0.75).sort((x, y) => x.ratio - y.ratio)[0] ?? null,
    weakest: results.filter(r => r.points !== null && r.points < r.max).sort((x, y) => x.points! / x.max - y.points! / y.max)[0] ?? null,
  };
}
