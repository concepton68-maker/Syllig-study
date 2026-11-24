import { requireUser, spacesFor } from '@/lib/auth';
import { sql } from '@/lib/db';
import { Shell } from '@/components/Shell';

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser('parent');
  // « À faire » : copies à valider, demandes d'évaluation et mots de passe oubliés, pour tous les enfants du foyer
  const [{ n }] = await sql<{ n: number }[]>`with mine as (select s.id, s.user_id from students s
      where s.household_id in (select household_id from household_members where user_id = ${u.id} and role = 'parent'))
    select (select count(*)::int from eval_attempts a where a.student_id in (select id from mine) and a.status in ('submitted', 'requested'))
         + (select count(*)::int from password_requests r where r.user_id in (select user_id from mine) and r.done_at is null) as n`;
  return (
    <Shell role="Parent" spaces={spacesFor(u, 'parent')} nav={[
      { href: '/parent', label: 'Accueil', icon: 'home', exact: true },
      { href: '/parent/a-faire', label: 'À faire', icon: 'todo', badge: n },
      { href: '/parent/journal', label: 'Activité', icon: 'activity' },
      { href: '/parent/enfants', label: 'Enfants', icon: 'children' },
    ]} user={{ name: u.display_name, sub: 'Espace parent' }}>
      {children}
    </Shell>
  );
}
