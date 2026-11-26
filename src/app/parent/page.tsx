import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { subjectProgress } from '@/lib/parent-data';
import { weekReport, hm } from '@/lib/week';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';
import { liveStatus } from '@/lib/live';

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
  const [live, w, subjects] = await Promise.all([liveStatus(student.id), weekReport(student), subjectProgress(student.id, student.level_code)]);
  const LIVE = { travaille: ['Au travail', 'bg-brand-soft text-brand-dark'], pause: ['En pause', 'bg-soft text-ink-2'], hors_ligne: ['Aucune page de travail ouverte', 'bg-soft text-ink-2'] }[live.state];
  const toGrade = await sql<{ n: number }[]>`select count(*)::int as n from eval_attempts where student_id = ${student.id} and status = 'submitted'`;
  const requests = await sql<{ n: number }[]>`select count(*)::int as n from eval_attempts where student_id = ${student.id} and status = 'requested'`;
  const nGrade = toGrade[0].n, nReq = requests[0].n;
  const notes = await sql<{ id: string; title: string; subject: string; note: string; at: Date }[]>`
    select a.id, c.title, sj.name as subject, a.final_score as note, a.submitted_at as at from eval_attempts a join courses c on c.id = a.course_id
    join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${student.id} and a.status = 'graded' and a.final_score is not null order by a.graded_at desc nulls last limit 3`;
  const shown = subjects.filter(s => s.published > 0);
  const pct = w.goal_min ? Math.min(1, w.active_min / w.goal_min) : 0;
  const R = 26, L = 2 * Math.PI * R;

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent" />
      <PageTitle kicker="Accueil" title={student.first_name}>
        <Link className={`pill min-h-10 no-underline ${LIVE[1]}`} href={`/parent/suivi${q}`} data-home-live={live.state}><span aria-hidden className={`inline-block size-2 rounded-full mr-1.5 ${live.state === 'hors_ligne' ? 'bg-muted-2' : live.state === 'pause' ? 'bg-[#f47230]' : 'bg-brand'}`} />{LIVE[0]}</Link>
      </PageTitle>
    </>}>
      {(nReq > 0 || nGrade > 0) && (
        <Link href="/parent/a-faire" className="card no-underline text-ink border-brand-mid bg-brand-soft flex flex-wrap items-center justify-between gap-3" data-home-todo>
          <span><strong>À faire</strong><span className="block text-sm text-ink-2">
            {[nGrade ? `${nGrade} copie${nGrade > 1 ? 's' : ''} à valider` : '', nReq ? `${nReq} demande${nReq > 1 ? 's' : ''} d’évaluation` : ''].filter(Boolean).join(' · ')}
          </span></span>
          <span className="btn btn-primary">Ouvrir</span>
        </Link>
      )}

      <section aria-labelledby="semaine" className="card flex flex-wrap items-center gap-x-8 gap-y-4" data-home-week>
        <h2 id="semaine" className="text-lg font-semibold m-0 basis-full">Cette semaine</h2>
        <div className="flex items-center gap-3.5">
          <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${hm(w.active_min)} sur ${hm(w.goal_min)}, ${Math.floor(pct * 100)} %`} className="shrink-0">
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--color-track)" strokeWidth="8" />
            {pct > 0 && <circle cx="32" cy="32" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${pct * L} ${L}`} transform="rotate(-90 32 32)" />}
          </svg>
          <span className="flex flex-col"><strong className="text-[22px]">{hm(w.active_min)}</strong><span className="text-[13px] muted">temps de travail · objectif {hm(w.goal_min)}</span></span>
        </div>
        <span className="flex flex-col"><strong className="text-[22px]">{w.days_worked} / 7 jours</strong><span className="text-[13px] muted">10 min ou plus</span></span>
        <Link className="btn ml-auto" href={`/parent/journal${q}`}>Ce que {student.first_name} a fait ›</Link>
      </section>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <section aria-labelledby="notes" className="card flex flex-col" data-home-notes>
          <h2 id="notes" className="text-lg font-semibold m-0 mb-2">Dernières notes</h2>
          {notes.length === 0 && <p className="m-0 text-sm muted">Pas encore de copie notée.</p>}
          {notes.map(n => (
            <div key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5 border-t border-soft">
              <span className="flex flex-col min-w-0"><strong className="text-[15px] leading-snug">{n.title}</strong>
                <span className="text-[13px] muted">{n.subject} · {n.at.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })}</span></span>
              <strong className="text-base tabular-nums whitespace-nowrap">{Number(n.note).toLocaleString('fr-FR')}/20</strong>
              <Link className="btn btn-primary min-h-10" href={`/parent/revoir/copie/${n.id}`}>Revoir</Link>
            </div>
          ))}
        </section>

        <section aria-labelledby="acquis" className="card flex flex-col gap-3" data-home-acquired>
          <div className="flex justify-between items-baseline gap-2"><h2 id="acquis" className="text-lg font-semibold m-0">Cours acquis</h2><span className="text-xs muted">évaluation à 14/20 ou plus</span></div>
          {shown.length === 0 && <p className="m-0 text-sm muted">Pas encore de cours disponible.</p>}
          {shown.map(s => (
            <div key={s.subject} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-2.5 text-sm" data-acq={s.subject}>
              <span className="truncate">{s.subject}</span>
              <span className="h-2.5 rounded-full bg-track"><span className="block h-2.5 rounded-full bg-brand" style={{ width: `${Math.min(100, (s.acquired / s.published) * 100)}%` }} /></span>
              <strong className="tabular-nums text-right">{s.acquired} / {s.published}</strong>
            </div>
          ))}
          {shown.length > 0 && <span className="text-xs muted">sur les cours disponibles</span>}
        </section>
      </div>
    </Screen>
  );
}
