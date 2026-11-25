import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { studentsOfParent } from '@/lib/access';
import { liveStatus, dayTimeline } from '@/lib/live';

export const dynamic = 'force-dynamic';

// État en direct + frise du jour, interrogés toutes les 10 s par la page « En direct » du parent
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'non connecté' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('eleve') ?? '';
  const st = (await studentsOfParent(u.id)).find(s => s.id === id);
  if (!st) return NextResponse.json({ error: 'élève inconnu' }, { status: 404 });
  const [live, today] = await Promise.all([liveStatus(st.id), dayTimeline(st.id)]);
  return NextResponse.json({ live, today, now: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
}
