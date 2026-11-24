import { requireStudent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { YearCard } from '@/components/Dossier';
import { yearsOf, yearSummary } from '@/lib/school-years';

export const metadata = { title: 'Mon dossier scolaire' };
export const dynamic = 'force-dynamic';

// Dossier scolaire de l'élève : son année en cours et ses années précédentes
export default async function MyRecord() {
  const { student } = await requireStudent();
  const years = await yearsOf(student.id);
  const current = years.find(y => y.status === 'en_cours');
  const live = current ? await yearSummary(student.id, current.level_code, current.started_at, null) : null;
  const past = years.filter(y => y.status === 'terminee');
  return (
    <Screen top={<PageTitle spark title="Mon dossier scolaire" sub="Ton année en cours et tout ton parcours, année après année. Chaque cours acquis s’ajoute à ton dossier." />}>
      {current && <YearCard year={current} summary={live} firstName={student.first_name} />}
      {past.length > 0 && <h2 className="text-lg font-semibold m-0 mt-2">Mes années précédentes</h2>}
      {past.map(y => <YearCard key={y.id} year={y} summary={y.summary} firstName={student.first_name} />)}
    </Screen>
  );
}
