import Link from 'next/link';
import { subjectSummary } from '@/lib/subject-summary';
import { goalView } from '@/lib/goal';
import { pauseRuleSince } from '@/lib/time-rule';
import { Star, Sparkles, Award } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
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
  // le temps se mesure autrement depuis la migration 019 : pas de flèche tant que la période d'avant suit l'ancienne règle
  const ruleAt = await pauseRuleSince();
  const ruleRecent = !!ruleAt && Date.now() - ruleAt.getTime() < 14 * 864e5;
  // « Mes progrès » : toi par rapport à toi (jamais de comparaison avec d'autres élèves)
  const [pr] = await sql<{ this_w: number; last_w: number; levels: number; gain: string | null; gain_title: string | null }[]>`
    select
      (select coalesce(sum(active_seconds), 0)::int from work_sessions where student_id = ${student.id} and started_at > now() - interval '7 days') as this_w,
      (select coalesce(sum(active_seconds), 0)::int from work_sessions where student_id = ${student.id} and started_at between now() - interval '14 days' and now() - interval '7 days') as last_w,
      (select coalesce(sum((data->>'niveau')::int - coalesce((data->>'avant')::int, (data->>'niveau')::int - 1)), 0)::int from activity_log where student_id = ${student.id} and event = 'niveau_atteint' and at > now() - interval '30 days') as levels,
      g.gain, g.title as gain_title
    from (select 1) x left join lateral (
      select max(a.final_score) - (array_agg(a.final_score order by a.attempt_no))[1] as gain, c.title
      from eval_attempts a join courses c on c.id = a.course_id where a.student_id = ${student.id} and a.status = 'graded'
      group by a.course_id, c.title having count(*) > 1 order by 1 desc limit 1) g on true`;
  const m = (s: number) => Math.floor(s / 60);
  // notes par matière et erreurs à reprendre : la dernière copie de chaque cours avec des questions fausses ou vides, puis les exercices
  const sum = await subjectSummary(student.id, student.level_code);
  const errors: { title: string; what: string; href: string }[] = sum.subjects.flatMap(x => x.review.map(r => ({ title: r.title, what: `${r.missed} question${r.missed > 1 ? 's' : ''} fausse${r.missed > 1 ? 's' : ''} ou sans réponse dans l’évaluation`, href: `/eleve/cours/${r.course_id}/bilan/${r.attempt_id}` })));
  // exercices : la série la plus récente de chaque cours (celle qu'ouvre la page Exercices), seulement si elle est remise ;
  // même période et même niveau que les notes (depuis le 1er septembre, niveau actuel)
  const exErr = await sql<{ course_id: number; title: string; wrong: number }[]>`
    select * from (select distinct on (e.course_id) e.course_id, c.title, e.submitted_at,
      (select count(*) from jsonb_each(coalesce(e.auto_results, '{}'::jsonb)) j where j.value = 'false'::jsonb)::int as wrong
      from exercise_submissions e join courses c on c.id = e.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
      where e.student_id = ${student.id} and sj.level_code = ${student.level_code} order by e.course_id, e.created_at desc) x
    where x.submitted_at is not null and x.submitted_at >= ${sum.from}::date`;
  const review = new Set(sum.subjects.flatMap(x => x.review.map(r => r.course_id)));
  for (const x of exErr.filter(x => x.wrong > 0 && !review.has(x.course_id))) errors.push({ title: x.title, what: `${x.wrong} erreur${x.wrong > 1 ? 's' : ''} dans les exercices`, href: `/eleve/cours/${x.course_id}/exercices` });
  const gv = await goalView(student.id, student.settings);
  const [rv] = await sql<{ ok: number; total: number }[]>`select coalesce(sum(ok), 0)::int as ok, coalesce(sum(total), 0)::int as total from review_results
    where student_id = ${student.id} and at >= (date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')`;
  const hmin = (x: number) => x < 60 ? `${x} min` : `${Math.floor(x / 60)} h${x % 60 ? ` ${String(x % 60).padStart(2, '0')}` : ''}`;
  return (
    <PaneScreen top={<PageTitle title="Mes résultats" sub="Tes niveaux montent avec tes progrès. C’est toujours ta meilleure note qui compte." />}>
      <Panes>
        <Pane className="flex-[999_1_560px]">
          <section className="card flex flex-col gap-1" data-my-subjects>
            <h2 className="text-xl font-semibold m-0">Mes notes par matière <span className="muted font-normal text-sm">· depuis le 1er septembre</span></h2>
            <span className="muted text-xs mb-1">Moyenne de toutes tes notes, chaque tentative comptée · 8 dernières notes affichées</span>
            {sum.subjects.every(x => !x.notes.length) && <span className="muted text-sm">Tes notes apparaîtront ici après ta première évaluation.</span>}
            {sum.subjects.filter(x => x.notes.length).map(x => (
              <div key={x.subject} className="grid grid-cols-[1fr_auto] gap-x-3 py-2.5 border-t border-soft text-sm">
                <strong>{x.subject}</strong><strong className="tabular-nums">{x.avg!.toLocaleString('fr-FR')} /20</strong>
                <span className="muted tabular-nums">{x.notes.slice(-8).map(n => n.note.toLocaleString('fr-FR')).join(' · ')}</span><span className="muted text-xs">{x.notes.length} copie{x.notes.length > 1 ? 's' : ''}</span>
              </div>
            ))}
          </section>
          <section className="card flex flex-col gap-2" data-my-errors>
            <h2 className="text-xl font-semibold m-0">Mes erreurs à reprendre</h2>
            <span className="muted text-xs">Ta dernière évaluation et ta dernière série d’exercices de chaque cours, depuis le 1er septembre</span>
            {errors.length === 0 && <span className="muted text-sm">Rien à reprendre pour l’instant.</span>}
            {errors.map(e => (
              <Link key={e.href} href={e.href} className="flex justify-between items-center gap-3 rounded-xl bg-warm-soft px-3 py-2.5 no-underline text-ink">
                <span className="text-sm"><strong>{e.title}</strong><span className="block text-warm-dark">{e.what}</span></span><span className="font-semibold text-brand-dark whitespace-nowrap">Revoir ›</span>
              </Link>
            ))}
          </section>
          <section className="card flex flex-col">
            <h2 className="text-xl font-semibold mb-2">Mes cours</h2>
            {courses.length === 0 && <EmptyState icon={<Sparkles size={20} />} title="Tes niveaux apparaîtront ici" text="Commence ton premier cours : chaque étape réussie fait monter ton niveau." action={<Link className="btn btn-primary" href="/eleve">Commencer</Link>} />}
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
            {attempts.length === 0 && <EmptyState icon={<Award size={20} />} title="Pas encore d’évaluation" text="Après la leçon et les exercices, l’évaluation te donne ta note sur 20. C’est toujours ta meilleure note qui compte." />}
            {attempts.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
                <span className="flex-[1_1_240px]"><strong>{a.title}</strong> · tentative {a.attempt_no}</span>
                <span className="w-28">{a.status === 'graded' ? <strong>{Number(a.final_score).toLocaleString('fr-FR')}/20</strong> : 'En correction'}</span>
                <Link href={`/eleve/cours/${a.course_id}/bilan/${a.id}`} className="font-semibold">Bilan</Link>
              </div>
            ))}
          </section>
        </Pane>
        <Pane className="flex-[1_1_340px]"><section className="card flex flex-col gap-2" data-my-week>
          <h2 className="text-xl font-semibold">Cette semaine</h2>
          <div className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>Temps de travail</span><strong>{hmin(gv.week_min)} / {hmin(gv.week_goal)}</strong></div>
          {gv.mode === 'jour'
            ? <div className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>Jours avec l’objectif atteint<span className="block muted text-xs">jours d’objectif passés, et aujourd’hui s’il est atteint</span></span><strong>{gv.goal_days_met} sur {gv.goal_days_elapsed}</strong></div>
            : <div className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>Jours travaillés (10 min ou plus)<span className="block muted text-xs">jours passés, et aujourd’hui s’il compte déjà</span></span><strong>{gv.worked_days} sur {gv.worked_elapsed}</strong></div>}
          <div className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>Révisions</span><strong>{rv.total ? `${rv.ok} justes sur ${rv.total}` : 'pas encore'}</strong></div>
        </section><section className="card flex flex-col gap-2" data-my-progress>
          <h2 className="text-xl font-semibold">Mes progrès</h2>
          <span className="muted text-sm">Toi par rapport à toi : personne d’autre.</span>
          <div className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>Temps de travail ces 7 derniers jours<span className="block muted">les 7 jours d’avant : {m(pr.last_w)} min</span></span>
            <strong className={pr.this_w >= pr.last_w && pr.this_w > 0 ? 'text-brand-dark' : ''}>{m(pr.this_w)} min{pr.this_w > pr.last_w && pr.last_w > 0 && !ruleRecent ? ' ▲' : ''}</strong></div>
          <div className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>Niveaux gagnés ce mois-ci<span className="block muted">un niveau monte à chaque étape réussie</span></span><strong>{pr.levels}</strong></div>
          {pr.gain && Number(pr.gain) > 0 && <div className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>Ta plus belle remontée<span className="block muted">{pr.gain_title}</span></span><strong className="text-brand-dark">+{Number(pr.gain).toLocaleString('fr-FR')} pts</strong></div>}
        </section>
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Mes points de progrès</h2>
          {points.length === 0 && <EmptyState icon={<Star size={20} />} title="Tes premiers points arrivent vite"
            text={<>+10 par point de contrôle réussi, +50 par leçon terminée, +50 par série d’exercices, +50 à ta première évaluation notée, puis des points chaque fois que tu améliores ta note.</>} />}
          {points.map((p, i) => (
            <div key={i} className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>{p.reason}{p.title ? <span className="block muted">{p.title}</span> : null}</span><strong className="text-brand-dark">+{p.amount}</strong></div>
          ))}
        </section></Pane>
      </Panes>
    </PaneScreen>
  );
}
