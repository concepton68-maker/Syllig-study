import Link from 'next/link';
import { requireStudent } from '@/lib/access';
import { openSession, sessionView, nextReviews } from '@/lib/revisions';
import { ActivityTracker } from '@/components/ActivityTracker';
import { Screen } from '@/components/Layout';
import { ReviewRunner } from './ReviewRunner';

export const metadata = { title: 'Révision' };
export const dynamic = 'force-dynamic';

export default async function RevisionPage() {
  const { student } = await requireStudent();
  const s = await openSession(student.id, student.level_code);
  if (!s) {
    const next = await nextReviews(student.id, student.level_code);
    return (
      <Screen>
        <section className="card flex flex-col gap-3 max-w-xl" data-no-review>
          <h1 className="text-2xl font-bold m-0">Pas de révision aujourd’hui</h1>
          {next.length > 0 && <ul className="list-none m-0 p-0 flex flex-col gap-1 text-sm">{next.map(n => <li key={n.course_id} className="flex justify-between gap-3"><span>{n.title}</span><span className="muted">{n.days === 0 ? 'aujourd’hui' : n.days === 1 ? 'demain' : `dans ${n.days} jours`}</span></li>)}</ul>}
          <Link className="btn self-start" href="/eleve">Retour</Link>
        </section>
      </Screen>
    );
  }
  const view = await sessionView(s);
  return (
    <Screen top={<div className="flex items-center justify-between gap-3"><Link className="btn" href="/eleve">‹ Quitter</Link><ActivityTracker kind="review" courseId={null} idleSeconds={student.settings.idle_seconds} /></div>}>
      <ReviewRunner sessionId={s.id} questions={view.questions} answered={view.answered} />
    </Screen>
  );
}
