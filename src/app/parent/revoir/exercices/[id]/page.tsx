import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';
import { exerciseReview } from '@/lib/review';
import { ReviewView } from '@/components/ReviewView';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Revoir ensemble' };
export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tout?: string }> }) {
  const { id } = await params;
  const { tout } = await searchParams;
  const u = await requireUser('parent');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const r = await exerciseReview(id);
  if (!r) notFound();
  const student = await assertParentOf(u.id, r.studentId);
  const back = `/parent/journal?${new URLSearchParams({ eleve: student.id, semaine: r.day })}`;
  return <Screen><ReviewView r={r} name={student.first_name} back={back} all={tout === '1'} base={`/parent/revoir/exercices/${id}`} /></Screen>;
}
