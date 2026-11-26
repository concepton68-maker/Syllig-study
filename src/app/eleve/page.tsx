import { Flame, Star } from 'lucide-react';
import Link from 'next/link';
import { requireStudent } from '@/lib/access';
import { parcours, nextStep, pickNext } from '@/lib/progress';
import { skipCourse } from './skip-actions';
import { weekStats, streak, hm } from '@/lib/stats';
import { stepHref } from '@/lib/links';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';
import { PaneScreen, Panes, Pane } from '@/components/Layout';
import { EmptyState, PriorityPill } from '@/components/EmptyState';
import { Compass, MessageCircleHeart } from 'lucide-react';
import { CHECKIN_EVERY_DAYS } from '@/lib/checkin';

export const metadata = { title: 'Aujourd’hui' };
export const dynamic = 'force-dynamic';

export default async function Today({ searchParams }: { searchParams: Promise<{ questionnaire?: string; passee?: string }> }) {
  const { questionnaire, passee } = await searchParams;
  const { student } = await requireStudent();
  const items = await parcours(student.id, student.level_code);
  const goal = student.settings.weekly_goal_minutes * 60;
  const [w, s, [{ total }]] = await Promise.all([weekStats(student.id), streak(student.id),
    sql<{ total: number }[]>`select coalesce(sum(amount), 0)::int as total from points_ledger where student_id = ${student.id}`]);
  // paliers de progression : un nouveau palier tous les 250 points, jamais de retour en arrière
  const TIER = 250;
  const tier = Math.floor(total / TIER) + 1;
  const tierPct = Math.round(((total % TIER) / TIER) * 100);
  const next = pickNext(items, student.settings.retry_delay_days);
  const skippedTitle = passee ? items.find(c => String(c.course_id) === passee && c.skipped)?.title ?? null : null;
  const step = next ? nextStep(next, student.settings.retry_delay_days) : null;
  // « Ensuite » : uniquement des cours disponibles où il reste quelque chose à faire
  const upcoming = items.filter(c => c !== next && c.published && !['done', 'soon'].includes(nextStep(c, student.settings.retry_delay_days).kind)).slice(0, 5);
  const soonCount = items.filter(c => !c.published).length;
  const [placement] = await sql<{ id: string; status: string; total: number; duration_min: number }[]>`
    select id, status, total, duration_min from placement_tests where student_id = ${student.id} and status <> 'termine' order by created_at desc limit 1`;
  // questionnaire « Comment je travaille » : au début, puis toutes les 6 semaines (jamais en même temps que le test)
  const [ck] = await sql<{ due: boolean }[]>`select coalesce(max(created_at) < now() - make_interval(days => ${CHECKIN_EVERY_DAYS}), true) as due from student_checkins where student_id = ${student.id}`;
  const checkinDue = (ck.due || !!(student.settings as { checkin_requested?: boolean }).checkin_requested) && !placement;
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
        <PageTitle spark title={`Salut ${student.first_name}${step?.minutes ? `, on y va pour ${step.minutes} minutes ?` : ' !'}`}
          sub="Ton parcours est calculé pour toi : les priorités d’abord, puis les révisions." />
        <div className="grid grid-cols-3 gap-3 w-full sm:w-auto">
          <div className="card !p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <svg width="42" height="42" viewBox="0 0 42 42" role="img" aria-label={`Objectif de la semaine : ${pct} %`} className="shrink-0">
              <circle cx="21" cy="21" r="17" fill="none" style={{ stroke: 'var(--color-track)' }} strokeWidth="6" />
              <circle cx="21" cy="21" r="17" fill="none" style={{ stroke: 'var(--color-brand)' }} strokeWidth="6" strokeDasharray={`${(C * pct) / 100} ${C}`} strokeLinecap="round" transform="rotate(-90 21 21)" />
            </svg>
            <div><strong className="num text-base">{hm(w.active)}</strong><div className="muted text-xs">sur {hm(goal)} cette semaine</div></div>
          </div>
          <div className="card !p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:min-w-[170px]"><span className="kpi-icon tone-warm"><Flame size={20} aria-hidden="true" /></span>
            <div>{s > 0 ? <><strong className="num text-base">{s} jour{s > 1 ? 's' : ''}</strong><div className="muted text-xs">de suite</div></>
              : <><strong className="text-[15px]">Lance ta série</strong><div className="muted text-xs">un peu de travail chaque jour</div></>}</div></div>
          <div className="card !p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:min-w-[200px]"><span className="kpi-icon tone-brand"><Star size={20} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><strong className="num text-base text-brand-dark">Palier {tier}</strong>
              <div className="muted text-xs">{total} points{w.week_points ? ` · +${w.week_points} cette semaine` : ''}</div>
              <div className="h-1.5 mt-1.5 bg-track rounded-full overflow-hidden" role="img" aria-label={`${tierPct} % du palier ${tier + 1}`}><div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(4, tierPct)}%` }} /></div></div></div>
        </div>
      </div>
    }>
      <Panes>
        <Pane className="flex-[999_1_600px]">
          {placement && (
            <section className="card p-6 flex flex-wrap items-center gap-4 border-2 border-accent">
              <span className="kpi-icon tone-brand !w-12 !h-12" aria-hidden="true"><Compass size={24} /></span>
              <span className="flex-[1_1_240px]"><span className="lbl">À faire en premier</span><strong className="block text-lg">Test de positionnement</strong>
                <span className="muted text-sm">{placement.total} questions · environ {placement.duration_min} min · ne compte pas dans tes notes</span></span>
              <Link className="btn btn-primary" href={`/eleve/positionnement/${placement.id}`}>{placement.status === 'en_cours' ? 'Reprendre le test' : 'Faire le test'}</Link>
            </section>
          )}
          {skippedTitle && <p role="status" className="m-0 rounded-xl bg-soft px-4 py-3 text-sm" data-skipped><strong>C’est noté.</strong> « {skippedTitle} » t’attend dans Tous mes cours : tu y reviens quand tu veux.</p>}
          {questionnaire === 'merci' && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>Merci !</strong> Tes réponses aident ton parent à mieux t’accompagner.</p>}
          {checkinDue && (
            <section className="card p-5 flex flex-wrap items-center gap-4" data-checkin-due>
              <span className="kpi-icon tone-brand !w-12 !h-12" aria-hidden="true"><MessageCircleHeart size={24} /></span>
              <span className="flex-[1_1_240px]"><span className="lbl">2 minutes pour toi</span><strong className="block text-lg">Comment tu travailles ?</strong>
                <span className="muted text-sm">14 petites phrases : ce qui te motive, ce qui te stresse, ce qui t’aide. Pas de note.</span></span>
              <Link className="btn" href="/eleve/questionnaire">Répondre</Link>
            </section>
          )}
          {next && step ? (
            <section className="card p-7 flex flex-col gap-5 border-2 border-brand">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="lbl">Ta prochaine étape</span>
                  <h2 className="text-[26px] font-bold">{next.title}</h2>
                  <span className="muted">{next.subject} · {next.chapter}{next.code ? ` · ${next.code}` : ''}</span>
                </div>
                <div className="flex gap-2 items-start">{next.priority === 'prioritaire' && <PriorityPill />}<MasteryPill level={next.mastery} started={next.lesson_started} /></div>
              </div>
              <ol className="list-none m-0 p-0 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2.5 order-2 sm:order-none" aria-label="Étapes du cours">
                {[
                  { n: '①', name: 'Leçon', done: next.lesson_done, cur: step.kind === 'lesson', meta: `${next.durations?.lesson} min · points de contrôle` },
                  { n: '②', name: 'Exercices', done: next.exercises_done, cur: step.kind === 'exercises', meta: `${next.durations?.exercises} min · ★ ★★ ★★★` },
                  { n: '③', name: 'Évaluation', done: next.graded_count > 0, cur: step.kind === 'evaluation' || step.kind === 'retry', meta: `${next.durations?.evaluation} min chronométrées · sur 20` },
                ].map(x => (
                  <li key={x.n} className={`p-3.5 rounded-xl ${x.cur ? 'bg-brand text-white' : x.done ? 'bg-brand-soft text-brand-ink' : 'bg-soft text-muted'}`}>
                    <div className="text-sm font-bold">{x.n} · {x.name}{x.done && !x.cur ? ' ✓' : ''}</div>
                    <div className="text-sm mt-1">{x.meta}</div>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-4 order-1 sm:order-none">
                <Link className="btn btn-primary min-h-[52px] px-7 text-base w-full sm:w-auto" href={stepHref(next.course_id, step)}>
                  {step.kind === 'lesson' && !next.lesson_started ? 'Commencer' : 'Continuer'} : {step.label}{step.minutes ? ` · ${step.minutes} min` : ''}
                </Link>
                {next.pending_attempt !== 'in_progress' && <form action={skipCourse.bind(null, next.course_id)}><button className="btn min-h-[52px]" type="submit" data-skip>{step.kind === 'lesson' ? 'Passer cette leçon' : 'Passer ce cours'}</button></form>}
                <span className="muted text-sm max-w-[460px]">Le temps compte tant que la page est ouverte devant toi : tu as {student.settings.idle_seconds / 60} min sans rien toucher pour écrire au brouillon ou réfléchir. Il s’arrête si tu changes d’onglet ou réduis la fenêtre. Les corrigés s’ouvrent après ta réponse.</span>
              </div>
            </section>
          ) : (
            <section className="card p-7">
              <EmptyState title={acquired.length ? 'Tout est fait pour l’instant, bravo !' : 'Ton premier cours arrive bientôt'}
                text={acquired.length ? `Tu as acquis ${acquired.length} cours. De nouveaux cours arrivent ; en attendant, revois tes résultats ou tes révisions.` : 'Dès qu’un cours est publié, il apparaît ici. En attendant, choisis les couleurs de ton espace.'}
                action={acquired.length ? <Link className="btn" href="/eleve/resultats">Voir mes résultats</Link> : <Link className="btn" href="/eleve/theme">Choisir mon thème</Link>} />
            </section>
          )}

          <section className="card flex flex-col gap-1">
            <div className="flex justify-between items-center mb-2"><h2 className="text-xl font-semibold">Ou choisis toi-même</h2><Link href="/eleve/parcours" className="text-sm font-semibold">Tous mes cours</Link></div>
            {upcoming.length > 0 && <span className="muted text-sm -mt-1 mb-1">Tu peux commencer par le cours qui te tente le plus : ton parcours s’adapte.</span>}
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
              <span className="flex items-center justify-between gap-2"><span className="muted text-sm">Ce que tu as réussi dans cette évaluation</span><span className="pill bg-brand text-white num">{Number(lastGraded.final_score).toLocaleString('fr-FR')}/20</span></span>
            </Link>
          )}
          <section className="card flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Révisions</h2>
            {reviews.length === 0 && <EmptyState title="Aucune révision cette semaine" text="Après chaque évaluation, une révision est programmée (de 3 à 30 jours plus tard selon ta note) : tu refais les exercices du cours." />}
            {reviews.map(r => {
              const due = new Date(r.next_review_at!);
              const late = due.getTime() < Date.now();
              return (
                <Link key={r.course_id} href={`/eleve/cours/${r.course_id}/exercices`} data-review className={`p-3 rounded-xl no-underline text-ink ${late ? 'bg-warm-soft' : 'bg-soft'}`}>
                  <strong className="text-sm">{r.title}</strong>
                  <div className={`text-sm ${late ? 'text-warm-dark' : 'muted'}`}>{r.subject} · {late ? 'à faire dès que possible' : `prévue le ${due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}`} · refaire les exercices ›</div>
                </Link>
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
