import Link from 'next/link';
import { requireStudent } from '@/lib/access';
import { parcours, nextStep, type ParcoursItem } from '@/lib/progress';
import { stepHref } from '@/lib/links';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { MasteryPill } from '@/components/Mastery';
import { EmptyState, PriorityPill } from '@/components/EmptyState';

export const metadata = { title: 'Mes cours' };
export const dynamic = 'force-dynamic';

function bySubject(list: ParcoursItem[]) {
  const m = new Map<string, ParcoursItem[]>();
  for (const c of [...list].sort((a, b) => a.position - b.position)) { if (!m.has(c.subject)) m.set(c.subject, []); m.get(c.subject)!.push(c); }
  return [...m];
}

export default async function MyCourses({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet } = await searchParams;
  const { student } = await requireStudent();
  const items = await parcours(student.id, student.level_code);
  const rd = student.settings.retry_delay_days;
  const todo = items.filter(c => c.published && c.mastery < 4);
  const done = items.filter(c => c.mastery >= 4);
  const soon = items.filter(c => !c.published);
  const tabs = [
    { id: 'a-faire', label: 'À faire', n: todo.length },
    { id: 'acquis', label: 'Acquis', n: done.length },
    { id: 'a-venir', label: 'À venir', n: soon.length },
  ];
  const tab = tabs.some(t => t.id === onglet) ? onglet! : 'a-faire';

  const row = (c: ParcoursItem) => {
    const st = nextStep(c, rd);
    return (
      <div key={c.course_id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft">
        <div className="flex-[1_1_260px] min-w-0">
          <Link href={`/eleve/cours/${c.course_id}`} className="font-semibold text-[15px] text-ink">{c.title}</Link>
          <div className="muted text-xs">{c.subject} · {c.chapter}</div>
        </div>
        {c.priority === 'prioritaire' && c.mastery < 4 && <PriorityPill />}
        <MasteryPill level={c.mastery} />
        {st.kind !== 'done' && <Link href={stepHref(c.course_id, st)} className="btn w-[220px]">{st.label}</Link>}
        {c.best && <span className="num text-sm font-semibold w-16 text-right">{Number(c.best).toLocaleString('fr-FR')}/20</span>}
      </div>
    );
  };

  return (
    <Screen top={<div className="flex flex-col gap-4">
      <PageTitle kicker={student.level_name} title="Mes cours" sub={`${done.length} cours acquis · ${todo.length} disponible${todo.length > 1 ? 's' : ''} · ${soon.length} à venir au fil de l’année`} />
      <nav aria-label="Filtrer mes cours" className="flex flex-wrap gap-2 border-b border-line pb-3">
        {tabs.map(t => (
          <Link key={t.id} href={`/eleve/parcours?onglet=${t.id}`} aria-current={tab === t.id ? 'page' : undefined}
            className={`navlink gap-1.5 border ${tab === t.id ? 'bg-brand text-white border-brand hover:bg-brand-dark hover:text-white' : 'border-line'}`}>
            {t.label}<span className="num opacity-80 font-normal">{t.n}</span></Link>
        ))}
      </nav>
    </div>}>
      {tab === 'a-faire' && (
        <section className="card flex flex-col">
          {todo.length === 0 ? <EmptyState title="Rien à faire pour l’instant" text="Tous les cours disponibles sont acquis. Les prochains arrivent bientôt." />
            : todo.map(row)}
        </section>
      )}
      {tab === 'acquis' && (
        <section className="card flex flex-col">
          {done.length === 0 ? <EmptyState title="Pas encore de cours acquis" text="Un cours est acquis à partir de 14/20 à l’évaluation. Ta meilleure note compte." />
            : done.map(row)}
        </section>
      )}
      {tab === 'a-venir' && bySubject(soon).map(([subject, list]) => (
        <details key={subject} className="card">
          <summary className="cursor-pointer flex justify-between items-center gap-3 font-semibold text-[17px]">
            <span>{subject}</span><span className="muted text-sm font-normal">{list.length} cours à venir</span>
          </summary>
          <ul className="mt-3 mb-0 pl-0 list-none columns-1 md:columns-2 gap-8">
            {list.map(c => <li key={c.course_id} className="text-sm py-1.5 break-inside-avoid"><span className="text-ink-2">{c.title}</span><span className="muted text-xs"> · {c.chapter}</span></li>)}
          </ul>
        </details>
      ))}
    </Screen>
  );
}
