import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { checkUnsubscribe } from '@/lib/mailer';

// Désabonnement en un clic des messageries (RFC 8058 : POST « List-Unsubscribe=One-Click »)
export async function POST(req: Request) {
  const p = new URL(req.url).searchParams;
  const u = p.get('u') ?? '', t = p.get('t') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(u) || !checkUnsubscribe(u, t)) return NextResponse.json({ ok: false }, { status: 400 });
  await sql`update users set weekly_email = false where id = ${u}`;
  return NextResponse.json({ ok: true });
}
