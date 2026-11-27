import Link from 'next/link';
import { rows, pointText, type WeeklyData } from '@/lib/weekly';

// Le message du lundi, tel qu'il est envoyé par e-mail (maquette validée le 27/11/2026)
export function WeeklyCard({ d, more }: { d: WeeklyData; more?: string }) {
  return (
    <section aria-labelledby={`msg-${d.week_start}`} className="card flex flex-col gap-3.5 border-brand-mid" data-weekly={d.week_start}>
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <h2 id={`msg-${d.week_start}`} className="text-lg font-semibold m-0">La semaine de {d.first_name} <span className="muted font-normal text-sm">· {d.label}</span></h2>
        {more && <Link className="text-sm font-semibold" href={more}>Messages précédents</Link>}
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {rows(d).map(([k, v]) => <div key={k} className="rounded-xl bg-surface-2 px-3.5 py-3"><span className="text-[13px] muted">{k}</span><br /><strong className="text-[15px]">{v}</strong></div>)}
      </div>
      {(d.point || d.idea) && <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {d.point && <div className="rounded-xl bg-warm-soft px-3.5 py-3 flex flex-col gap-1" data-weekly-point><strong className="text-sm text-warm-dark">À regarder avec {d.first_name}</strong><span className="text-[15px]">{pointText(d.point)}</span>
          <Link className="text-sm font-semibold" href={d.point.href}>{d.point.kind === 'copie' ? 'Revoir la copie' : 'Revoir les exercices'} ›</Link></div>}
        {d.idea && <div className="rounded-xl bg-soft px-3.5 py-3 flex flex-col gap-1"><strong className="text-sm">Une idée</strong><span className="text-[15px]">{d.idea}</span></div>}
      </div>}
      <span className="text-xs muted">Uniquement des faits mesurés par la plateforme. Aussi envoyé par e-mail le lundi si vous l’avez demandé (Mon compte).</span>
    </section>
  );
}
