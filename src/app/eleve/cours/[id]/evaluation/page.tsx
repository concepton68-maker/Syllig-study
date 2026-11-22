import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { loadCourse } from '../data';
import { publicQuestion } from '@/lib/course-format';
import { versionById } from '@/lib/progress';
import { getAttempt, expireIfNeeded } from '@/lib/evaluation';
import { ActivityTracker } from '@/components/ActivityTracker';
import { Screen, PaneScreen } from '@/components/Layout';
import { EvalRunner } from './Runner';
import { startEvaluation } from './actions';
import { evalAvailability } from '@/lib/evaluation';

export const dynamic = 'force-dynamic';

export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, course, doc, progress } = await loadCourse(id);
  if (!progress.lesson_done_at) redirect(`/eleve/cours/${course.id}/lecon`);
  const [cur] = await sql<{ id: string }[]>`select id from eval_attempts where student_id = ${student.id} and course_id = ${course.id}
    and status in ('requested','approved','in_progress','submitted') order by attempt_no desc limit 1`;
  let attempt = cur ? await getAttempt(cur.id) : null;
  if (attempt) attempt = await expireIfNeeded(attempt);
  if (attempt?.status === 'submitted') redirect(`/eleve/cours/${course.id}/bilan/${attempt.id}`);

  const header = (
    <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        {attempt?.status !== 'in_progress' && <Link className="btn" href={`/eleve/cours/${course.id}`}>‹ Quitter</Link>}
        <div><div className="lbl">{course.subject} · {course.chapter}</div><strong className="font-[family-name:var(--font-display)] text-lg">{course.title} · ③ Évaluation{attempt ? ` · tentative ${attempt.attempt_no}` : ''}</strong></div>
      </div>
      {attempt?.status === 'in_progress' && <ActivityTracker kind="evaluation" courseId={course.id} idleSeconds={student.settings.idle_seconds} />}
    </div>
  );

  if (attempt?.status === 'in_progress') {
    const v = (await versionById(attempt.version_id))!.document.evaluation;
    const variant = v.variants[attempt.variant % v.variants.length];
    return (
      <PaneScreen top={header}>
          <EvalRunner courseId={id} attemptId={attempt.id} remaining={Math.max(0, Math.round((attempt.deadline_at!.getTime() - Date.now()) / 1000))}
            sections={variant.sections.map(s => ({ label: s.label, questions: s.questions.map(publicQuestion) }))} texts={variant.texts}
            initial={attempt.answers} total={v.total_points} />
      </PaneScreen>
    );
  }

  const av = await evalAvailability(student.id, course.id, !!progress.exercises_done_at, student.settings.retry_delay_days);
  const [{ graded }] = await sql<{ graded: number }[]>`select count(*)::int as graded from eval_attempts where student_id = ${student.id} and course_id = ${course.id} and status = 'graded'`;
  return (
    <Screen top={header}>
      <section className="card p-7 max-w-[760px] w-full mx-auto flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{graded ? 'Nouvelle tentative' : 'Prête pour l’évaluation ?'}</h1>
        {doc.evaluation.conditions && <p className="m-0">{doc.evaluation.conditions}</p>}
        <ul className="m-0 pl-5 list-disc flex flex-col gap-1.5 text-[15px]">
          <li><strong>{doc.evaluation.duration_min} minutes</strong>, chrono tenu par le serveur. À la fin du temps, ta copie est remise automatiquement.</li>
          <li>Sans la leçon ni les corrigés. Le collage de texte est désactivé.</li>
          <li>Les sorties de la fenêtre sont enregistrées et visibles par tes parents. Astuce : active « Ne pas déranger » avant de commencer.</li>
          <li>{graded ? 'C’est ta meilleure note qui compte.' : 'Tu pourras retenter plus tard : c’est ta meilleure note qui compte.'}</li>
        </ul>
        {av.ok || (('pending' in av) && av.pending?.status === 'approved') ? (
          <form action={startEvaluation.bind(null, id)}><button className="btn btn-primary min-h-[52px] px-7" type="submit">{student.settings.eval_requires_approval && !('pending' in av) ? 'Demander à passer l’évaluation' : `Commencer · ${doc.evaluation.duration_min} min`}</button></form>
        ) : 'pending' in av && av.pending?.status === 'requested' ? (
          <p className="m-0 rounded-xl bg-soft px-4 py-3">Ta demande est envoyée à ton parent. L’évaluation s’ouvrira dès son accord.</p>
        ) : 'readyAt' in av && av.readyAt ? (
          <p className="m-0 rounded-xl bg-soft px-4 py-3">Nouvelle tentative possible à partir du {av.readyAt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} : laisser passer quelques jours permet de vérifier que c’est bien retenu.</p>
        ) : (
          <p className="m-0 rounded-xl bg-soft px-4 py-3">{'reason' in av ? av.reason : ''} <Link href={`/eleve/cours/${course.id}/exercices`}>Aller aux exercices</Link></p>
        )}
      </section>
    </Screen>
  );
}
