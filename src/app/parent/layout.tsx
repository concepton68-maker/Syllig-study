import { requireUser, spacesFor } from '@/lib/auth';
import { sql } from '@/lib/db';
import { Shell } from '@/components/Shell';

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('parent');
  // « À faire » : copies à valider et demandes d'évaluation, pour tous les enfants du foyer
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from eval_attempts a join students s on s.id = a.student_id
    where a.status in ('submitted', 'requested')
      and s.household_id in (select household_id from household_members where user_id = ${u.id} and role = 'parent')`;
  return (
    <Shell role="Parent" spaces={spacesFor(u, 'parent')} nav={[
      { href: '/parent', label: 'Accueil', exact: true },
      { href: '/parent/a-faire', label: n ? `À faire (${n})` : 'À faire' },
      { href: '/parent/journal', label: 'Activité' },
      { href: '/parent/enfants', label: 'Enfants' },
    ]} right={<span className="text-sm font-semibold">{u.display_name}</span>}>
      {children}
    </Shell>
  );
}
