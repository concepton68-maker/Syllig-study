import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';

// Brouillon des exercices : sauvegarde (fusion) utilisable au départ de la page (fetch keepalive / sendBeacon),
// et relecture à l'ouverture. Les réponses ne sont jamais remplacées en bloc.
const Answers = z.record(z.string().max(40), z.string().max(8000));

async function draft(courseParam: string) {
  const u = await currentUser();
  if (!u || !u.roles.includes('student')) return null;
  const courseId = Number(courseParam);
  if (!Number.isInteger(courseId)) return null;
  const [s] = await sql<{ id: string; answers: Record<string, string>; submitted_at: Date | null }[]>`
    select e.id, e.answers, e.submitted_at from exercise_submissions e join students st on st.id = e.student_id
    where st.user_id = ${u.id} and e.course_id = ${courseId} order by e.created_at desc limit 1`;
  return s ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ course: string }> }) {
  const s = await draft((await params).course);
  if (!s) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  if (s.submitted_at) return NextResponse.json({ error: 'déjà remis' }, { status: 409 });
  let answers;
  try { answers = Answers.parse(JSON.parse(await req.text()).answers); } catch { return NextResponse.json({ error: 'requête invalide' }, { status: 400 }); }
  await sql`update exercise_submissions set answers = answers || ${sql.json(answers)} where id = ${s.id} and submitted_at is null`;
  return NextResponse.json({ ok: true });
}

export async function GET(_: Request, { params }: { params: Promise<{ course: string }> }) {
  const s = await draft((await params).course);
  if (!s) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  return NextResponse.json({ answers: s.answers ?? {}, submitted: !!s.submitted_at, id: s.id });
}
