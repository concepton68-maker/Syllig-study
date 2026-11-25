import { Clock, Flame, GraduationCap, BookCheck, Star, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { weekStats, streak, hm } from '@/lib/stats';
import { recentSessions, lookTogether, subjectProgress, KIND } from '@/lib/parent-data';
import { MASTERY } from '@/lib/settings';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';
import { liveStatus } from '@/lib/live';

export const metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const KPI_STYLE: [LucideIcon, string, string][] = [
  [Clock, 'tone-brand', 'var(--color-brand)'],
  [Flame, 'tone-warm', 'var(--color-warm)'],
  [GraduationCap, 'tone-violet', 'var(--color-violet)'],
  [BookCheck, 'tone-green', 'var(--color-green)'],
  [Star, 'tone-accent', 'var(--color-accent)'],
];

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
  const live = await liveStatus(student.id);
  const LIVE = { travaille: ['Actif sur une page de travail', 'bg-brand-soft text-brand-dark'], pause: ['Page ouverte, sans geste', 'bg-warm-soft text-warm-dark'], hors_ligne: ['Aucune page de travail ouverte', 'bg-soft text-ink-2'] }[live.state];
  const goal = student.settings.weekly_goal_minutes * 60;
  const [w, s, sessions, subjects] = await Promise.all([weekStats(student.id), streak(student.id), recentSessions(student.id, 30), subjectProgress(student.id, student.level_code)]);
  const toGrade = await sql<{ id: string; title: string; attempt_no: number; submitted_at: Date }[]>`
    select a.id, c.title, a.attempt_no, a.submitted_at from eval_attempts a join courses c on c.id = a.course_id
    where a.student_id = ${student.id} and a.status = 'submitted' order by a.submitted_at`;
  const requests = await sql<{ id: string; title: string; requested_at: Date }[]>`
    select a.id, c.title, a.requested_at from eval_attempts a join courses c on c.id = a.course_id where a.student_id = ${student.id} and a.status = 'requested'`;
  const [ev] = await sql<{ avg: string | null; n: number }[]>`select round(avg(best_eval_score), 2) as avg, count(best_eval_score)::int as n from course_progress where student_id = ${student.id}`;
  const recentGains = await sql<{ title: string; mastery: number }[]>`
    select c.title, (l.data->>'niveau')::int as mastery from activity_log l join courses c on c.id = l.course_id
    where l.student_id = ${student.id} and l.event = 'niveau_atteint' and l.at > now() - interval '7 days' order by l.id desc limit 5`;
  const weekSessions = sessions.filter(x => x.started_at.getTime() > Date.now() - 7 * 864e5);
  const toLook = weekSessions.map(x => ({ x, why: lookTogether(x) })).filter(y => y.why);
  const acquired = subjects.reduce((n, r) => n + r.acquired, 0), total = subjects.reduce((n, r) => n + r.total, 0), published = subjects.reduce((n, r) => n + r.published, 0);
  const pct = Math.round((w.active / goal) * 100);
  const maxMin = Math.max(30, ...w.days.map(d => d.open / 60));

  const kpis = [
    { label: 'Temps actif mesuré', value: hm(w.active), unit: `/ ${hm(goal)}`, sub: 'Objectif hebdomadaire fixé par vous', bar: Math.min(100, pct) },
    { label: 'Jours travaillés', value: String(w.activeDays), unit: 'jours / 7', sub: `10 min ou plus dans la journée · série en cours : ${s} jour${s > 1 ? 's' : ''}`, bar: (w.activeDays / 7) * 100 },
    { label: 'Moyenne des évaluations', value: ev.avg ? Number(ev.avg).toLocaleString('fr-FR') : '—', unit: '/ 20', sub: ev.n ? `Depuis l’inscription : meilleure note de chaque cours, ${ev.n} cours évalué${ev.n > 1 ? 's' : ''}` : 'Pas encore d’évaluation', bar: ev.avg ? (Number(ev.avg) / 20) * 100 : 0 },
    { label: 'Cours acquis', value: String(acquired), unit: `/ ${published}`, sub: `« acquis » : une évaluation à 14/20 ou plus · ${published} cours disponibles, ${total} au programme`, bar: published ? (acquired / published) * 100 : 0 },
  ];

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent" />
      <PageTitle kicker="Cette semaine" title={`${student.first_name} a travaillé ${hm(w.active)}, ${pct} % de son objectif`}
        sub={w.open > w.active ? `Temps actif mesuré. Les ${hm(w.open - w.active)} de pages ouvertes sans activité ne sont pas comptées.` : 'Temps actif mesuré par le serveur, minute par minute.'}>
        <Link className={`pill min-h-9 no-underline ${LIVE[1]}`} href={`/parent/suivi${q}`} data-home-live={live.state}><span aria-hidden className={`inline-block size-2 rounded-full mr-1.5 ${live.state === 'hors_ligne' ? 'bg-muted-2' : live.state === 'pause' ? 'bg-[#f47230]' : 'bg-brand'}`} />{LIVE[0]} · suivi en direct</Link>
        <Link className="btn" href={`/parent/journal${q}`}>Voir l’activité de la semaine</Link>
      </PageTitle>

    </>}>
      {(requests.length > 0 || toGrade.length > 0) && (
        <Link href="/parent/a-faire" className="card no-underline text-ink border-brand-mid bg-brand-soft flex flex-wrap items-center justify-between gap-3">
          <span><strong>À faire</strong><span className="block text-sm text-ink-2">
            {[requests.length ? `${requests.length} demande${requests.length > 1 ? 's' : ''} d’évaluation` : '', toGrade.length ? `${toGrade.length} copie${toGrade.length > 1 ? 's' : ''} à valider` : ''].filter(Boolean).join(' · ')}
          </span></span>
          <span className="btn btn-primary">Ouvrir</span>
        </Link>
      )}
      <section aria-label="Indicateurs clés" className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((k, i) => {
          const [Icon, tone, bar] = KPI_STYLE[i % KPI_STYLE.length];
          return (
          <div key={k.label} className="card !p-5 flex flex-col gap-2.5">
            <div className="flex items-center gap-3"><span className={`kpi-icon ${tone}`}><Icon size={20} aria-hidden="true" /></span><span className="text-[13px] font-semibold text-ink-2 leading-tight">{k.label}</span></div>
            <div className="flex items-baseline gap-1.5"><span className="font-[family-name:var(--font-display)] text-[30px] font-bold num">{k.value}</span><span className="muted font-semibold">{k.unit}</span></div>
            <div className="h-1.5 bg-track rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, k.bar))}%`, background: bar }} /></div>
            <span className="muted text-[13px]">{k.sub}</span>
          </div>
        ); })}
      </section>


      <div className="flex flex-wrap gap-6 items-start">
        <section className="card flex-[999_1_560px] min-w-0 flex flex-col gap-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div><h2 className="text-xl font-semibold">Temps de travail actif, jour par jour</h2>
              <span className="muted text-sm">Une minute compte si {student.first_name} lit, répond ou écrit.</span></div>
            <div className="flex gap-4 text-[13px] font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand" />Actif</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-mid" />Ouvert sans activité</span>
            </div>
          </div>
          <div role="img" aria-label={`Minutes actives par jour : ${w.days.map((d, i) => `${DAYS[i]} ${Math.round(d.active / 60)}`).join(', ')}`} className="flex items-end gap-3.5 h-[200px] border-b border-line px-1">
            {w.days.map((d, i) => {
              const a = d.active / 60, idle = Math.max(0, (d.open - d.active) / 60);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-xs font-bold text-ink-2">{a >= 1 ? `${Math.round(a)} min` : '—'}</span>
                  <div className="w-full max-w-14 bg-brand-mid rounded-t-md" style={{ height: `${(idle / maxMin) * 160}px` }} />
                  <div className={`w-full max-w-14 bg-brand ${idle ? '' : 'rounded-t-md'}`} style={{ height: `${(a / maxMin) * 160}px` }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3.5 px-1">{DAYS.map(d => <span key={d} className="flex-1 text-center text-[13px] font-semibold muted">{d}</span>)}</div>
        </section>

        <section className="card flex-[1_1_360px] flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Points marquants</h2>
          {recentGains.map((g, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-brand-soft"><strong className="text-sm">Niveau « {MASTERY.labels[g.mastery]} » atteint</strong><div className="text-[13px] text-ink-2">{g.title}</div></div>
          ))}
          {toLook.map(({ x, why }) => (
            <Link key={x.id} href={`/parent/journal${q}`} className="p-3.5 rounded-xl bg-soft no-underline text-ink flex flex-col gap-1">
              <strong className="text-sm">À regarder ensemble : {x.title ?? KIND[x.kind]}</strong>
              <span className="text-[13px] text-ink-2">{KIND[x.kind]} · {why}. Rien d’alarmant en soi : demandez-lui de vous expliquer une question, c’est la meilleure vérification.</span>
            </Link>
          ))}
          {!recentGains.length && !toLook.length && <span className="text-sm muted">Rien de particulier cette semaine.</span>}
        </section>
      </div>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div><h2 className="text-xl font-semibold">Avancement par matière · {student.level_name}</h2>
            <span className="muted text-sm">Un cours est acquis à partir de 14/20 à l’évaluation (meilleure tentative).</span></div>
          <span className="pill bg-soft text-ink-2">{acquired} / {total} acquis</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[720px]">
            <thead><tr><th>Matière</th><th>Cours</th><th>Disponibles</th><th>Commencés</th><th>Acquis</th><th className="w-[28%]">Acquis / disponibles</th><th>Moyenne /20</th></tr></thead>
            <tbody>
              {subjects.map(r => {
                const p = r.published ? Math.round((r.acquired / r.published) * 100) : 0;
                return (
                  <tr key={r.subject}>
                    <td className="font-semibold">{r.subject}</td><td>{r.total}</td><td>{r.published}</td><td>{r.started}</td><td>{r.acquired}</td>
                    <td><div className="flex items-center gap-2.5"><div className="flex-1 h-2 bg-track rounded-full overflow-hidden"><div className="h-full bg-brand" style={{ width: `${p}%` }} /></div><span className="text-[13px] font-semibold w-9">{p} %</span></div></td>
                    <td className="font-semibold">{r.avg ? Number(r.avg).toLocaleString('fr-FR') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Screen>
  );
}
