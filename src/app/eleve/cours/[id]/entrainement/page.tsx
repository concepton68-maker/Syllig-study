import Link from 'next/link';
import { redirect } from 'next/navigation';
import { todayInfo } from '@/lib/goal';
import { openTraining, sessionView } from '@/lib/revisions';
import { ActivityTracker } from '@/components/ActivityTracker';
import { Screen } from '@/components/Layout';
import { ReviewRunner } from '../../../revision/ReviewRunner';
import { loadCourse } from '../data';

export const metadata = { title: 'M’entraîner' };
export const dynamic = 'force-dynamic';

// « M'entraîner » (maquette validée le 27/11/2026) : 5 questions du cours, corrigées aussitôt, sans effet sur la note
export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, course } = await loadCourse(id);
  const s = await openTraining(student.id, course.id, student.level_code);
  if (!s) redirect(`/eleve/cours/${course.id}`);
  const view = await sessionView(s);
  return (
    <Screen top={<div className="flex items-center justify-between gap-3 flex-wrap"><Link className="btn" href={`/eleve/cours/${course.id}`}>‹ Quitter</Link>
      <ActivityTracker kind="review" courseId={course.id} idleSeconds={student.settings.idle_seconds} {...(await todayInfo(student.id, student.settings))} /></div>}>
      <ReviewRunner sessionId={s.id} questions={view.questions} answered={view.answered} training={{ courseId: course.id, title: course.title }} />
    </Screen>
  );
}
