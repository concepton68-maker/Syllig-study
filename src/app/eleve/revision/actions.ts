'use server';
import { requireStudent } from '@/lib/access';
import { answerQuestion } from '@/lib/revisions';

export async function answerReview(sessionId: string, idx: number, answer: string) {
  const { student } = await requireStudent();
  if (typeof sessionId !== 'string' || !Number.isInteger(idx) || typeof answer !== 'string') return null;
  return answerQuestion(student.id, sessionId, idx, answer);
}
