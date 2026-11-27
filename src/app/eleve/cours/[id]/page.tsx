import Link from 'next/link';
import { sql } from '@/lib/db';
import { loadCourse } from './data';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';
import { Screen } from '@/components/Layout';
import { RichText } from '@/components/RichText';

export const dynamic = 'force-dynamic';

export default async function CourseOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, course, doc, progress } = await loadCourse(id);
  const attempts = await sql<{ id: string; attempt_no: number; status: string; final_score: string | null; submitted_at: Date | null }[]>`
    select id, attempt_no, status, final_score, submitted_at from eval_attempts where student_id = ${student.id} and course_id = ${course.id} order by attempt_no desc`;
  const [{ started }] = await sql<{ started: boolean }[]>`select exists (select 1 from checkpoint_answers where student_id = ${student.id} and course_id = ${course.id}) as started`;
  const base = `/eleve/cours/${course.id}`;
  const steps = [
    { n: '①', name: 'Leçon', href: progress.lesson_done_at ? `${base}/lecon?debut=1` : `${base}/lecon`, done: !!progress.lesson_done_at, meta: `${doc.lesson.duration_min} min · ${doc.lesson.parts.length} parties`, open: true },
    { n: '②', name: 'Exercices', href: `${base}/exercices`, done: !!progress.exercises_done_at, meta: `${doc.exercises.duration_min} min · ${doc.exercises.items.length} exercices${progress.exercises_score !== null ? ` · ${progress.exercises_score}/10` : ''}`, open: !!progress.lesson_done_at },
    { n: '③', name: 'Évaluation', href: `${base}/evaluation`, done: attempts.some(a => a.status === 'graded'), meta: `${doc.evaluation.duration_min} min chronométrées · sur ${doc.evaluation.total_points}`, open: !!progress.exercises_done_at },
  ];
  // action principale : la première étape ouverte et non terminée
  const nextOpen = steps.find(x => x.open && !x.done);
  const main = nextOpen ?? steps[0];
  return (
    <Screen top={<PageTitle kicker={`${course.subject} · ${course.chapter}${course.code ? ` · ${course.code}` : ''}`} title={course.title}
        sub={<span className="inline-flex items-center gap-2 mt-1"><MasteryPill level={progress.mastery} started={started} /></span>}>
        <Link className="btn" href="/eleve/parcours">‹ Mes cours</Link>
      </PageTitle>}>
      <section className="card flex flex-col gap-4">
        {doc.lesson.objectives.length > 0 && (<div><span className="lbl">À la fin de ce cours, je sais</span>
          <ul className="mt-2 mb-0 pl-5 list-disc">{doc.lesson.objectives.map((o, i) => <li key={i}><RichText text={o} /></li>)}</ul></div>)}
        <div className="flex flex-wrap items-center gap-3">
          <Link className="btn btn-primary min-h-[52px] px-7 text-base w-full sm:w-auto" href={main.href}>
            {nextOpen ? `${main.done ? 'Continuer' : progress.lesson_done_at || started ? 'Continuer' : 'Commencer'} : ${main.n} ${main.name}` : 'Revoir la leçon'}
          </Link>
          {!nextOpen && <span className="muted text-sm">Toutes les étapes sont faites : tu peux revoir la leçon ou retenter l’évaluation.</span>}
        </div>
        <ol className="list-none m-0 p-0 flex flex-wrap gap-3">
          {steps.map(s => (
            <li key={s.n} className="flex-[1_1_220px]">
              {s.open ? (
                <Link href={s.href} className={`block no-underline p-4 rounded-xl border ${s.done ? 'bg-brand-soft border-brand-mid text-brand-ink' : 'bg-white border-line text-ink'} hover:border-brand`}>
                  <div className="font-bold">{s.n} · {s.name}{s.done ? ' ✓' : ''}</div><div className="text-sm mt-1">{s.meta}</div>
                </Link>
              ) : (
                <div className="p-4 rounded-xl bg-soft text-muted"><div className="font-bold">{s.n} · {s.name}</div><div className="text-sm mt-1">{s.meta.split(' · ')[0]} · s’ouvre après l’étape précédente</div></div>
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
    </Screen>
  );
}
