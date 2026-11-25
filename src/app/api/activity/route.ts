import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { logEvent } from '@/lib/activity';

// Mesure d'activité : le navigateur envoie un signal toutes les 15 s ; le serveur seul compte le temps.
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), kind: z.enum(['lesson', 'exercises', 'evaluation', 'review', 'other']), courseId: z.number().int().nullable() }),
  z.object({ action: z.literal('beat'), session: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal('end'), session: z.string().uuid(), active: z.boolean().optional() }),
]);
const MAX_GAP = 30; // secondes comptées au plus entre deux signaux (onglet fermé, veille…)

async function closeSession(id: string, studentId: string) {
  const [s] = await sql<{ course_id: number | null; kind: string; active_seconds: number; open_seconds: number; idle_pauses: number }[]>`
    update work_sessions set ended_at = now() where id = ${id} and student_id = ${studentId} and ended_at is null
    returning course_id, kind, active_seconds, open_seconds, idle_pauses`;
  if (s && s.open_seconds > 0)
    await logEvent(studentId, 'seance_terminee', { courseId: s.course_id, data: { type: s.kind, actif_s: s.active_seconds, ouvert_s: s.open_seconds, pauses: s.idle_pauses } });
}

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u || !u.roles.includes('student')) return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const [st] = await sql<{ id: string }[]>`select id from students where user_id = ${u.id}`;
  if (!st) return NextResponse.json({ error: 'élève introuvable' }, { status: 404 });
  let body;
  try { body = Body.parse(JSON.parse(await req.text())); } catch { return NextResponse.json({ error: 'requête invalide' }, { status: 400 }); }

  if (body.action === 'start') {
    // une seule séance ouverte à la fois : on clôt les précédentes
    const open = await sql<{ id: string }[]>`select id from work_sessions where student_id = ${st.id} and ended_at is null`;
    for (const o of open) await closeSession(o.id, st.id);
    const [s] = await sql<{ id: string }[]>`insert into work_sessions (student_id, course_id, kind) values (${st.id}, ${body.courseId}, ${body.kind}) returning id`;
    return NextResponse.json({ session: s.id });
  }

  const delta = sql`least(greatest(extract(epoch from now() - last_beat_at), 0), ${MAX_GAP})::int`;
  const active = body.active ?? false;
  // signal conservé (frise de la journée et suivi en direct du parent), avant la mise à jour des totaux
  await sql`insert into activity_beats (session_id, student_id, active, seconds)
    select id, student_id, ${active}, ${delta} from work_sessions where id = ${body.session} and student_id = ${st.id} and ended_at is null`;
  const [s] = await sql<{ id: string }[]>`
    update work_sessions set
      open_seconds = open_seconds + ${delta},
      active_seconds = active_seconds + case when ${active} then ${delta} else 0 end,
      idle_pauses = idle_pauses + case when was_active and not ${active} then 1 else 0 end,
      was_active = ${active},
      last_beat_at = now()
    where id = ${body.session} and student_id = ${st.id} and ended_at is null returning id`;
  if (!s) return NextResponse.json({ error: 'séance terminée' }, { status: 409 });
  if (body.action === 'end') await closeSession(body.session, st.id);
  return NextResponse.json({ ok: true });
}
