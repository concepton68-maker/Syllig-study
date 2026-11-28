import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { goalView } from '@/lib/goal';
import { duree } from '@/lib/duration';
import { parcours, pickNext, nextStep } from '@/lib/progress';
import { dueCourses } from '@/lib/revisions';
import { subjectSummary } from '@/lib/subject-summary';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';
import { liveStatus } from '@/lib/live';
import { ensureMessage, lastMonday, weekOpen } from '@/lib/weekly';
import { WeeklyCard } from '@/components/WeeklyCard';

export const metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

// Accueil du parent (maquette validée le 26/11/2026) : ce qui demande son attention, et rien d'autre.
// La semaine détaillée est dans Activité, le direct dans En direct, la durée dans Bilan.
export default async function ParentDashboard({ searchParams }: { searchParams: Promise<{ eleve?: string }> }) {
  const { eleve } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) {
    return (
      <section className="card flex flex-col gap-3"><h1 className="text-2xl font-bold">Bienvenue</h1>
        <p className="m-0">Commencez par créer le compte de votre enfant.</p><Link className="btn btn-primary self-start" href="/parent/enfants">Ajouter un enfant</Link></section>
    );
  }
  const q = `?eleve=${student.id}`;
  const [live, gv, items, sum] = await Promise.all([liveStatus(student.id), goalView(student.id, student.settings), parcours(student.id, student.level_code), subjectSummary(student.id, student.level_code)]);
  const LIVE = { travaille: ['Au travail', 'bg-brand-soft text-brand-dark'], pause: ['En pause', 'bg-soft text-ink-2'], hors_ligne: ['Aucune page de travail ouverte', 'bg-soft text-ink-2'] }[live.state];
  // à faire pour le parent : copies remises à valider, demandes d'évaluation
  const todo = await sql<{ id: string; status: string; title: string; at: Date | null }[]>`
    select a.id, a.status, c.title, coalesce(a.submitted_at, a.requested_at) as at
    from eval_attempts a join courses c on c.id = a.course_id
    where a.student_id = ${student.id} and a.status in ('submitted', 'requested') order by coalesce(a.submitted_at, a.requested_at) limit 4`;
  const notes = await sql<{ id: string; title: string; subject: string; note: string; at: Date }[]>`
    select a.id, c.title, sj.name as subject, a.final_score as note, a.submitted_at as at from eval_attempts a join courses c on c.id = a.course_id
    join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${student.id} and a.status = 'graded' and a.final_score is not null order by a.graded_at desc nulls last limit 3`;
  // message du lundi : la semaine écoulée (créé à la première visite s'il ne l'est pas encore)
  const monday = await lastMonday();
  const [inWeek] = await sql<{ ok: boolean }[]>`select created_at < ((${monday}::date + 7)::timestamp at time zone 'Europe/Paris') as ok from students where id = ${student.id}`;
  const msg = inWeek?.ok && await weekOpen() ? await ensureMessage(student.id, monday).catch(() => null) : null;   // jamais avant le lundi 7 h ; une erreur ne bloque pas l'Accueil
  // la suite : prochain cours (même choix que l'accueil de l'élève), révisions prévues aujourd'hui, cours à revoir
  const next = pickNext(items, student.settings.retry_delay_days);
  const step = next ? nextStep(next, student.settings.retry_delay_days) : null;
  const due = await dueCourses(student.id, student.level_code);
  const toReview = sum.subjects.reduce((n, x) => n + x.review.length, 0);
  const t = gv.today, goal = t.goal;
  const pct = goal ? Math.min(1, t.minutes / goal) : 0;
  const R = 40, L = 2 * Math.PI * R;
  const day = (d: Date | null) => d ? d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric' }) : '';
  const name = student.first_name;
  const Row = ({ label, tip, children, id }: { label: string; tip: string; children: React.ReactNode; id: string }) => (
    <div className="flex justify-between items-center gap-3 py-2 border-t border-soft text-sm" data-home-next={id}><span>{label} <span className="muted text-xs" tabIndex={0} data-tip={tip} aria-label={`Définition : ${tip}`}>ⓘ</span></span><strong className="text-right">{children}</strong></div>);

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent" />
      <PageTitle kicker="Accueil" title={name}>
        <Link className={`pill min-h-10 no-underline ${LIVE[1]}`} href={`/parent/suivi${q}`} data-home-live={live.state}><span aria-hidden className={`inline-block size-2 rounded-full mr-1.5 ${live.state === 'hors_ligne' ? 'bg-muted-2' : live.state === 'pause' ? 'bg-[#f47230]' : 'bg-brand'}`} />{LIVE[0]}</Link>
      </PageTitle>
    </>}>
      {msg && <WeeklyCard d={msg.data} more={`/parent/messages${q}`} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-label="Aujourd’hui et cette semaine" className="card flex flex-wrap items-center gap-5" data-home-week>
          <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={goal ? `Aujourd’hui ${duree(t.minutes)} sur ${duree(goal)}, ${Math.floor(pct * 100)} %` : `Aujourd’hui ${duree(t.minutes)}`} className="shrink-0">
            <circle cx="48" cy="48" r={R} fill="none" stroke="var(--color-track)" strokeWidth="10" />
            {pct > 0 && <circle cx="48" cy="48" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * L} ${L}`} transform="rotate(-90 48 48)" />}
            <text x="48" y={goal ? 47 : 53} textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">{duree(t.minutes)}</text>
            {goal && <text x="48" y="64" textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">sur {duree(goal)}</text>}
          </svg>
          <div className="flex-1 min-w-[240px] flex flex-col gap-2">
            <div className="flex justify-between items-baseline gap-2"><strong className="text-[17px]">Aujourd’hui</strong>
              <span className="text-[13px] muted">{goal ? `objectif du jour ${duree(goal)}` : gv.mode === 'jour' ? 'pas d’objectif aujourd’hui' : `objectif de la semaine ${duree(gv.week_goal)}`}</span></div>
            <div className="grid grid-cols-7 gap-1.5">
              {gv.days.map((d, i) => (
                <span key={d.day} tabIndex={0} data-tip={`${duree(d.minutes)}${d.goal ? ` sur ${duree(d.goal)}` : ''}`}
                  className={`h-8 rounded-lg text-xs font-bold grid place-items-center ${d.met ? 'bg-brand text-white' : d.goal === null && gv.mode === 'jour' ? 'border border-dashed border-line-strong muted' : d.minutes > 0 ? 'bg-brand-soft text-brand-dark' : 'bg-track text-ink-2'} ${d.today ? 'ring-2 ring-brand' : ''}`}>{'LMMJVSD'[i]}</span>
              ))}
            </div>
            <span className="text-[13px] text-ink-2">Cette semaine <strong>{duree(gv.week_min)}</strong> sur {duree(gv.week_goal)} · {gv.mode === 'jour' ? <>objectif atteint <strong>{gv.goal_days_met} jour{gv.goal_days_met > 1 ? 's' : ''} sur {gv.goal_days_elapsed}</strong></> : <><strong>{gv.worked_days} / 7 jours</strong> avec 10 min ou plus</>}</span>
            <Link className="text-[13px] font-semibold self-start" href={`/parent/journal${q}`}>Ce que {name} a fait ›</Link>
          </div>
        </section>

        <section aria-labelledby="todo" className="card flex flex-col gap-2" data-home-todo>
          <h2 id="todo" className="text-[17px] font-semibold m-0">À faire pour vous</h2>
          {todo.length === 0 && <p className="m-0 text-sm muted">Rien à faire pour l’instant.</p>}
          {todo.map(x => (
            <Link key={x.id} href={x.status === 'submitted' ? `/parent/copies/${x.id}` : '/parent/a-faire'} className="flex justify-between items-center gap-3 rounded-xl bg-warm-soft px-3 py-2.5 no-underline text-ink">
              <span className="text-sm min-w-0"><strong>{x.status === 'submitted' ? 'Copie à valider' : 'Demande d’évaluation'}</strong>
                <span className="block text-warm-dark truncate">{x.title}{x.at ? ` · ${day(x.at)}` : ''}</span></span>
              <span className="font-semibold text-brand-dark whitespace-nowrap">{x.status === 'submitted' ? 'Valider ›' : 'Répondre ›'}</span>
            </Link>
          ))}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="notes" className="card flex flex-col" data-home-notes>
          <div className="flex justify-between items-baseline gap-2 mb-2"><h2 id="notes" className="text-[17px] font-semibold m-0">Dernières notes</h2><Link className="text-[13px] font-semibold" href={`/parent/bilan${q}`}>Tout le bilan ›</Link></div>
          {notes.length === 0 && <p className="m-0 text-sm muted">Pas encore de copie notée.</p>}
          {notes.map(n => (
            <div key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5 border-t border-soft">
              <span className="flex flex-col min-w-0"><strong className="text-[15px] leading-snug">{n.title}</strong>
                <span className="text-[13px] muted">{n.subject} · {n.at.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })}</span></span>
              <strong className="text-base tabular-nums whitespace-nowrap">{Number(n.note).toLocaleString('fr-FR')}/20</strong>
              <Link className="btn btn-sm" href={`/parent/revoir/copie/${n.id}`}>Revoir</Link>
            </div>
          ))}
        </section>

        <section aria-labelledby="suite" className="card flex flex-col" data-home-next-card>
          <h2 id="suite" className="text-[17px] font-semibold m-0 mb-1">La suite pour {name}</h2>
          <Row id="cours" label="Prochain cours" tip="le cours que la plateforme propose en premier à l’élève, et son étape">{next && step ? `${next.title} · ${step.label}` : 'aucun pour l’instant'}</Row>
          <Row id="revisions" label="Révisions prévues aujourd’hui" tip="cours dont la révision espacée tombe aujourd’hui (au plus 2 par jour)">{due.length ? `${due.length} cours` : 'aucune'}</Row>
          <Row id="revoir" label="Cours à revoir" tip="cours dont la dernière copie notée a une question à 0 point ou sans réponse, depuis le 1er septembre">{toReview ? <Link href={`/parent/bilan${q}#matieres`}>{toReview}</Link> : 'aucun'}</Row>
        </section>
      </div>
    </Screen>
  );
}
