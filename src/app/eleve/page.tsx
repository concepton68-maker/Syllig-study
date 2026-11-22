import Link from 'next/link';
import { requireStudent } from '@/lib/access';
import { parcours, nextStep, pickNext } from '@/lib/progress';
import { weekStats, streak, hm } from '@/lib/stats';
import { stepHref } from '@/lib/links';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';

export const metadata = { title: 'Aujourd’hui' };
export const dynamic = 'force-dynamic';

export default async function Today() {
  const { student } = await requireStudent();
  const items = await parcours(student.id, student.level_code);
  const goal = student.settings.weekly_goal_minutes * 60;
  const [w, s] = await Promise.all([weekStats(student.id), streak(student.id)]);
  const next = pickNext(items, student.settings.retry_delay_days);
  const step = next ? nextStep(next, student.settings.retry_delay_days) : null;
  const upcoming = items.filter(c => c !== next && nextStep(c, student.settings.retry_delay_days).kind !== 'done').slice(0, 6);
  const reviews = items.filter(c => c.next_review_at && new Date(c.next_review_at).getTime() < Date.now() + 7 * 864e5)
    .sort((a, b) => new Date(a.next_review_at!).getTime() - new Date(b.next_review_at!).getTime());
  const waiting = items.filter(c => c.pending_attempt === 'submitted');
  const [lastGraded] = await sql<{ id: string; course_id: number; title: string; final_score: string }[]>`
    select a.id, a.course_id, c.title, a.final_score from eval_attempts a join courses c on c.id = a.course_id
    where a.student_id = ${student.id} and a.status = 'graded' and a.graded_at > now() - interval '3 days' order by a.graded_at desc limit 1`;
  const pct = Math.min(100, Math.round((w.active / goal) * 100));
  const C = 2 * Math.PI * 23;

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-5">
        <PageTitle title={`Salut ${student.first_name}${step?.minutes ? `, prête pour ${step.minutes} minutes ?` : ' !'}`}
          sub="Ton parcours est calculé pour toi : les priorités d’abord, puis les révisions qui arrivent." />
        <div className="flex flex-wrap gap-3">
          <div className="card py-3.5 px-4 flex items-center gap-3.5">
            <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`Objectif de la semaine : ${pct} %`}>
              <circle cx="28" cy="28" r="23" fill="none" stroke="#EEF0F3" strokeWidth="7" />
              <circle cx="28" cy="28" r="23" fill="none" stroke="#2F4FD8" strokeWidth="7" strokeDasharray={`${(C * pct) / 100} ${C}`} strokeLinecap="round" transform="rotate(-90 28 28)" />
            </svg>
            <div><strong className="text-lg">{hm(w.active)} / {hm(goal)}</strong><div className="muted text-sm">objectif de la semaine</div></div>
          </div>
          <div className="card py-3.5 px-4 flex flex-col justify-center">
            <strong className="text-lg">{s} jour{s > 1 ? 's' : ''} de suite</strong><div className="muted text-sm">au moins 5 min actives par jour</div>
          </div>
          <div className="card py-3.5 px-4 flex flex-col justify-center">
            <strong className="text-lg text-brand-dark">+{w.week_points} points de progrès</strong><div className="muted text-sm">cette semaine · {w.total_points} au total</div>
          </div>
        </div>
      </div>

      {lastGraded && (
        <Link href={`/eleve/cours/${lastGraded.course_id}/bilan/${lastGraded.id}`} className="card no-underline text-ink border-brand-mid bg-brand-soft flex flex-wrap justify-between items-center gap-3">
          <span><strong>Ton bilan est prêt : {lastGraded.title}</strong><span className="block muted text-sm">Clique pour voir ce que tu sais faire maintenant.</span></span>
          <span className="pill bg-brand text-white">{Number(lastGraded.final_score).toLocaleString('fr-FR')}/20</span>
        </Link>
      )}

      <div className="flex flex-wrap gap-6 items-start">
        <div className="flex-[999_1_600px] min-w-0 flex flex-col gap-6">
          {next && step ? (
            <section className="card p-7 flex flex-col gap-5 border-2 border-brand">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="lbl text-brand-dark">Ta prochaine étape</span>
                  <h2 className="text-[26px] font-bold">{next.title}</h2>
                  <span className="muted">{next.subject} · {next.chapter}{next.code ? ` · ${next.code}` : ''}</span>
                </div>
                <div className="flex gap-2 items-start">{next.priority === 'prioritaire' && <span className="pill bg-warm-soft text-warm">Prioritaire</span>}<MasteryPill level={next.mastery} /></div>
              </div>
              <ol className="list-none m-0 p-0 flex flex-wrap gap-2.5" aria-label="Étapes du cours">
                {[
                  { n: '①', name: 'Leçon', done: next.lesson_done, cur: step.kind === 'lesson', meta: `${next.durations?.lesson} min · points de contrôle` },
                  { n: '②', name: 'Exercices', done: next.exercises_done, cur: step.kind === 'exercises', meta: `${next.durations?.exercises} min · ★ ★★ ★★★` },
                  { n: '③', name: 'Évaluation', done: next.graded_count > 0, cur: step.kind === 'evaluation' || step.kind === 'retry', meta: `${next.durations?.evaluation} min chrono · sur 20` },
                  { n: '④', name: 'Corrigés', done: next.graded_count > 0, cur: false, meta: 'S’ouvrent après ta réponse' },
                ].map(x => (
                  <li key={x.n} className={`flex-[1_1_170px] p-3.5 rounded-xl ${x.cur ? 'bg-brand text-white' : x.done ? 'bg-brand-soft text-[#1E2A78]' : 'bg-soft text-muted'}`}>
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
            <section className="card p-7"><h2 className="text-xl font-semibold">Rien à faire pour l’instant</h2><p className="muted mb-0">De nouveaux cours arrivent bientôt. Tu peux revoir tes résultats en attendant.</p></section>
          )}

          <section className="card flex flex-col gap-1">
            <div className="flex justify-between items-center mb-2"><h2 className="text-xl font-semibold">Ensuite dans ton parcours</h2><Link href="/eleve/parcours" className="text-sm font-semibold">Tout le parcours</Link></div>
            {upcoming.map((c, i) => {
              const st = nextStep(c, student.settings.retry_delay_days);
              return (
                <div key={c.course_id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft">
                  <span className="w-7 h-7 rounded-lg bg-soft inline-flex items-center justify-center text-sm font-bold">{i + 2}</span>
                  <div className="flex-[1_1_240px] min-w-0"><strong className="text-sm">{c.title}</strong><div className="muted text-sm">{c.subject} · {c.chapter}</div></div>
                  <span className="muted text-sm w-[170px]">{st.label}</span>
                  {c.priority === 'prioritaire' ? <span className="pill bg-warm-soft text-warm">Prioritaire</span> : <span className="pill bg-soft text-ink-2">Ensuite</span>}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="flex-[1_1_340px] flex flex-col gap-6">
          <section className="card flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Révisions</h2>
            <span className="muted text-sm">Rappels espacés : J+3, J+7, J+14 ou J+30 selon ta note.</span>
            {reviews.length === 0 && <span className="text-sm">Aucune révision prévue cette semaine.</span>}
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
          <section className="card flex flex-col gap-2 bg-[#F9FAFB]">
            <h2 className="text-lg font-semibold">Ce que tes parents voient</h2>
            <ul className="m-0 pl-5 text-sm text-ink-2 flex flex-col gap-1.5 list-disc">
              <li>Ton temps de travail actif et tes séances</li><li>Tes notes et tes niveaux par cours</li><li>Les sorties de fenêtre pendant une évaluation</li>
            </ul>
            <span className="lbl mt-1.5">Ce qu’ils ne voient pas</span>
            <ul className="m-0 pl-5 text-sm text-ink-2 flex flex-col gap-1.5 list-disc"><li>Ton écran, ta caméra ou ton micro</li><li>Les autres sites que tu visites</li></ul>
          </section>
        </aside>
      </div>
    </>
  );
}
