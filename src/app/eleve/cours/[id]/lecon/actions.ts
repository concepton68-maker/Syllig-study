'use server';
import { sql } from '@/lib/db';
import { loadCourse } from '../data';
import { lessonState, type CheckpointPublic } from './state';
import { awardOnce, recomputeMastery } from '@/lib/progress';
import { logEvent } from '@/lib/activity';

export type CheckpointResult = { correct: boolean; message?: string; next?: CheckpointPublic | null; lessonDone?: boolean };

async function finishIfComplete(studentId: string, courseId: number, versionId: string, passedAll: boolean) {
  if (!passedAll) return false;
  const r = await sql`update course_progress set lesson_done_at = now(), updated_at = now()
    where student_id = ${studentId} and course_id = ${courseId} and lesson_done_at is null returning 1`;
  if (r.length) {
    await logEvent(studentId, 'lecon_terminee', { courseId, data: { version: versionId } });
    await awardOnce(studentId, courseId, 'lesson', 50, 'Leçon terminée');
    await recomputeMastery(studentId, courseId);
  }
  return true;
}

export async function answerCheckpoint(courseIdParam: string, partIndex: number, choice: number): Promise<CheckpointResult> {
  const { student, course, version, doc, progress } = await loadCourse(courseIdParam);
  const st = await lessonState(student.id, course.id, version.id, doc, !!progress.lesson_done_at);
  if (partIndex !== st.current) return { correct: false, message: 'Cette question n’est plus d’actualité, la page va se mettre à jour.' };
  const cp = doc.lesson.parts[partIndex].checkpoint!;
  const variant = st.variantIndex(partIndex);
  const v = cp.variants[variant];
  const correct = choice === v.answer;
  await sql`insert into checkpoint_answers (student_id, course_id, version_id, part_index, variant, choice, correct)
    values (${student.id}, ${course.id}, ${version.id}, ${partIndex}, ${variant}, ${choice}, ${correct})`;
  await logEvent(student.id, correct ? 'point_controle_reussi' : 'point_controle_a_reessayer', { courseId: course.id, data: { partie: partIndex + 1, variante: variant + 1 } });
  if (correct) {
    await awardOnce(student.id, course.id, `cp-${partIndex}`, 10, `Point de contrôle réussi (partie ${partIndex + 1})`);
    const after = await lessonState(student.id, course.id, version.id, doc, false);
    const done = await finishIfComplete(student.id, course.id, version.id, after.current === -1);
    return { correct: true, message: v.explanation, lessonDone: done };
  }
  const after = await lessonState(student.id, course.id, version.id, doc, false);
  return { correct: false, message: v.hint ?? 'Relis la partie, puis réessaie avec une nouvelle question.', next: after.checkpoint };
}

export async function completeLessonWithoutCheckpoint(courseIdParam: string) {
  const { student, course, version, doc, progress } = await loadCourse(courseIdParam);
  const st = await lessonState(student.id, course.id, version.id, doc, !!progress.lesson_done_at);
  await finishIfComplete(student.id, course.id, version.id, st.current === -1);
}
