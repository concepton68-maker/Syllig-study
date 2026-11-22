import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { studentsOfParent } from '@/lib/access';
import { buildExport } from '@/lib/corrections';
import { logEvent } from '@/lib/activity';
import type { Attempt } from '@/lib/evaluation';

// Export des copies à corriger (réponses rédigées) — aucun nom d'élève dans le fichier
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !u.roles.includes('parent')) return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const ids = (await studentsOfParent(u.id)).map(s => s.id);
  const only = new URL(req.url).searchParams.get('eleve');
  const scope = only && ids.includes(only) ? [only] : ids;
  const attempts = await sql<(Attempt & { title: string; subject: string; level: string })[]>`
    select a.*, c.title, s.name as subject, l.name as level from eval_attempts a
    join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    where a.student_id in ${sql(scope.length ? scope : ['00000000-0000-0000-0000-000000000000'])} and a.status = 'submitted' order by a.submitted_at`;
  const file = await buildExport(attempts);
  for (const sid of new Set(attempts.map(a => a.student_id))) await logEvent(sid, 'copies_exportees', { actorId: u.id, data: { copies: attempts.filter(a => a.student_id === sid).length } });
  const name = `copies-a-corriger-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(file, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });
}
