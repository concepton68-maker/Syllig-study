import Link from 'next/link';
import { requireStudent } from '@/lib/access';
import { parcours, nextStep, pickNext } from '@/lib/progress';
import { weekStats, streak, hm } from '@/lib/stats';
import { stepHref } from '@/lib/links';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';
import { PaneScreen, Panes, Pane } from '@/components/Layout';
import { EmptyState, PriorityPill } from '@/components/EmptyState';

export const metadata = { title: 'Aujourd’hui' };
export const dynamic = 'force-dynamic';

export default async function Today() {
  const { student } = await requireStudent();
  const items = await parcours(student.id, student.level_code);
  const goal = student.settings.weekly_goal_minutes * 60;
  const [w, s] = await Promise.all([weekStats(student.id), streak(student.id)]);
  const next = pickNext(items, student.settings.retry_delay_days);
  const step = next ? nextStep(next, student.settings.retry_delay_days) : null;
  // « Ensuite » : uniquement des cours disponibles où il reste quelque chose à faire
  const upcoming = items.filter(c => c !== next && c.published && !['done', 'soon'].includes(nextStep(c, student.settings.retry_delay_days).kind)).slice(0, 5);
  const soonCount = items.filter(c => !c.published).length;
  const acquired = items.filter(c => c.mastery >= 4);
  const reviews = items.filter(c => c.next_review_at && new Date(c.next_review_at).getTime() < Date.now() + 7 * 864e5)
    .sort((a, b) => new Date(a.next_review_at!).getTime() - new Date(b.next_review_at!).getTime());
  const waiting = items.filter(c => c.pending_attempt === 'submitted');
  const [lastGraded] = await sql<{ id: string; course_id: number; title: string; final_score: string }[]>`
    select a.id, a.course_id, c.title, a.final_score from eval_attempts a join courses c on c.id = a.course_id
    where a.student_id = ${student.id} and a.status = 'graded' and a.graded_at > now() - interval '3 days' order by a.graded_at desc limit 1`;
  const pct = Math.min(100, Math.round((w.active / goal) * 100));
  const C = 2 * Math.PI * 17;

  return (
    <PaneScreen top={
      <div className="flex flex-wrap justify-between items-center gap-x-6 gap-y-4">
        <PageTitle spark title={`Salut ${student.first_name}${step?.minutes ? `, prête pour ${step.minutes} minutes ?` : ' !'}`}
          sub="Ton parcours est calculé pour toi : les priorités d’abord, puis les révisions." />
        <div className="grid grid-cols-3 gap-3 w-full sm:w-auto">
          <div className="card !p-3 flex items-center gap-3">
            <svg width="42" height="42" viewBox="0 0 42 42" role="img" aria-label={`Objectif de la semaine : ${pct} %`} className="shrink-0">
              <circle cx="21" cy="21" r="17" fill="none" style={{ stroke: 'var(--color-track)' }} strokeWidth="6" />
              <circle cx="21" cy="21" r="17" fill="none" style={{ stroke: 'var(--color-brand)' }} strokeWidth="6" strokeDasharray={`${(C * pct) / 100} ${C}`} strokeLinecap="round" transform="rotate(-90 21 21)" />
            </svg>
            <div><strong className="num text-base">{hm(w.active)}</strong><div className="muted text-xs">sur {hm(goal)} cette semaine</div></div>
          </div>
          <div className="card !p-3"><strong className="num text-base">{s} jour{s > 1 ? 's' : ''}</strong><div className="muted text-xs">de suite</div></div>
          <div className="card !p-3"><strong className="num text-base text-brand-dark">+{w.week_points}</strong><div className="muted text-xs">points cette semaine</div></div>
        </div>
      </div>
    }>
      <Panes>
        <Pane className="flex-[999_1_600px]">
          {next && step ? (
            <section className="card p-7 flex flex-col gap-5 border-2 border-brand">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="lbl text-brand-dark">Ta prochaine étape</span>
                  <h2 className="text-[26px] font-bold">{next.title}</h2>
                  <span className="muted">{next.subject} · {next.chapter}{next.code ? ` · ${next.code}` : ''}</span>
                </div>
                <div className="flex gap-2 items-start">{next.priority === 'prioritaire' && <PriorityPill />}<MasteryPill level={next.mastery} /></div>
              </div>
              <ol className="list-none m-0 p-0 flex flex-wrap gap-2.5" aria-label="Étapes du cours">
                {[
                  { n: '①', name: 'Leçon', done: next.lesson_done, cur: step.kind === 'lesson', meta: `${next.durations?.lesson} min · points de contrôle` },
                  { n: '②', name: 'Exercices', done: next.exercises_done, cur: step.kind === 'exercises', meta: `${next.durations?.exercises} min · ★ ★★ ★★★` },
                  { n: '③', name: 'Évaluation', done: next.graded_count > 0, cur: step.kind === 'evaluation' || step.kind === 'retry', meta: `${next.durations?.evaluation} min chrono · sur 20` },
                  { n: '④', name: 'Corrigés', done: next.graded_count > 0, cur: false, meta: 'S’ouvrent après ta réponse' },
                ].map(x => (
                  <li key={x.n} className={`flex-[1_1_170px] p-3.5 rounded-xl ${x.cur ? 'bg-brand text-white' : x.done ? 'bg-brand-soft text-brand-ink' : 'bg-soft text-muted'}`}>
                    <div className="text-sm font-bold">{x.n} · {x.name}{x.done && !x.cur ? ' ✓' : ''}</div>
                    <div className="text-sm mt-1">{x.meta}</div>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-4">
                <Link className="btn btn-primary min-h-[52px] px-7 text-base" href={stepHref(next.course_id, step)}>
                  {step.kind === 'lesson' && !next.lesson_done ? 'Commencer' : 'Continuer'} : {step.label}{step.minutes ? ` · ${step.minutes} min` : ''}
                </Link>
                <span className="muted text-sm max-w-[460px]">Le chrono ne compte que le temps où tu travailles vraiment. Les corrigés s’ouvrent après ta réponse.</span>
              </div>
            </section>
          ) : (
            <section className="card p-7">
              <EmptyState title={acquired.length ? 'Tout est fait pour l’instant, bravo !' : 'Ton premier cours arrive bientôt'}
                text={acquired.length ? `Tu as acquis ${acquired.length} cours. De nouveaux cours arrivent ; en attendant, revois tes résultats ou tes révisions.` : 'Dès qu’un cours est publié, il apparaît ici.'}
                action={<Link className="btn" href="/eleve/resultats">Voir mes résultats</Link>} />
            </section>
          )}

          <section className="card flex flex-col gap-1">
            <div className="flex justify-between items-center mb-2"><h2 className="text-xl font-semibold">Ensuite dans ton parcours</h2><Link href="/eleve/parcours" className="text-sm font-semibold">Tous mes cours</Link></div>
            {upcoming.length === 0 && <span className="muted text-sm py-2">{soonCount ? `Les ${soonCount} autres cours du programme arrivent au fur et à mesure.` : 'Rien d’autre pour l’instant.'}</span>}
            {upcoming.map((c, i) => {
              const st = nextStep(c, student.settings.retry_delay_days);
              return (
                <Link key={c.course_id} href={stepHref(c.course_id, st)} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft no-underline text-ink hover:bg-surface-2 rounded-lg px-1">
                  <span className="num w-7 h-7 rounded-lg bg-soft inline-flex items-center justify-center text-sm font-bold">{i + 1}</span>
                  <div className="flex-[1_1_240px] min-w-0"><strong className="text-sm">{c.title}</strong><div className="muted text-sm">{c.subject} · {c.chapter}</div></div>
                  <span className="muted text-sm w-[170px]">{st.label}</span>
                  {c.priority === 'prioritaire' && <PriorityPill />}
                </Link>
              );
            })}
          </section>
        </Pane>

        <Pane className="flex-[1_1_340px]">
          {lastGraded && (
            <Link href={`/eleve/cours/${lastGraded.course_id}/bilan/${lastGraded.id}`} className="card no-underline text-ink bg-brand-soft border-brand-mid flex flex-col gap-2">
              <span className="lbl">Ton bilan est prêt</span>
              <strong>{lastGraded.title}</strong>
              <span className="flex items-center justify-between gap-2"><span className="muted text-sm">Ce que tu sais faire maintenant</span><span className="pill bg-brand text-white num">{Number(lastGraded.final_score).toLocaleString('fr-FR')}/20</span></span>
            </Link>
          )}
          <section className="card flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Révisions</h2>
            {reviews.length === 0 && <EmptyState title="Aucune révision cette semaine" text="Après chaque évaluation, une révision courte est programmée (J+3 à J+30 selon ta note)." />}
            {reviews.map(r => {
              const due = new Date(r.next_review_at!);
              const late = due.getTime() < Date.now();
              return (
                <div key={r.course_id} className={`p-3 rounded-xl ${late ? 'bg-warm-soft' : 'bg-soft'}`}>
                  <strong className="text-sm">{r.title}</strong>
                  <div className={`text-sm ${late ? 'text-warm-dark' : 'muted'}`}>{r.subject} · {late ? 'à faire dès que possible' : `prévue le ${due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}`}</div>
                </div>
              );
            })}
          </section>
          {waiting.length > 0 && (
            <section className="card flex flex-col gap-2">
              <h2 className="text-lg font-semibold">En cours de correction</h2>
              {waiting.map(c => <span key={c.course_id} className="text-sm">{c.title} · ton parent valide la correction</span>)}
            </section>
          )}
        </Pane>
      </Panes>
    </PaneScreen>
  );
}
