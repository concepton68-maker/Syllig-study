import { redirect } from 'next/navigation';
import { requireParent } from '@/lib/access';
// Ancienne adresse : les règles sont dans la fiche de chaque enfant
export default async function Rules() {
  const { student } = await requireParent();
  redirect(student ? `/parent/enfants/${student.id}?onglet=regles` : '/parent/enfants');
}
