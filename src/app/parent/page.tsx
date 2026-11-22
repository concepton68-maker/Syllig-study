import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { weekStats, streak, hm } from '@/lib/stats';
import { recentSessions, lookTogether, subjectProgress, KIND } from '@/lib/parent-data';
import { MASTERY } from '@/lib/settings';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { decideEvalRequest } from './actions';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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
    { label: 'Régularité', value: String(w.activeDays), unit: 'jours / 7', sub: `Série en cours : ${s} jour${s > 1 ? 's' : ''}`, bar: (w.activeDays / 7) * 100 },
    { label: 'Moyenne des évaluations', value: ev.avg ? Number(ev.avg).toLocaleString('fr-FR') : '—', unit: '/ 20', sub: ev.n ? `Meilleure note retenue, ${ev.n} cours évalué${ev.n > 1 ? 's' : ''}` : 'Pas encore d’évaluation', bar: ev.avg ? (Number(ev.avg) / 20) * 100 : 0 },
    { label: 'Cours acquis', value: String(acquired), unit: `/ ${total}`, sub: `${published} cours disponible${published > 1 ? 's' : ''} à ce jour`, bar: total ? (acquired / total) * 100 : 0 },
    { label: 'Points de progrès', value: `+${w.week_points}`, unit: 'cette semaine', sub: `${w.total_points} au total`, bar: Math.min(100, w.week_points / 5) },
  ];

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent" />
      <PageTitle kicker="Cette semaine" title={`${student.first_name} a travaillé ${hm(w.active)}, ${pct} % de son objectif`}
        sub={w.open > w.active ? `Temps actif mesuré. Les ${hm(w.open - w.active)} de pages ouvertes sans activité ne sont pas comptées.` : 'Temps actif mesuré par le serveur, minute par minute.'}>
        <Link className="btn" href={`/parent/journal${q}`}>Voir le journal détaillé</Link>
      </PageTitle>

      <section aria-label="Indicateurs clés" className="flex flex-wrap gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card flex-[1_1_210px] flex flex-col gap-2">
            <span className="lbl">{k.label}</span>
            <div className="flex items-baseline gap-1.5"><span className="font-[family-name:var(--font-display)] text-[32px] font-bold">{k.value}</span><span className="muted font-semibold">{k.unit}</span></div>
            <div className="h-2 bg-track rounded-full overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(0, Math.min(100, k.bar))}%` }} /></div>
            <span className="muted text-[13px]">{k.sub}</span>
          </div>
        ))}
      </section>
    </>}>

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
          <h2 className="text-xl font-semibold">À votre niveau</h2>
          {requests.map(r => (
            <article key={r.id} className="p-3.5 rounded-xl bg-brand-soft flex flex-col gap-2">
              <strong className="text-sm">{student.first_name} demande à passer l’évaluation « {r.title} »</strong>
              <div className="flex gap-2">
                <form action={decideEvalRequest.bind(null, r.id, true)}><button className="btn btn-primary" type="submit">Autoriser</button></form>
                <form action={decideEvalRequest.bind(null, r.id, false)}><button className="btn" type="submit">Plus tard</button></form>
              </div>
            </article>
          ))}
          {toGrade.length > 0 && (
            <Link href={`/parent/copies${q}`} className="p-3.5 rounded-xl bg-brand-soft no-underline text-ink flex flex-col gap-1">
              <strong className="text-sm">{toGrade.length} copie{toGrade.length > 1 ? 's' : ''} à corriger</strong>
              <span className="text-[13px] text-ink-2">{toGrade.map(t => t.title).join(' · ')} — exportez-les pour Claude, puis importez le résultat.</span>
            </Link>
          )}
          {recentGains.map((g, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-brand-soft"><strong className="text-sm">Niveau « {MASTERY.labels[g.mastery]} » atteint</strong><div className="text-[13px] text-ink-2">{g.title}</div></div>
          ))}
          {toLook.map(({ x, why }) => (
            <Link key={x.id} href={`/parent/journal${q}`} className="p-3.5 rounded-xl bg-soft no-underline text-ink flex flex-col gap-1">
              <strong className="text-sm">À regarder ensemble : {x.title ?? KIND[x.kind]}</strong>
              <span className="text-[13px] text-ink-2">{KIND[x.kind]} · {why}. Rien d’alarmant en soi : demandez-lui de vous expliquer une question, c’est la meilleure vérification.</span>
            </Link>
          ))}
          {!requests.length && !toGrade.length && !recentGains.length && !toLook.length && <span className="text-sm muted">Rien à signaler cette semaine.</span>}
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
            <thead><tr><th>Matière</th><th>Cours</th><th>Disponibles</th><th>Commencés</th><th>Acquis</th><th className="w-[28%]">Progression</th><th>Moyenne /20</th></tr></thead>
            <tbody>
              {subjects.map(r => {
                const p = r.total ? Math.round((r.acquired / r.total) * 100) : 0;
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
