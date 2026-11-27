import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import type { WeeklyData } from '@/lib/weekly';
import { WeeklyCard } from '@/components/WeeklyCard';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Messages de la semaine' };
export const dynamic = 'force-dynamic';

export default async function Messages({ searchParams }: { searchParams: Promise<{ eleve?: string }> }) {
  const { eleve } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  const msgs = await sql<{ data: WeeklyData }[]>`select data from weekly_messages where student_id = ${student.id} order by week_start desc limit 26`;
  return (
    <Screen top={<><ChildPicker students={students} current={student} path="/parent/messages" /><PageTitle kicker="Accueil" title="Messages de la semaine" sub="Un message chaque lundi, sur la semaine écoulée." /></>}>
      {msgs.length === 0 && <p className="card m-0 text-sm muted">Pas encore de message : le premier arrive lundi.</p>}
      {msgs.map(m => <WeeklyCard key={m.data.week_start} d={m.data} />)}
    </Screen>
  );
}
