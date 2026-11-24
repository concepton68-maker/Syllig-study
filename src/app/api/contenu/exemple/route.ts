import { currentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { pickExample } from '@/lib/prompt-context';

// Fichier d'exemple à joindre à la consigne : un cours du même niveau et de la même matière si possible
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !u.roles.includes('admin')) return new Response('Non autorisé', { status: 403 });
  const course = Number(new URL(req.url).searchParams.get('cours'));
  const [c] = Number.isInteger(course) && course > 0 ? await sql<{ level_code: string; subject: string }[]>`
    select s.level_code, s.name as subject from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id where c.id = ${course}` : [];
  const ex = c ? pickExample(c.level_code, c.subject) : pickExample('seconde-generale', '');
  return new Response(ex.text, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${ex.code}.json"` } });
}
