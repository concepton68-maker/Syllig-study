import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

export default async function Home() {
  const u = await currentUser();
  if (!u) redirect('/connexion');
  redirect(u.role === 'student' ? '/eleve' : u.role === 'parent' ? '/parent' : '/contenu');
}
