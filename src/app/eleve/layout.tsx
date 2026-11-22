import Link from 'next/link';
import { requireStudent } from '@/lib/access';
import { Shell } from '@/components/Shell';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student } = await requireStudent();
  return (
    <Shell role="Élève" theme={student.settings.theme} nav={[
      { href: '/eleve', label: 'Aujourd’hui', exact: true },
      { href: '/eleve/parcours', label: 'Mon parcours' },
      { href: '/eleve/resultats', label: 'Mes résultats' },
    ]} right={<>
      <Link href="/eleve/theme" className="navlink" aria-label="Changer de thème d’affichage">Mon thème</Link>
      <span className="text-sm font-semibold">{student.first_name} · {student.level_name}</span>
    </>}>
      {children}
    </Shell>
  );
}
