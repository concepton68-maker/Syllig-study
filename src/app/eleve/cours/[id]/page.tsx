import Link from 'next/link';
import { sql } from '@/lib/db';
import { loadCourse } from './data';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';
import { Screen } from '@/components/Layout';
import { RichText } from '@/components/RichText';
import { evalAvailability } from '@/lib/evaluation';
import { questionPool, revisionDueFor } from '@/lib/revisions';

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
  // cours déjà fait (maquette validée le 27/11/2026) : s'entraîner d'abord (effet de test), relire, repasser le test (autre sujet)
  const canTrain = !!progress.exercises_done_at && questionPool(doc).length > 0;
  const revDue = canTrain && await revisionDueFor(student.id, course.id);
  const av = !nextOpen ? await evalAvailability(student.id, course.id, !!progress.exercises_done_at, student.settings.retry_delay_days) : null;
  const twoSubjects = doc.evaluation.variants.length > 1;
  const best = attempts.filter(a => a.status === 'graded').reduce((m, a) => Math.max(m, Number(a.final_score)), -1);
  return (
    <Screen top={<PageTitle kicker={`${course.subject} · ${course.chapter}${course.code ? ` · ${course.code}` : ''}`} title={course.title}
        sub={<span className="inline-flex items-center gap-2 mt-1"><MasteryPill level={progress.mastery} started={started} /></span>}>
        <Link className="btn" href="/eleve/parcours">‹ Mes cours</Link>
      </PageTitle>}>
      <section className="card flex flex-col gap-4">
        {doc.lesson.objectives.length > 0 && (<div><span className="lbl">À la fin de ce cours, je sais</span>
          <ul className="mt-2 mb-0 pl-5 list-disc">{doc.lesson.objectives.map((o, i) => <li key={i}><RichText text={o} /></li>)}</ul></div>)}
        {nextOpen ? (
          <div className="flex flex-wrap items-center gap-3">
            <Link className="btn btn-primary min-h-[52px] px-7 text-base w-full sm:w-auto" href={main.href}>
              {`${main.done ? 'Continuer' : progress.lesson_done_at || started ? 'Continuer' : 'Commencer'} : ${main.n} ${main.name}`}
            </Link>
            {canTrain && !revDue && <Link className="btn min-h-[52px]" href={`${base}/entrainement`} data-train>M’entraîner</Link>}
          </div>
        ) : (
          <div className="flex flex-col gap-3" data-redo>
            {best >= 0 && <span className="pill bg-brand-soft text-brand-dark self-start">Ta meilleure note : {best.toLocaleString('fr-FR')}/20</span>}
            <div className="grid gap-3 sm:grid-cols-3">
              {canTrain && (revDue
                ? <Link href="/eleve/revision" className="flex flex-col gap-1 p-4 rounded-2xl bg-brand text-white no-underline" data-train-revision>
                  <strong className="text-lg">Ta révision du jour</strong><span className="text-sm opacity-90">Ce cours est à réviser aujourd’hui : l’entraînement sera possible après.</span></Link>
                : <Link href={`${base}/entrainement`} className="flex flex-col gap-1 p-4 rounded-2xl bg-brand text-white no-underline" data-train>
                  <strong className="text-lg">M’entraîner</strong><span className="text-sm opacity-90">5 questions du cours, d’abord celles que tu n’as jamais vues en révision ou que tu as vues il y a le plus longtemps</span></Link>)}
              <Link href={`${base}/lecon?debut=1`} className="flex flex-col gap-1 p-4 rounded-2xl bg-white border border-line text-ink no-underline hover:border-brand" data-reread>
                <strong className="text-lg">Relire la leçon</strong><span className="text-sm muted">Depuis le début, puis la fiche mémo</span></Link>
              {av?.ok ? <Link href={`${base}/evaluation`} className="flex flex-col gap-1 p-4 rounded-2xl bg-white border border-line text-ink no-underline hover:border-brand" data-retake>
                <strong className="text-lg">Repasser le test</strong><span className="text-sm muted">{twoSubjects ? 'Un autre sujet que la dernière fois. ' : ''}Ta meilleure note reste.</span></Link>
                : <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white border border-line" data-retake="plus-tard">
                  <strong className="text-lg">Repasser le test</strong><span className="text-sm muted">{twoSubjects ? 'Un autre sujet que la dernière fois. ' : ''}Ta meilleure note reste.</span>
                  <span className="text-sm">{av && 'readyAt' in av && av.readyAt ? `Possible à partir du ${av.readyAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' })} à ${av.readyAt.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}` : av && 'pending' in av && av.pending ? ({ requested: 'Demande envoyée à ton parent', approved: 'Autorisée : tu peux la commencer', in_progress: 'Une évaluation est en cours', submitted: 'Ta dernière copie est en correction' } as Record<string, string>)[av.pending.status] ?? '' : ''}</span></div>}
            </div>
            {canTrain && <span className="text-sm muted">Se tester fait mieux retenir que relire.</span>}
          </div>
        )}
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
