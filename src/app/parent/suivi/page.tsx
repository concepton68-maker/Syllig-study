import { requireParent } from '@/lib/access';
import Link from 'next/link';
import { liveStatus, dayTimeline } from '@/lib/live';
import { mondayOf, hm } from '@/lib/week';
import { weekTimeline } from '@/lib/review';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';
import { AutoRefresh } from '@/components/AutoRefresh';
import { LiveBoard } from './LiveBoard';

export const metadata = { title: 'Suivi en direct' };
export const dynamic = 'force-dynamic';

// En direct (maquette validée le 26/11/2026) : seulement maintenant et aujourd'hui. La semaine est dans Activité, la durée dans Bilan.

export default async function Suivi({ searchParams }: { searchParams: Promise<{ eleve?: string }> }) {
  const { eleve } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  const { current } = await mondayOf();
  const [live, today, week] = await Promise.all([liveStatus(student.id), dayTimeline(student.id), weekTimeline(student.id, current)]);
  const items = week.find(d => d.day === today.day)?.items ?? [];

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent/suivi" />
      <PageTitle kicker="En direct" title={`${student.first_name}, en ce moment`} sub="Heures du serveur. Une minute compte si l’élève agit sur la page de travail." />
    </>}>
      <AutoRefresh active every={60_000} />
      <LiveBoard studentId={student.id} name={student.first_name} idleMin={student.settings.idle_seconds / 60} initial={{ live, today, now: new Date().toISOString() }} />
      <section className="card flex flex-col" aria-labelledby="seances" data-today-list>
        <h2 id="seances" className="text-lg font-semibold m-0 mb-2">Les séances commencées aujourd’hui</h2>
        {items.length === 0 && <p className="m-0 text-sm muted">Rien pour l’instant aujourd’hui.</p>}
        {items.map(it => (
          <div key={it.key} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 border-t border-soft text-sm">
            <span className="muted tabular-nums">{it.time}</span>
            <span className="min-w-0"><strong>{it.title}</strong><span className="muted"> · {[it.subject, it.what].filter(Boolean).join(' · ')}</span></span>
            <span className="flex items-center gap-2.5 whitespace-nowrap">{it.minutes === null ? '' : it.minutes ? hm(it.minutes) : 'moins d’1 min'}{it.result ? <strong>{it.result}</strong> : null}{it.href && <Link className="font-semibold" href={it.href}>Revoir</Link>}</span>
          </div>
        ))}
        <span className="text-xs muted mt-2">Une séance compte pour le jour où elle commence ; la frise ci-dessus compte chaque minute le jour où elle a lieu.</span>
        <Link className="text-sm font-semibold self-start min-h-11 inline-flex items-center mt-1" href={`/parent/journal?eleve=${student.id}`}>Toute la semaine ›</Link>
      </section>
    </Screen>
  );
}
