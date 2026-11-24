import 'server-only';
import { sql } from './db';
import { autoCorrect, type Question } from './course-format';
import { logEvent } from './activity';

export type PlacementItem = Question & { matiere: string; notion: string; niveau_origine: string; explication: string };
export type PlacementTest = { id: string; student_id: string; status: 'propose' | 'en_cours' | 'termine'; duration_min: number; total: number;
  questions: { consigne: string; items: PlacementItem[] }; answers: Record<string, string>; results: { id: string; matiere: string; notion: string; niveau_origine: string; correct: boolean; vide: boolean }[] | null;
  score: number | null; started_at: Date | null; submitted_at: Date | null; created_at: Date };

export const GRACE_S = 60;
export async function placementFor(studentId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [t] = await sql<PlacementTest[]>`select * from placement_tests where id = ${id} and student_id = ${studentId}`;
  return t ?? null;
}
export const deadline = (t: PlacementTest) => t.started_at ? t.started_at.getTime() + t.duration_min * 60_000 : null;

// Correction automatique et clôture (une seule fois)
export async function finishPlacement(t: PlacementTest, latest: Record<string, string>) {
  const answers = { ...t.answers, ...Object.fromEntries(Object.entries(latest).filter(([, v]) => (v ?? '').trim())) };
  const results = t.questions.items.map(q => ({ id: q.id, matiere: q.matiere, notion: q.notion, niveau_origine: q.niveau_origine,
    correct: autoCorrect(q, answers[q.id]) === true, vide: !(answers[q.id] ?? '').trim() }));
  const score = results.filter(r => r.correct).length;
  const done = await sql`update placement_tests set status = 'termine', answers = ${sql.json(answers)}, results = ${sql.json(results)}, score = ${score},
    submitted_at = now() where id = ${t.id} and status = 'en_cours' returning 1`;
  if (done.length) await logEvent(t.student_id, 'positionnement_termine', { data: { score, total: results.length, vides: results.filter(r => r.vide).length } });
}
