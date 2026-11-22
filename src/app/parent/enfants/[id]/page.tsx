import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { MasteryPill } from '@/components/Mastery';
import { ResetCourse, ResetStudent } from './ResetForms';

export const metadata = { title: 'Gérer un enfant' };
export const dynamic = 'force-dynamic';

type Row = { course_id: number; title: string; subject: string; mastery: number; best: string | null; attempts: number; minutes: number; last: Date | null };

export default async function ManageChild({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, id);
  // cours où il existe une trace : progression, tentative, exercices ou séance
  const rows = await sql<Row[]>`
    with touched as (
      select course_id from course_progress where student_id = ${s.id}
      union select course_id from eval_attempts where student_id = ${s.id}
      union select course_id from exercise_submissions where student_id = ${s.id}
      union select course_id from work_sessions where student_id = ${s.id} and course_id is not null)
    select c.id as course_id, c.title, sj.name as subject, coalesce(p.mastery, 0) as mastery, p.best_eval_score as best,
      (select count(*)::int from eval_attempts a where a.student_id = ${s.id} and a.course_id = c.id) as attempts,
      (select coalesce(sum(active_seconds), 0)::int / 60 from work_sessions w where w.student_id = ${s.id} and w.course_id = c.id) as minutes,
      (select max(started_at) from work_sessions w where w.student_id = ${s.id} and w.course_id = c.id) as last
    from touched t join courses c on c.id = t.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    left join course_progress p on p.student_id = ${s.id} and p.course_id = c.id
    order by last desc nulls last, c.position`;
  return (
    <Screen top={<PageTitle kicker="Mes enfants" title={`Gérer le parcours de ${s.first_name}`} sub={`${s.level_name} · réinitialiser un cours essayé, ou repartir de zéro.`}>
      <Link className="btn" href="/parent/enfants">‹ Mes enfants</Link>
    </PageTitle>}>
      <section className="card flex flex-col">
        <h2 className="text-xl font-semibold">Cours commencés</h2>
        <p className="muted text-sm mt-1 mb-3">Réinitialiser un cours efface ses tentatives et ses notes : elles ne comptent plus nulle part (moyenne, niveaux, points).</p>
        {rows.length === 0 && <span className="muted text-sm">Aucun cours commencé pour l’instant.</span>}
        {rows.map(r => (
          <div key={r.course_id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
            <span className="flex-[1_1_260px] min-w-0"><strong>{r.title}</strong><span className="block muted">{r.subject}</span></span>
            <MasteryPill level={r.mastery} />
            <span className="w-28">{r.attempts} tentative{r.attempts > 1 ? 's' : ''}{r.best ? ` · ${Number(r.best).toLocaleString('fr-FR')}/20` : ''}</span>
            <span className="w-20 muted">{r.minutes} min</span>
            <ResetCourse studentId={s.id} courseId={r.course_id} title={r.title} />
          </div>
        ))}
      </section>
      <section className="card flex flex-col gap-2 border-warm-mid">
        <h2 className="text-xl font-semibold text-warm-dark">Repartir de zéro</h2>
        <ResetStudent studentId={s.id} firstName={s.first_name} />
      </section>
    </Screen>
  );
}
