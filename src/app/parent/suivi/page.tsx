import { requireParent } from '@/lib/access';
import Link from 'next/link';
import { liveStatus, dayTimeline, lastDays, breakdown } from '@/lib/live';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { PaneScreen, Panes, Pane } from '@/components/Layout';
import { AutoRefresh } from '@/components/AutoRefresh';
import { LiveBoard } from './LiveBoard';
import { WeekBars, SplitBar, BarList } from './Charts';

export const metadata = { title: 'Suivi en direct' };
export const dynamic = 'force-dynamic';

const KIND_COLOR: Record<string, { label: string; color: string }> = {
  lesson: { label: 'Leçons', color: '#257de0' }, exercises: { label: 'Exercices', color: '#00b894' }, evaluation: { label: 'Évaluations', color: '#6a4ce2' },
};
const dur = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };

function Tile({ label, value, sub, testid }: { label: string; value: string; sub: string; testid?: string }) {
  return (
    <div className="flex-[1_1_150px] rounded-xl border border-line bg-surface-2 px-4 py-3" data-tile={testid}>
      <span className="block muted text-xs uppercase tracking-wide">{label}</span>
      <span className="block text-2xl font-bold tabular-nums">{value}</span>
      <span className="block muted text-[13px]">{sub}</span>
    </div>
  );
}

export default async function Suivi({ searchParams }: { searchParams: Promise<{ eleve?: string }> }) {
  const { eleve } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  const [live, today, days, b] = await Promise.all([liveStatus(student.id), dayTimeline(student.id), lastDays(student.id), breakdown(student.id)]);
  const goalMin = Math.round(student.settings.weekly_goal_minutes / 7);
  const w = b.week;
  const focus = w.open ? Math.round((w.active / w.open) * 100) : null;
  const kinds = Object.entries(KIND_COLOR).map(([k, c]) => ({ label: c.label, color: c.color, value: b.byKind.find(x => x.kind === k)?.s ?? 0 }));
  const other = b.byKind.filter(x => !(x.kind in KIND_COLOR)).reduce((a, x) => a + x.s, 0);
  if (other) kinds.push({ label: 'Autre', color: '#98A2B3', value: other });
  const weekActive = days.reduce((a, d) => a + d.active, 0);

  return (
    <PaneScreen top={<>
      <ChildPicker students={students} current={student} path="/parent/suivi" />
      <PageTitle kicker="Suivi en direct" title={`Ce que fait ${student.first_name}, en ce moment et ces derniers jours`}
        sub="Le temps « effectif » ne compte que les minutes où l’élève agit sur la page de travail. Les heures viennent du serveur." />
    </>}>
      <AutoRefresh active every={60_000} />
      <Panes>
        <Pane className="flex-[999_1_560px]">
          <LiveBoard studentId={student.id} name={student.first_name} initial={{ live, today, now: new Date().toISOString() }} />
          <section className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <h2 className="text-lg font-semibold mr-auto">7 derniers jours</h2>
              <span className="flex items-center gap-1.5 text-sm"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: '#2F4FD8' }} /> Travail effectif</span>
              <span className="flex items-center gap-1.5 text-sm"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: '#f47230' }} /> Pause</span>
              <span className="flex items-center gap-1.5 text-sm"><i className="inline-block w-4 border-t-2 border-dashed border-ink-2" /> Objectif {dur(goalMin * 60)}/jour</span>
            </div>
            <WeekBars days={days} goalMin={goalMin} />
            <details className="text-sm" data-table>
              <summary className="cursor-pointer muted">Voir les chiffres</summary>
              <table className="w-full mt-2 text-sm">
                <thead><tr className="text-left muted"><th className="py-1 font-medium">Jour</th><th className="font-medium">Travail effectif</th><th className="font-medium">Pause</th><th className="font-medium">Objectif atteint</th></tr></thead>
                <tbody>{days.map(d => <tr key={d.day} className="border-t border-soft"><td className="py-1">{new Date(`${d.day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</td>
                  <td>{dur(d.active)}</td><td>{dur(d.pause)}</td><td>{d.active >= goalMin * 60 ? 'oui' : 'non'}</td></tr>)}</tbody>
              </table>
            </details>
          </section>
        </Pane>
        <Pane className="flex-[1_1_380px]">
          <section className="card flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Les 7 derniers jours en un coup d’œil</h2>
            <div className="flex flex-wrap gap-3">
              <Tile testid="actif" label="Travail effectif" value={dur(weekActive)} sub={`objectif que vous avez fixé : ${dur(student.settings.weekly_goal_minutes * 60)} par semaine`} />
              <Tile testid="concentration" label="Temps où il agit sur la page" value={focus === null ? '—' : `${focus} %`} sub="minutes avec un geste (clic, défilement, saisie) sur le temps de page ouverte ; pause après 60 s sans geste" />
              <Tile testid="regularite" label="Jours travaillés" value={`${w.days}/7`} sub="jours avec au moins une minute de travail effectif" />
              <Tile testid="seance" label="Séance moyenne" value={w.sessions ? dur(w.active / w.sessions) : '—'} sub={`${w.sessions} séance(s) · ${w.pauses} pause(s) détectée(s)`} />
              <Tile testid="sorties" label="Sorties pendant les évaluations" value={String(w.focus)} sub="fois où la fenêtre a été quittée pendant une évaluation" />
            </div>
          </section>
          <section className="card flex flex-col gap-3">
            <h2 className="text-lg font-semibold">À quoi sert le temps de travail <span className="muted font-normal text-sm">· 30 jours</span></h2>
            <SplitBar parts={kinds} />
          </section>
          <section className="card flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Par matière <span className="muted font-normal text-sm">· 30 jours</span></h2>
            <BarList rows={b.bySubject.map(r => ({ label: r.subject, value: r.s }))} />
          </section>
        </Pane>
      </Panes>
    </PaneScreen>
  );
}
