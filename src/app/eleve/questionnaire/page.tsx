import { requireStudent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { CheckinForm } from './Form';

export const metadata = { title: 'Comment je travaille' };
export const dynamic = 'force-dynamic';

export default async function Questionnaire() {
  const { student } = await requireStudent();
  return (
    <Screen top={<PageTitle kicker="2 minutes pour toi" title="Comment tu travailles ?"
      sub={`Il n’y a pas de bonne ou de mauvaise réponse et ce n’est pas noté. Réponds franchement : ton parent verra tes réponses, pour mieux t’aider${student.first_name ? `, ${student.first_name}` : ''}.`} />}>
      <div className="max-w-[760px] w-full"><CheckinForm /></div>
    </Screen>
  );
}
