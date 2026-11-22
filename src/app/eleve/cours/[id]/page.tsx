import Link from 'next/link';
import { sql } from '@/lib/db';
import { loadCourse } from './data';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';

export const dynamic = 'force-dynamic';

export default async function CourseOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, course, doc, progress } = await loadCourse(id);
  const attempts = await sql<{ id: string; attempt_no: number; status: string; final_score: string | null; submitted_at: Date | null }[]>`
    select id, attempt_no, status, final_score, submitted_at from eval_attempts where student_id = ${student.id} and course_id = ${course.id} order by attempt_no desc`;
  const base = `/eleve/cours/${course.id}`;
  const steps = [
    { n: '①', name: 'Leçon', href: `${base}/lecon`, done: !!progress.lesson_done_at, meta: `${doc.lesson.duration_min} min · ${doc.lesson.parts.length} parties`, open: true },
    { n: '②', name: 'Exercices', href: `${base}/exercices`, done: !!progress.exercises_done_at, meta: `${doc.exercises.duration_min} min · ${doc.exercises.items.length} exercices${progress.exercises_score !== null ? ` · ${progress.exercises_score}/10` : ''}`, open: !!progress.lesson_done_at },
    { n: '③', name: 'Évaluation', href: `${base}/evaluation`, done: attempts.some(a => a.status === 'graded'), meta: `${doc.evaluation.duration_min} min chrono · sur ${doc.evaluation.total_points}`, open: !!progress.exercises_done_at },
  ];
  return (
    <>
      <PageTitle kicker={`${course.subject} · ${course.chapter}${course.code ? ` · ${course.code}` : ''}`} title={course.title}>
        <MasteryPill level={progress.mastery} />
      </PageTitle>
      <section className="card flex flex-col gap-4">
        {doc.lesson.objectives.length > 0 && (<div><span className="lbl">À la fin de ce cours, je sais</span>
          <ul className="mt-2 mb-0 pl-5 list-disc">{doc.lesson.objectives.map((o, i) => <li key={i}>{o.replace(/ ;$|\.$/, '')}</li>)}</ul></div>)}
        <ol className="list-none m-0 p-0 flex flex-wrap gap-3">
          {steps.map(s => (
            <li key={s.n} className="flex-[1_1_220px]">
              {s.open ? (
                <Link href={s.href} className={`block no-underline p-4 rounded-xl border ${s.done ? 'bg-brand-soft border-brand-mid text-[#1E2A78]' : 'bg-white border-line text-ink'} hover:border-brand`}>
                  <div className="font-bold">{s.n} · {s.name}{s.done ? ' ✓' : ''}</div><div className="text-sm mt-1">{s.meta}</div>
                </Link>
              ) : (
                <div className="p-4 rounded-xl bg-soft text-muted"><div className="font-bold">{s.n} · {s.name}</div><div className="text-sm mt-1">S’ouvre après l’étape précédente</div></div>
              )}
            </li>
          ))}
        </ol>
      </section>
      {attempts.length > 0 && (
        <section className="card flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Mes tentatives d’évaluation</h2>
          {attempts.map(a => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-soft text-sm">
              <span className="w-28 font-semibold">Tentative {a.attempt_no}</span>
              <span className="flex-1">{a.status === 'graded' ? `${Number(a.final_score).toLocaleString('fr-FR')}/20` : a.status === 'submitted' ? 'En correction' : a.status === 'in_progress' ? 'En cours' : 'En attente d’accord'}</span>
              {(a.status === 'graded' || a.status === 'submitted') && <Link href={`${base}/bilan/${a.id}`} className="font-semibold">Voir le bilan</Link>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
