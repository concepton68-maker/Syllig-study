import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireStudent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';
import { PaneScreen, Panes, Pane } from '@/components/Layout';

export const metadata = { title: 'Mes résultats' };
export const dynamic = 'force-dynamic';

export default async function Results() {
  const { student } = await requireStudent();
  const courses = await sql<{ course_id: number; title: string; subject: string; mastery: number; best: string | null; exercises_score: number | null }[]>`
    select p.course_id, c.title, s.name as subject, p.mastery, p.best_eval_score as best, p.exercises_score
    from course_progress p join courses c on c.id = p.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
    where p.student_id = ${student.id} and p.mastery > 0 order by s.position, c.position`;
  const attempts = await sql<{ id: string; course_id: number; title: string; attempt_no: number; status: string; final_score: string | null; submitted_at: Date }[]>`
    select a.id, a.course_id, c.title, a.attempt_no, a.status, a.final_score, a.submitted_at from eval_attempts a join courses c on c.id = a.course_id
    where a.student_id = ${student.id} and a.status in ('submitted','graded') order by a.submitted_at desc`;
  const points = await sql<{ amount: number; reason: string; at: Date; title: string | null }[]>`
    select l.amount, l.reason, l.at, c.title from points_ledger l left join courses c on c.id = l.course_id where l.student_id = ${student.id} order by l.at desc limit 15`;
  return (
    <PaneScreen top={<PageTitle title="Mes résultats" sub="Tes niveaux montent avec tes progrès. C’est toujours ta meilleure note qui compte." />}>
      <Panes>
        <Pane className="flex-[999_1_560px]">
          <section className="card flex flex-col">
            <h2 className="text-xl font-semibold mb-2">Mes cours</h2>
            {courses.length === 0 && <span className="muted text-sm">Commence ton premier cours pour voir tes niveaux ici.</span>}
            {courses.map(c => (
              <div key={c.course_id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
                <Link href={`/eleve/cours/${c.course_id}`} className="flex-[1_1_240px] font-semibold text-ink">{c.title}<span className="block muted font-normal">{c.subject}</span></Link>
                {c.best && <span className="font-semibold w-24">{Number(c.best).toLocaleString('fr-FR')}/20</span>}
                <MasteryPill level={c.mastery} />
              </div>
            ))}
          </section>
          <section className="card flex flex-col">
            <h2 className="text-xl font-semibold mb-2">Mes évaluations</h2>
            {attempts.length === 0 && <span className="muted text-sm">Pas encore d’évaluation.</span>}
            {attempts.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
                <span className="flex-[1_1_240px]"><strong>{a.title}</strong> · tentative {a.attempt_no}</span>
                <span className="w-28">{a.status === 'graded' ? <strong>{Number(a.final_score).toLocaleString('fr-FR')}/20</strong> : 'En correction'}</span>
                <Link href={`/eleve/cours/${a.course_id}/bilan/${a.id}`} className="font-semibold">Bilan</Link>
              </div>
            ))}
          </section>
        </Pane>
        <Pane className="flex-[1_1_340px]"><section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Mes points de progrès</h2>
          {points.map((p, i) => (
            <div key={i} className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>{p.reason}{p.title ? <span className="block muted">{p.title}</span> : null}</span><strong className="text-brand-dark">+{p.amount}</strong></div>
          ))}
        </section></Pane>
      </Panes>
    </PaneScreen>
  );
}
