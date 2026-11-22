import 'server-only';
import { sql } from '@/lib/db';
import type { CourseDocument } from '@/lib/course-format';

export type CheckpointPublic = { prompt: string; quote?: string; options: string[]; attempt: number };

// État de la leçon pour un élève : parties validées et variante en cours (calculée côté serveur)
export async function lessonState(studentId: string, courseId: number, versionId: string, doc: CourseDocument, lessonDone: boolean) {
  const rows = await sql<{ part_index: number; n: number; ok: boolean }[]>`
    select part_index, count(*)::int as n, bool_or(correct) as ok from checkpoint_answers
    where student_id = ${studentId} and course_id = ${courseId} and version_id = ${versionId} group by part_index`;
  const by = new Map(rows.map(r => [r.part_index, r]));
  const passed = doc.lesson.parts.map((p, i) => lessonDone || !p.checkpoint || !!by.get(i)?.ok);
  const current = passed.findIndex(x => !x);
  let checkpoint: CheckpointPublic | null = null;
  if (current >= 0) {
    const cp = doc.lesson.parts[current].checkpoint!;
    const n = by.get(current)?.n ?? 0;
    const v = cp.variants[n % cp.variants.length];
    checkpoint = { prompt: v.prompt, quote: v.quote, options: v.options, attempt: n };
  }
  return { passed, current, checkpoint, variantIndex: (i: number) => (by.get(i)?.n ?? 0) % (doc.lesson.parts[i].checkpoint?.variants.length ?? 1) };
}
