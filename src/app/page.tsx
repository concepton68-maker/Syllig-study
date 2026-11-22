import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { currentUser } from '@/lib/auth';

// Accueil : l'élève va à son parcours ; un compte parent + admin retrouve le dernier espace utilisé
export default async function Home() {
  const u = await currentUser();
  if (!u) redirect('/connexion');
  if (u.roles.includes('student')) redirect('/eleve');
  const last = (await cookies()).get('ss_espace')?.value;
  if (last === 'contenu' && u.roles.includes('admin')) redirect('/contenu');
  if (u.roles.includes('parent')) redirect('/parent');
  redirect('/contenu');
}
