import { currentUser } from '@/lib/auth';
import { studentsOfParent } from '@/lib/access';

// Choix de l'enfant suivi : retenu dans un cookie pour toutes les pages parent (on ne revient plus au premier enfant).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  const next = new URL(req.url).searchParams.get('suite') ?? '/parent';
  const safeNext = /^\/parent(\/[\w\-\/]*)?$/.test(next) ? next : '/parent';
  const headers = new Headers({ Location: safeNext });
  if (u && u.roles.includes('parent') && (await studentsOfParent(u.id)).some(s => s.id === id))
    headers.append('Set-Cookie', `ss_eleve=${id}; Path=/parent; Max-Age=31536000; HttpOnly; SameSite=Lax`);
  return new Response(null, { status: 303, headers });
}
