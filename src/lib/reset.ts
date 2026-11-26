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
  // révisions espacées : résultats, réponses, calendrier ; séances en cours (elles peuvent mêler plusieurs cours)
  await tx`delete from review_results where student_id = ${studentId} and ${byCourse}`;
  await tx`delete from review_items where student_id = ${studentId} and ${byCourse}`;
  await tx`delete from review_schedule where student_id = ${studentId} and ${byCourse}`;
  await tx`delete from review_sessions s where s.student_id = ${studentId} and (${courseId === null} or s.finished_at is null or not exists (select 1 from review_items i where i.session_id = s.id))`;
  return counts;
}

export class ResetRefused extends Error {}

export async function resetCourse(studentId: string, courseId: number, actorId: string, opts: { withSessions: boolean }) {
  return sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'student:' + studentId}))`;
    const [running] = await tx`select 1 from eval_attempts where student_id = ${studentId} and course_id = ${courseId} and status = 'in_progress'`;
    if (running) throw new ResetRefused('Une évaluation de ce cours est en train d’être passée : attendez la fin avant de réinitialiser.');
    // ce qui va être effacé, gardé dans la trace du journal
    const [avant] = await tx`select coalesce(p.mastery, 0) as niveau, p.best_eval_score as meilleure_note,
        (select coalesce(sum(amount), 0)::int from points_ledger where student_id = ${studentId} and course_id = ${courseId}) as points_retires,
        (select coalesce(json_agg(json_build_object('tentative', attempt_no, 'note', final_score, 'statut', status) order by attempt_no), '[]'::json)
           from eval_attempts where student_id = ${studentId} and course_id = ${courseId}) as tentatives
      from (select 1) x left join course_progress p on p.student_id = ${studentId} and p.course_id = ${courseId}`;
    const counts = await wipe(tx as unknown as typeof sql, studentId, courseId, opts.withSessions);
    await tx`insert into activity_log (student_id, event, course_id, actor_id, data, prev_hash, hash)
      values (${studentId}, 'cours_reinitialise', ${courseId}, ${actorId}, ${tx.json({ ...counts, temps_efface: opts.withSessions, avant })}, '', '')`;
    return counts;
  });
}

export async function resetStudent(studentId: string, actorId: string, opts: { purgeLog: boolean }) {
  return sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'student:' + studentId}))`;
    const [running] = await tx`select 1 from eval_attempts where student_id = ${studentId} and status = 'in_progress'`;
    if (running) throw new ResetRefused('Une évaluation est en train d’être passée : attendez la fin avant de tout réinitialiser.');
    const counts = await wipe(tx as unknown as typeof sql, studentId, null, true);
    // nouveau départ : les bilans et tests de positionnement de l'ancien parcours n'ont plus de sens
    await tx`delete from placement_tests where student_id = ${studentId}`;
    await tx`delete from student_reports where student_id = ${studentId}`;
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
