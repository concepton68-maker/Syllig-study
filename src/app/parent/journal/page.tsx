import Link from 'next/link';
import { requireParent } from '@/lib/access';
import { weekReport, hm } from '@/lib/week';
import { weekTimeline, type Kind } from '@/lib/review';
import { pauseRuleSince, ruleNote } from '@/lib/time-rule';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Activité' };
export const dynamic = 'force-dynamic';

// Activité de la semaine (maquette validée par le propriétaire le 26/11/2026) : 3 chiffres, puis ce qui a été fait, jour par jour,
// avec « Revoir » sur chaque série d'exercices et chaque copie. Uniquement des faits enregistrés.
const ICON: Record<Kind, { letter: string; cls: string; label: string }> = {
  lesson: { letter: 'L', cls: 'bg-brand-soft text-brand-dark', label: 'Leçon' },
  exercises: { letter: 'E', cls: 'bg-[#E7F8EE] text-[#1B5E3A]', label: 'Exercices' },
  evaluation: { letter: 'É', cls: 'bg-warm-soft text-warm-dark', label: 'Évaluation' },
  review: { letter: 'R', cls: 'bg-[#F1ECFF] text-[#5B3CC4]', label: 'Révision' },
  other: { letter: '·', cls: 'bg-soft text-ink-2', label: 'Autre' },
};
const FILTERS: { id: string; label: string; kind?: Kind }[] = [
  { id: '', label: 'Tout' }, { id: 'lecons', label: 'Leçons', kind: 'lesson' }, { id: 'exercices', label: 'Exercices', kind: 'exercises' }, { id: 'evaluations', label: 'Évaluations', kind: 'evaluation' }, { id: 'revisions', label: 'Révisions et entraînements', kind: 'review' },
];
const dayName = (d: string) => { const s = new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };

