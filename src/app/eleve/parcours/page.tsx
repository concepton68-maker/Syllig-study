import Link from 'next/link';
import { requireStudent } from '@/lib/access';
import { parcours, nextStep } from '@/lib/progress';
import { stepHref } from '@/lib/links';
import { PageTitle } from '@/components/Shell';
import { MasteryPill } from '@/components/Mastery';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Mon parcours' };
export const dynamic = 'force-dynamic';

export default async function Parcours() {
  const { student } = await requireStudent();
  const items = await parcours(student.id, student.level_code);
  const bySubject = new Map<string, typeof items>();
  for (const c of [...items].sort((a, b) => a.position - b.position)) {
    if (!bySubject.has(c.subject)) bySubject.set(c.subject, []);
    bySubject.get(c.subject)!.push(c);
  }
  const done = items.filter(c => c.mastery >= 4).length;
  return (
    <Screen top={<PageTitle kicker={student.level_name} title="Mon parcours" sub={`${done} cours acquis sur ${items.length}. Les cours « bientôt disponibles » arrivent au fur et à mesure.`} />}>
      {[...bySubject].map(([subject, list]) => (
        <section key={subject} className="card flex flex-col">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">{subject}</h2>
            <span className="muted text-sm">{list.filter(c => c.mastery >= 4).length} / {list.length} acquis</span>
          </div>
          {list.map(c => {
            const st = nextStep(c, student.settings.retry_delay_days);
            return (
              <div key={c.course_id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft">
                <div className="flex-[1_1_260px] min-w-0">
                  {c.published ? <Link href={`/eleve/cours/${c.course_id}`} className="font-semibold text-[15px] text-ink">{c.title}</Link> : <span className="text-[15px] muted">{c.title}</span>}
                  <div className="muted text-xs">{c.chapter}</div>
                </div>
                {c.priority === 'prioritaire' && <span className="pill bg-warm-soft text-warm">Prioritaire</span>}
                {c.published ? <MasteryPill level={c.mastery} /> : <span className="pill bg-soft text-muted">Bientôt disponible</span>}
                {c.published && st.kind !== 'done' && <Link href={stepHref(c.course_id, st)} className="text-sm font-semibold w-[190px]">{st.label}</Link>}
              </div>
            );
          })}
        </section>
      ))}
    </Screen>
  );
}
