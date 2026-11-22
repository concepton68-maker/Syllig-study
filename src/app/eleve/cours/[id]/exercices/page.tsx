import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { loadCourse } from '../data';
import { publicQuestion } from '@/lib/course-format';
import { versionById } from '@/lib/progress';
import { SupportTextView } from '@/components/CourseBlocks';
import { ActivityTracker } from '@/components/ActivityTracker';
import { ExercisesPlayer, type Solved } from './Player';
import { restartExercises } from './actions';

export const dynamic = 'force-dynamic';

export default async function ExercisesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, course, version, progress } = await loadCourse(id);
  if (!progress.lesson_done_at) redirect(`/eleve/cours/${course.id}/lecon`);
  let [sub] = await sql<{ id: string; version_id: string; answers: Record<string, string>; auto_results: Record<string, boolean> | null; self_check: Record<string, boolean> | null; submitted_at: Date | null; checked_at: Date | null }[]>`
    select id, version_id, answers, auto_results, self_check, submitted_at, checked_at from exercise_submissions
    where student_id = ${student.id} and course_id = ${course.id} order by created_at desc limit 1`;
  if (!sub) {
    [sub] = await sql`insert into exercise_submissions (student_id, course_id, version_id) values (${student.id}, ${course.id}, ${version.id})
      returning id, version_id, answers, auto_results, self_check, submitted_at, checked_at`;
  }
  // les réponses restent liées à la version sur laquelle elles ont été faites
  const doc = (sub.version_id === version.id ? version : await versionById(sub.version_id))!.document;
  const ex = doc.exercises;
  // corrigés envoyés au navigateur seulement après la remise
  const solved: Record<string, Solved> | null = sub.submitted_at
    ? Object.fromEntries(ex.items.map(q => [q.id, { solution: q.solution, auto: q.id in (sub.auto_results ?? {}) ? sub.auto_results![q.id] : null }]))
    : null;

  return (
    <>
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link className="btn" href={`/eleve/cours/${course.id}`}>‹ Quitter</Link>
          <div><div className="lbl">{course.subject} · {course.chapter}</div><strong className="font-[family-name:var(--font-display)] text-lg">{course.title} · ② Exercices</strong></div>
        </div>
        {!sub.checked_at && <ActivityTracker kind="exercises" courseId={course.id} idleSeconds={student.settings.idle_seconds} />}
      </div>
      <div className="flex flex-col gap-5 max-w-[920px] w-full mx-auto">
        <section className="card flex flex-col gap-2">
          <span className="lbl">S’entraîner en 3 niveaux · environ {ex.duration_min} min</span>
          {ex.instructions && <p className="m-0">{ex.instructions}</p>}
          <p className="m-0 muted text-sm">Ici, pas de note : tu t’entraînes. {ex.pass_threshold}/10 réussis ou plus, et tu es prête pour l’évaluation.</p>
        </section>
        {ex.texts.map(t => <SupportTextView key={t.id} t={t} />)}
        <ExercisesPlayer courseId={id} items={ex.items.map(publicQuestion)} initial={sub.answers} submitted={!!sub.submitted_at}
          solved={solved} checked={!!sub.checked_at} initialSelf={sub.self_check ?? {}} threshold={ex.pass_threshold} />
        {sub.checked_at && (
          <div className="flex flex-wrap gap-3">
            <Link className="btn btn-primary" href={`/eleve/cours/${course.id}/evaluation`}>③ Passer à l’évaluation</Link>
            <form action={restartExercises.bind(null, id)}><button className="btn" type="submit">Refaire les exercices</button></form>
          </div>
        )}
      </div>
    </>
  );
}
