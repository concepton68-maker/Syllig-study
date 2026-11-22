import { currentUser } from '@/lib/auth';

// Bascule d'espace (famille / contenu) : retient le choix pour la prochaine connexion.
// Redirection relative : fonctionne derrière le proxy HTTPS sans connaître le domaine.
export async function GET(_: Request, { params }: { params: Promise<{ nom: string }> }) {
  const { nom } = await params;
  const u = await currentUser();
  const contenu = nom === 'contenu';
  const allowed = !!u && u.roles.includes(contenu ? 'admin' : 'parent');
  const headers = new Headers({ Location: allowed ? (contenu ? '/contenu' : '/parent') : '/' });
  if (allowed) headers.append('Set-Cookie', `ss_espace=${contenu ? 'contenu' : 'famille'}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
  return new Response(null, { status: 303, headers });
}
