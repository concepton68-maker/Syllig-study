import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getAttempt, GRACE_SECONDS } from '@/lib/evaluation';
import { logEvent } from '@/lib/activity';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), answers: z.record(z.string().max(40), z.string().max(8000)) }),
  z.object({ action: z.literal('focus_lost') }),
  z.object({ action: z.literal('focus_back'), seconds: z.number().min(0).max(36000) }),
  z.object({ action: z.literal('paste_blocked') }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ attempt: string }> }) {
  const { attempt } = await params;
  const u = await currentUser();
  if (!u || u.role !== 'student') return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const a = z.string().uuid().safeParse(attempt).success ? await getAttempt(attempt) : null;
  const [st] = await sql<{ id: string }[]>`select id from students where user_id = ${u.id}`;
  if (!a || !st || a.student_id !== st.id) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  if (a.status !== 'in_progress') return NextResponse.json({ error: 'copie déjà remise' }, { status: 409 });
  let body;
  try { body = Body.parse(JSON.parse(await req.text())); } catch { return NextResponse.json({ error: 'requête invalide' }, { status: 400 }); }
  const expired = a.deadline_at && Date.now() > a.deadline_at.getTime() + GRACE_SECONDS * 1000;

  switch (body.action) {
    case 'save':
      if (expired) return NextResponse.json({ error: 'temps écoulé' }, { status: 409 });
      await sql`update eval_attempts set answers = ${sql.json(body.answers)} where id = ${a.id} and status = 'in_progress'`;
      break;
    case 'focus_lost':
      await sql`update eval_attempts set focus_losses = focus_losses + 1 where id = ${a.id}`;
      await logEvent(st.id, 'evaluation_sortie_fenetre', { courseId: a.course_id, data: { tentative: a.attempt_no } });
      break;
    case 'focus_back':
      await sql`update eval_attempts set focus_lost_seconds = focus_lost_seconds + ${Math.round(body.seconds)} where id = ${a.id}`;
      await logEvent(st.id, 'evaluation_retour_fenetre', { courseId: a.course_id, data: { tentative: a.attempt_no, absence_s: Math.round(body.seconds) } });
      break;
    case 'paste_blocked':
      await sql`update eval_attempts set paste_blocked = paste_blocked + 1 where id = ${a.id}`;
      await logEvent(st.id, 'evaluation_coller_bloque', { courseId: a.course_id, data: { tentative: a.attempt_no } });
      break;
  }
  return NextResponse.json({ ok: true, remaining: a.deadline_at ? Math.max(0, Math.round((a.deadline_at.getTime() - Date.now()) / 1000)) : null });
}
