import fs from 'node:fs';
import path from 'node:path';
import { currentUser } from '@/lib/auth';

export async function GET() {
  const u = await currentUser();
  if (!u || !u.roles.includes('admin')) return new Response('Non autorisé', { status: 403 });
  const body = fs.readFileSync(path.join(process.cwd(), 'content/seconde-generale/cours/C001.json'));
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="C001.json"' } });
}
