import Link from 'next/link';
import type { Student } from '@/lib/access';

// Sélecteur d'enfant (affiché seulement s'il y en a plusieurs)
export function ChildPicker({ students, current, path }: { students: Student[]; current: Student; path: string }) {
  if (students.length < 2) return null;
  return (
    <nav aria-label="Choisir l’enfant" className="flex flex-wrap gap-2">
      {students.map(s => (
        <Link key={s.id} href={`${path}?eleve=${s.id}`} aria-current={s.id === current.id ? 'true' : undefined}
          className={`pill text-sm px-3.5 py-2 no-underline ${s.id === current.id ? 'bg-brand text-white' : 'bg-white border border-line text-ink-2'}`}>
          {s.first_name} · {s.level_name}
        </Link>
      ))}
    </nav>
  );
}
