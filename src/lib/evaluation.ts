import 'server-only';
import { sql } from './db';
import { autoCorrect, evalQuestions } from './course-format';
import { versionById, gradeAttemptFinal } from './progress';
import { logEvent } from './activity';

export const GRACE_SECONDS = 30; // marge réseau après l'échéance

export type Attempt = {
  id: string; student_id: string; course_id: number; version_id: string; attempt_no: number; variant: number; status: string;
  started_at: Date | null; deadline_at: Date | null; submitted_at: Date | null; answers: Record<string, string>;
  focus_losses: number; focus_lost_seconds: number; paste_blocked: number; late: boolean;
  auto_scores: Record<string, number> | null; proposal: Record<string, { points: number; comment?: string }> | null;
  scores: Record<string, number> | null; feedback: Record<string, string> | null; final_score: string | null; graded_at: Date | null;
};

export async function getAttempt(id: string) {
  const [a] = await sql<Attempt[]>`select * from eval_attempts where id = ${id}`;
  return a ?? null;
}

// Remise : corrige automatiquement ce qui peut l'être ; si tout est automatique, la note est définitive.
export async function submitAttempt(a: Attempt, opts: { auto?: boolean } = {}) {
  const v = await versionById(a.version_id);
  if (!v) throw new Error('version introuvable');
  const qs = evalQuestions(v.document, a.variant);
  const auto: Record<string, number> = {};
  for (const q of qs) {
    const r = autoCorrect(q, a.answers[q.id]);
    if (r !== null) auto[q.id] = r ? q.points ?? 0 : 0;
  }
  const late = a.deadline_at ? Date.now() > a.deadline_at.getTime() + GRACE_SECONDS * 1000 : false;
  const res = await sql`update eval_attempts set status = 'submitted', submitted_at = now(), auto_scores = ${sql.json(auto)}, late = ${late}
    where id = ${a.id} and status = 'in_progress' returning 1`;
  if (!res.length) return;
  const mins = a.started_at ? Math.round((Date.now() - a.started_at.getTime()) / 6000) / 10 : null;
  await logEvent(a.student_id, opts.auto ? 'evaluation_remise_automatiquement' : 'evaluation_remise', {
    courseId: a.course_id, data: { tentative: a.attempt_no, duree_min: mins, sorties_fenetre: a.focus_losses, sorties_s: a.focus_lost_seconds, coller_bloque: a.paste_blocked },
  });
  if (qs.every(q => q.id in auto)) await gradeAttemptFinal(a.id, auto, {}, a.student_id ? (await studentUser(a.student_id)) : '');
}

async function studentUser(studentId: string) {
  const [s] = await sql<{ user_id: string }[]>`select user_id from students where id = ${studentId}`;
  return s.user_id;
}

// Remise automatique d'une copie dont le temps est écoulé (appelée à chaque consultation)
export async function expireIfNeeded(a: Attempt) {
  if (a.status === 'in_progress' && a.deadline_at && Date.now() > a.deadline_at.getTime() + GRACE_SECONDS * 1000) {
    await submitAttempt(a, { auto: true });
    return (await getAttempt(a.id))!;
  }
  return a;
}
