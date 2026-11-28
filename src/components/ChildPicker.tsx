import type { Student } from '@/lib/access';
import { liveStatus } from '@/lib/live';

// Sélecteur d'enfant (affiché seulement s'il y en a plusieurs), avec un point vert pour celui qui travaille en ce moment
export async function ChildPicker({ students, current, path }: { students: Student[]; current: Student; path: string }) {
  if (students.length < 2) return null;
  const live = await Promise.all(students.map(s => liveStatus(s.id).then(l => l.state).catch(() => 'hors_ligne' as const)));
  return (
    <nav aria-label="Choisir l’enfant" className="flex flex-wrap gap-2" data-child-picker>
      {students.map((s, i) => (
        <a key={s.id} href={`/parent/choisir/${s.id}?suite=${encodeURIComponent(path)}`} aria-current={s.id === current.id ? 'true' : undefined}
          className={`pill text-sm px-3.5 py-2 no-underline inline-flex items-center gap-2 ${s.id === current.id ? 'bg-brand text-white' : 'bg-white border border-line text-ink-2'}`}>
          <span aria-hidden className={`size-2 rounded-full ${live[i] === 'travaille' ? 'bg-[#32D583]' : live[i] === 'pause' ? 'bg-[#f47230]' : 'bg-line-strong'}`} />
          {s.first_name} · {s.level_name}
          {live[i] === 'travaille' && <span className="sr-only">(en train de travailler)</span>}
        </a>
      ))}
    </nav>
  );
}
