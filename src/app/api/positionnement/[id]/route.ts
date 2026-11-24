import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { placementFor, deadline, GRACE_S } from '@/lib/placement';

// Enregistrement des réponses du test de positionnement au fil de l'eau (fusion : rien n'est jamais écrasé par une page en retard)
const Body = z.object({ answers: z.record(z.string().max(12), z.string().max(500)) });
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u?.roles.includes('student')) return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const [st] = await sql<{ id: string }[]>`select id from students where user_id = ${u.id}`;
  const t = st ? await placementFor(st.id, (await params).id) : null;
  if (!t) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  if (t.status !== 'en_cours' || (deadline(t) ?? 0) + GRACE_S * 1000 < Date.now()) return NextResponse.json({ error: 'test terminé' }, { status: 409 });
  let body; try { body = Body.parse(JSON.parse(await req.text())); } catch { return NextResponse.json({ error: 'requête invalide' }, { status: 400 }); }
  await sql`update placement_tests set answers = answers || ${sql.json(body.answers)} where id = ${t.id} and status = 'en_cours'`;
  return NextResponse.json({ ok: true });
}