export default async function Activite({ searchParams }: { searchParams: Promise<{ eleve?: string; semaine?: string; type?: string }> }) {
  const { eleve, semaine, type } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  const w = await weekReport(student, semaine);
  const timeline = await weekTimeline(student.id, w.start);
  const ruleAt = await pauseRuleSince();
  const weekNote = ruleAt && ruleAt.getTime() > new Date(`${w.start}T00:00:00+01:00`).getTime() ? ruleNote(ruleAt) : null;
  const filter = FILTERS.find(f => f.id === (type ?? '')) ?? FILTERS[0];
  const q = (s?: string | null, t?: string) => `?${new URLSearchParams({ ...(eleve ? { eleve } : {}), ...(s ? { semaine: s } : {}), ...(t ? { type: t } : {}) })}`;
  const name = student.first_name;
  const pct = w.goal_min ? Math.min(1, w.active_min / w.goal_min) : 0;
  const R = 26, L = 2 * Math.PI * R;
  const maxSubj = Math.max(1, ...w.bySubject.map(p => p.minutes));

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent/journal" />
      <PageTitle kicker="Activité" title={`La semaine de ${name}`} sub={w.label}>
        <nav aria-label="Changer de semaine" className="flex items-center gap-2">
          <Link className="btn min-w-11" href={q(w.prev, filter.id)} aria-label="Semaine précédente">‹</Link>
          <span className="pill bg-white border border-line text-ink min-h-11 px-4" data-week={w.start}>{w.isCurrent ? 'Cette semaine' : `Semaine du ${new Date(`${w.start}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`}</span>
          {w.next ? <Link className="btn min-w-11" href={q(w.next, filter.id)} aria-label="Semaine suivante">›</Link> : <span className="btn min-w-11 opacity-40" aria-hidden="true">›</span>}
        </nav>
      </PageTitle>
    </>}>
      <section aria-label="La semaine en chiffres" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <div className="card flex items-center gap-4" data-goal>
          <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${hm(w.active_min)} sur ${hm(w.goal_min)}, ${Math.floor(pct * 100)} %`} className="shrink-0">
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--color-track)" strokeWidth="8" />
            {pct > 0 && <circle cx="32" cy="32" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${pct * L} ${L}`} transform="rotate(-90 32 32)" />}
          </svg>
          <span className="flex flex-col"><span className="text-[13px] muted">Temps de travail</span><strong className="text-[22px]">{hm(w.active_min)}</strong><span className="text-[13px] muted">objectif {hm(w.goal_min)}</span></span>
        </div>
        <div className="card flex flex-col gap-2.5" data-days>
          <span className="text-[13px] muted">Jours travaillés <span className="text-[12px]">(10 min ou plus)</span></span>
          <span className="flex items-center gap-3 flex-wrap"><strong className="text-[22px]">{w.days_worked} / 7</strong>
            <span className="flex gap-1.5">{w.days.map(d => (
              <span key={d.day} data-tip={`${dayName(d.day)} : ${d.minutes ? hm(d.minutes) : 'rien'}`} tabIndex={0}
                className={`size-[22px] rounded-md text-[11px] font-semibold grid place-items-center ${d.minutes >= 10 ? 'bg-brand text-white' : 'bg-track text-ink-2'}`}>{d.label.charAt(0).toUpperCase()}</span>
            ))}</span>
          </span>
        </div>
        <div className="card flex flex-col gap-2.5" data-subjects>
          <span className="text-[13px] muted">Par matière</span>
          {w.bySubject.length === 0 ? <span className="text-sm muted">Pas de temps de travail.</span> : (
            <ul className="list-none m-0 p-0 flex flex-col gap-1.5 text-[13px]">
              {w.bySubject.map(p => (
                <li key={p.label} className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-2">
                  <span className="truncate">{p.label}</span>
                  <span className="h-2 rounded bg-track"><span className="block h-2 rounded bg-brand" style={{ width: `${(p.minutes / maxSubj) * 100}%` }} /></span>
                  <span className="tabular-nums text-right">{hm(p.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {weekNote && <p className="m-0 -mt-3 text-xs muted" data-rule-note>{weekNote}</p>}

      <section aria-labelledby="fil" className="card flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <h2 id="fil" className="text-lg font-semibold m-0">Ce que {name} a fait</h2>
          <nav aria-label="Filtrer" className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => <Link key={f.id} href={q(semaine ? w.start : null, f.id)} aria-current={f.id === filter.id ? 'page' : undefined} data-type={f.id || 'tout'}
              className={`btn rounded-full min-h-10 px-3.5 text-sm ${f.id === filter.id ? 'btn-primary' : ''}`}>{f.label}</Link>)}
          </nav>
        </div>
        {timeline.map(d => {
          const items = d.items.filter(i => !filter.kind || i.kind === filter.kind);
          if (filter.kind && items.length === 0) return null;
          return (
            <div key={d.day} className="border-t border-line py-3 flex flex-col gap-1.5" data-day={d.day}>
              <div className="flex justify-between text-sm"><strong>{dayName(d.day)}</strong><span className="muted">{d.minutes ? hm(d.minutes) : ''}</span></div>
              {items.length === 0 && <span className="text-sm muted">Rien ce jour-là</span>}
              {items.map(it => (
                <div key={it.key} data-item={it.kind} className="grid grid-cols-[44px_36px_minmax(0,1fr)] sm:grid-cols-[52px_36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-2.5 py-2 rounded-xl bg-surface-2">
                  <span className="text-[13px] muted tabular-nums">{it.time}</span>
                  <span className={`size-9 rounded-[10px] grid place-items-center font-bold ${ICON[it.kind].cls}`} aria-label={ICON[it.kind].label}>{ICON[it.kind].letter}</span>
                  <span className="min-w-0 flex flex-col"><span className="text-[15px] font-semibold leading-snug">{it.title}</span>
                    <span className="text-[13px] muted">{[it.subject, it.what, it.minutes === null ? null : it.minutes ? hm(it.minutes) : 'moins d’1 min'].filter(Boolean).join(' · ')}</span></span>
                  <span className="flex items-center gap-2.5 justify-end col-span-3 sm:col-span-1">
                    {it.result && <strong className={`text-[15px] tabular-nums whitespace-nowrap ${it.warn ? 'text-warm-dark' : ''}`} data-result>{it.result}</strong>}
                    {it.href && <Link className="btn btn-primary min-h-10" href={it.href}>Revoir</Link>}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        <Link className="text-sm font-semibold self-start pt-2" href={`/parent/journal/detail?${new URLSearchParams({ ...(eleve ? { eleve } : {}), avant: w.next ?? '' }).toString().replace(/&?avant=$/, '')}`}>Voir le détail minute par minute</Link>
      </section>
    </Screen>
  );
}
