import 'server-only';
import { sql } from './db';

// Réinitialisations demandées par le parent (essais, erreur, nouveau départ).
// Tout se fait dans une transaction. Le journal d'activité reste en lecture seule :
// on y ajoute un événement qui trace la réinitialisation (sauf effacement explicite du journal).

export type ResetCounts = { tentatives: number; exercices: number; points_controle: number; points: number; seances: number };

async function wipe(tx: typeof sql, studentId: string, courseId: number | null, withSessions: boolean): Promise<ResetCounts> {
  const byCourse = courseId === null ? sql`true` : sql`course_id = ${courseId}`;
  const n = async (q: PromiseLike<{ length: number }>) => (await q).length;
  const counts: ResetCounts = {
    tentatives: await n(tx`delete from eval_attempts where student_id = ${studentId} and ${byCourse} returning 1`),
    exercices: await n(tx`delete from exercise_submissions where student_id = ${studentId} and ${byCourse} returning 1`),
    points_controle: await n(tx`delete from checkpoint_answers where student_id = ${studentId} and ${byCourse} returning 1`),
    points: await n(tx`delete from points_ledger where student_id = ${studentId} and ${byCourse} returning 1`),
    seances: withSessions ? await n(tx`delete from work_sessions where student_id = ${studentId} and ${byCourse} returning 1`) : 0,
  };
  await tx`delete from course_progress where student_id = ${studentId} and ${byCourse}`;
  return counts;
}

export async function resetCourse(studentId: string, courseId: number, actorId: string, opts: { withSessions: boolean }) {
  return sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'reset:' + studentId}))`;
    const counts = await wipe(tx as unknown as typeof sql, studentId, courseId, opts.withSessions);
    await tx`insert into activity_log (student_id, event, course_id, actor_id, data, prev_hash, hash)
      values (${studentId}, 'cours_reinitialise', ${courseId}, ${actorId}, ${tx.json({ ...counts, temps_efface: opts.withSessions })}, '', '')`;
    return counts;
  });
}

export async function resetStudent(studentId: string, actorId: string, opts: { purgeLog: boolean }) {
  return sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'reset:' + studentId}))`;
    const counts = await wipe(tx as unknown as typeof sql, studentId, null, true);
    if (opts.purgeLog) {
      // seule voie d'effacement du journal (même mécanisme que le droit à l'effacement)
      await tx`set local syllig.allow_log_purge = 'on'`;
      await tx`delete from activity_log where student_id = ${studentId}`;
    }
    await tx`insert into activity_log (student_id, event, actor_id, data, prev_hash, hash)
      values (${studentId}, 'parcours_reinitialise', ${actorId}, ${tx.json({ ...counts, journal_efface: opts.purgeLog })}, '', '')`;
    return counts;
  });
}
