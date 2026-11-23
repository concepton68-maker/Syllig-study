import { requireStudent } from '@/lib/access';
import { Shell } from '@/components/Shell';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student } = await requireStudent();
  return (
    <Shell role="Élève" theme={student.settings.theme} nav={[
      { href: '/eleve', label: 'Aujourd’hui', icon: 'today', exact: true },
      { href: '/eleve/parcours', label: 'Mes cours', short: 'Cours', icon: 'courses' },
      { href: '/eleve/resultats', label: 'Mes résultats', short: 'Résultats', icon: 'results' },
      { href: '/eleve/theme', label: 'Mon espace', short: 'Mon espace', icon: 'space' },
    ]} user={{ name: student.first_name, sub: student.level_name }}>
      {children}
    </Shell>
  );
}
