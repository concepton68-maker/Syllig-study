import 'server-only';
import { sql } from './db';

// Journal horodaté et chaîné : l'horodatage et l'empreinte sont posés par la base (trigger).
export async function logEvent(studentId: string, event: string, opts: { courseId?: number | null; actorId?: string | null; data?: Record<string, unknown> } = {}) {
  await sql`insert into activity_log (student_id, event, course_id, actor_id, data, prev_hash, hash)
    values (${studentId}, ${event}, ${opts.courseId ?? null}, ${opts.actorId ?? null}, ${sql.json((opts.data ?? {}) as never)}, '', '')`;
}

export async function addPoints(studentId: string, amount: number, reason: string, courseId?: number) {
  if (amount <= 0) return;
  await sql`insert into points_ledger (student_id, amount, reason, course_id) values (${studentId}, ${amount}, ${reason}, ${courseId ?? null})`;
}
