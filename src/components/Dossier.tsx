import { GraduationCap, Clock, Star, BookCheck, Award } from 'lucide-react';
import type { SchoolYear, YearSummary } from '@/lib/school-years';

import { duree as hm } from '@/lib/duration';
const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const note = (n: number | null) => n === null ? '—' : `${(Math.round(n * 10) / 10).toLocaleString('fr-FR')}/20`;   // au dixième, comme le Bilan

// Une année du dossier scolaire : en-tête, chiffres clés, avancement par matière
// Chaque chiffre porte sa définition (règle « Mesurer ce qui est sûr ») ; les points de progrès (motivation de l'élève) ne sont montrés qu'à l'élève.
export function YearCard({ year, summary, firstName, audience = 'parent', children }: { year: SchoolYear; summary: YearSummary | null; firstName: string; audience?: 'parent' | 'eleve'; children?: React.ReactNode }) {
  const live = year.status === 'en_cours';
  const s = summary;
  return (
    <section className={`card flex flex-col gap-5 ${live ? 'border-brand-mid' : ''}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className={`kpi-icon ${live ? 'tone-brand' : 'tone-violet'} !w-12 !h-12`}><GraduationCap size={24} aria-hidden="true" /></span>
          <div>
            <span className="lbl">{year.cycle ? `${year.cycle} · ` : ''}Année {year.school_year}</span>
            <h2 className="text-[22px] font-bold m-0 leading-tight">{year.level_name}</h2>
            <span className="muted text-sm">{live ? `Depuis le ${fmt(year.started_at)}` : `Du ${fmt(year.started_at)} au ${fmt(year.ended_at ?? year.started_at)}`}{year.note ? ` · ${year.note}` : ''}</span>
          </div>
        </div>
        <span className={`pill ${live ? 'bg-brand text-white' : 'bg-soft text-ink-2'}`}>{live ? 'Année en cours' : 'Année terminée'}</span>
      </header>

      {s ? (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {s.evaluated !== undefined
              ? <Kpi icon={<BookCheck size={18} />} tone="tone-green" value={`${s.evaluated}`} unit={`/ ${s.published}`} label={`cours évalués · dont ${s.acquired} acquis (14/20 ou plus)`} sub={`depuis l’inscription · ${s.published} disponibles sur ${s.courses_total} au programme`} />
              : <Kpi icon={<BookCheck size={18} />} tone="tone-green" value={`${s.acquired}`} unit={`/ ${s.courses_total}`} label="cours acquis (14/20 ou plus)" sub={`sur ${s.courses_total} au programme`} />}
            <Kpi icon={<Award size={18} />} tone="tone-violet" value={note(s.avg)} label="moyenne des meilleures notes" sub={s.avg_courses !== undefined ? `meilleure note de chaque cours, depuis l’inscription (${s.avg_courses} cours)` : 'meilleure note de chaque cours'} />
            <Kpi icon={<Clock size={18} />} tone="tone-brand" value={hm(s.active_minutes)} label="de travail" sub={`${live ? `depuis le ${fmt(year.started_at)}` : 'sur l’année'} · toutes matières, révisions comprises`} />
            {audience === 'eleve'
              ? <Kpi icon={<Star size={18} />} tone="tone-accent" value={`+${s.points}`} label="points de progrès" />
              : <Kpi icon={<Star size={18} />} tone="tone-accent" value={`${s.evaluations}`} label={`évaluation${s.evaluations > 1 ? 's' : ''} notée${s.evaluations > 1 ? 's' : ''}`} sub="depuis l’inscription, tentatives comprises" />}
          </div>
          <div className="flex flex-col">
            <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] sm:grid-cols-[minmax(140px,1.4fr)_2fr_90px_80px] gap-x-3 px-1 pb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <span>Matière</span><span className="hidden sm:block">Avancement (cours disponibles)</span><span className="text-right">Acquis</span><span className="text-right" data-tip="moyenne des meilleures notes de chaque cours, depuis l’inscription" tabIndex={0}>Meill. notes</span>
            </div>
            {s.subjects.map(m => {
              const pct = m.published ? Math.round((m.acquired / m.published) * 100) : 0;
              const started = m.published ? Math.round((m.started / m.published) * 100) : 0;
              return (
                <div key={m.subject_id} className={`grid grid-cols-[minmax(0,1fr)_64px_64px] sm:grid-cols-[minmax(140px,1.4fr)_2fr_90px_80px] gap-x-3 gap-y-1.5 items-center px-1 py-2.5 border-t border-line text-sm ${m.followed ? '' : 'opacity-55'}`}>
                  <span className="font-semibold min-w-0 truncate">{m.subject}{!m.followed && <span className="pill bg-soft text-muted ml-2">non suivie</span>}</span>
                  <span className="h-2.5 bg-track rounded-full overflow-hidden relative col-span-3 sm:col-span-1 order-last sm:order-none" aria-label={`${pct} % acquis, ${started} % commencés`}>
                    <span className="absolute inset-y-0 left-0 rounded-full bg-brand-mid" style={{ width: `${started}%` }} />
                    <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-right num" data-tip={`${m.acquired} acquis sur ${m.published} cours disponibles (${m.total} au programme)`} tabIndex={0}>{m.acquired} / {m.published}</span>
                  <span className="text-right num">{note(m.avg)}</span>
                </div>
              );
            })}
          </div>
          <p className="muted text-xs m-0">{live ? `Bilan en direct de l’année de ${firstName}. Il sera figé et archivé dans le dossier au passage dans l’année suivante.` : 'Bilan figé à la clôture de l’année.'}</p>
        </>
      ) : <p className="muted text-sm m-0">Pas de bilan enregistré pour cette année.</p>}
      {children}
    </section>
  );
}

function Kpi({ icon, tone, value, unit, label, sub }: { icon: React.ReactNode; tone: string; value: string; unit?: string; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 border border-line px-4 py-3 flex items-center gap-3">
      <span className={`kpi-icon ${tone} !w-9 !h-9`} aria-hidden="true">{icon}</span>
      <span className="flex flex-col leading-tight"><strong className="num text-lg">{value}{unit && <span className="muted text-sm font-semibold"> {unit}</span>}</strong><span className="muted text-xs">{label}</span>{sub && <span className="muted text-[11px]">{sub}</span>}</span>
    </div>
  );
}
