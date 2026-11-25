import Link from 'next/link';
import { requireParent } from '@/lib/access';
import { weekReport, hm, type Tone, type Part } from '@/lib/week';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Activité' };
export const dynamic = 'force-dynamic';

// Activité de la semaine (maquette validée par le propriétaire le 25/11/2026) : uniquement des faits mesurés.
const C = { brand: '#2F4FD8', green: '#00b894', lesson: '#257de0', violet: '#6a4ce2', grey: '#98A2B3' };
const SUBJ_COLORS = [C.brand, C.green, '#f47230', C.grey];
const KIND_COLORS: Record<string, string> = { 'Leçons': C.lesson, 'Exercices': C.green, 'Évaluations': C.violet, 'Autre': C.grey };
const TONE: Record<Tone, string> = { ok: 'bg-brand-soft text-brand-dark', warn: 'bg-warm-soft text-warm-dark', neutral: 'bg-soft text-ink-2', none: 'text-muted-2' };
const heat = (m: number) => m === 0 ? '#EEF0F3' : m < 10 ? '#C7D2FE' : m <= 30 ? '#7D93EC' : C.brand;

function Card({ id, title, aside, children, className = '' }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`card flex flex-col gap-3 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id={id} className="text-lg font-semibold m-0">{title}</h2>{aside}</div>
      {children}
    </section>
  );
}

// anneau : une seule valeur (objectif) ou une répartition, avec les valeurs écrites à côté
function Ring({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 60, c = 2 * Math.PI * r, f = Math.min(1, max ? value / max : 0);
  return (
    <svg width="140" height="140" viewBox="0 0 150 150" role="img" aria-label={label} className="shrink-0">
      <circle cx="75" cy="75" r={r} fill="none" stroke="#EEF0F3" strokeWidth="16" />
      {f > 0 && <circle cx="75" cy="75" r={r} fill="none" stroke={C.brand} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${f * c} ${c}`} transform="rotate(-90 75 75)" />}
      <text x="75" y="72" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--color-ink)">{Math.round(f * 100)} %</text>
      <text x="75" y="94" textAnchor="middle" fontSize="12" fill="var(--color-muted)">de l’objectif</text>
    </svg>
  );
}
function Donut({ parts, colors, total }: { parts: Part[]; colors: (p: Part, i: number) => string; total: number }) {
  const r = 60, c = 2 * Math.PI * r, gap = parts.length > 1 ? 2 : 0;
  let acc = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width="140" height="140" viewBox="0 0 150 150" role="img" aria-label={parts.map(p => `${p.label} ${hm(p.minutes)}`).join(', ')} className="shrink-0">
        {total === 0 ? <circle cx="75" cy="75" r={r} fill="none" stroke="#EEF0F3" strokeWidth="22" /> : parts.map((p, i) => {
          const len = (p.minutes / total) * c, el = <circle key={p.label} cx="75" cy="75" r={r} fill="none" stroke={colors(p, i)} strokeWidth="22" strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 75 75)" />;
          acc += len; return el;
        })}
        <text x="75" y="80" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-ink)">{hm(total)}</text>
      </svg>
      <ul className="list-none m-0 p-0 flex flex-col gap-2 text-sm">
        {parts.length === 0 && <li className="muted">Pas de temps actif cette semaine.</li>}
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2"><i className="inline-block size-3 rounded-sm" style={{ background: colors(p, i) }} />{p.label} <strong>{hm(p.minutes)}</strong><span className="muted">({Math.round((p.minutes / Math.max(1, total)) * 100)} %)</span></li>
        ))}
      </ul>
    </div>
  );
}

export default async function Activite({ searchParams }: { searchParams: Promise<{ eleve?: string; semaine?: string }> }) {
  const { eleve, semaine } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  const w = await weekReport(student, semaine);
  const q = (s?: string | null) => `?${new URLSearchParams({ ...(eleve ? { eleve } : {}), ...(s ? { semaine: s } : {}) })}`;
  const name = student.first_name;
  const maxDay = Math.max(60, ...w.days.map(d => d.minutes));
  const totalSubj = w.bySubject.reduce((n, p) => n + p.minutes, 0);

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent/journal" />
      <PageTitle kicker="Activité" title={w.isCurrent ? `La semaine de ${name}` : `La semaine de ${name} (passée)`} sub={`${student.level_name} · ${w.label}`}>
        <nav aria-label="Changer de semaine" className="flex items-center gap-2">
          <Link className="btn min-w-11" href={q(w.prev)} aria-label="Semaine précédente">‹</Link>
          <span className="pill bg-white border border-line text-ink min-h-11 px-4" data-week={w.start}>{w.isCurrent ? 'Cette semaine' : `Semaine du ${new Date(`${w.start}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`}</span>
          {w.next ? <Link className="btn min-w-11" href={q(w.next)} aria-label="Semaine suivante">›</Link> : <span className="btn min-w-11 opacity-40" aria-hidden="true">›</span>}
        </nav>
      </PageTitle>
    </>}>
      <Card id="bref" title="La semaine en 3 lignes">
        <div className="grid gap-4 md:grid-cols-3" data-three-lines>
          <div className="rounded-2xl bg-brand-soft px-4 py-3.5 flex flex-col gap-1.5">
            <span className="lbl text-brand-dark">Ce qui a été fait</span>
            <span className="text-[15.5px] leading-snug"><strong>{w.days_worked} jour{w.days_worked > 1 ? 's' : ''} travaillé{w.days_worked > 1 ? 's' : ''}</strong> sur 7 et <strong>{hm(w.active_min)}</strong> de temps actif, pour un objectif de {hm(w.goal_min)}.</span>
            <span className="text-[13px] muted">{w.courses_count} cours travaillé{w.courses_count > 1 ? 's' : ''} · {w.evals_count} évaluation{w.evals_count > 1 ? 's' : ''} remise{w.evals_count > 1 ? 's' : ''}</span>
          </div>
          <div className={`rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 ${w.point ? 'bg-warm-soft' : 'bg-soft'}`} data-point>
            <span className={`lbl ${w.point ? 'text-warm-dark' : ''}`}>Un point précis</span>
            <span className="text-[15.5px] leading-snug">{w.point?.text ?? 'Rien de particulier à signaler cette semaine.'}</span>
            {w.point?.href && <a className="text-[13px] font-semibold" href={w.point.href}>Voir les questions ratées</a>}
          </div>
          <div className="rounded-2xl bg-soft px-4 py-3.5 flex flex-col gap-1.5" data-idea>
            <span className="lbl">Une idée pour vous</span>
            <span className="text-[15.5px] leading-snug">{w.idea}</span>
            <span className="text-[13px] muted">Lui faire expliquer aide plus que l’aider à faire.</span>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-6 items-stretch">
        <Card id="jours" title="Temps actif, jour par jour" className="flex-[3_1_520px]" aside={<span className="text-sm muted">{hm(w.active_min)} sur {hm(w.goal_min)} d’objectif</span>}>
          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 pt-2" role="img" aria-label={w.days.map(d => `${d.label} : ${d.minutes} min`).join(', ')} data-day-bars>
            {w.days.map(d => (
              <div key={d.day} className="flex flex-col items-center justify-end gap-1.5 h-full">
                <span className="text-xs font-semibold text-ink-2 whitespace-nowrap">{d.minutes ? hm(d.minutes) : '—'}</span>
                <span className="w-3/5 max-w-11 rounded-md" style={{ height: d.minutes ? `${Math.max(4, (d.minutes / maxDay) * 120)}px` : '4px', background: d.minutes === 0 ? '#EEF0F3' : d.minutes < 10 ? '#C7D2FE' : C.brand }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 sm:gap-3 text-center text-xs muted">{w.days.map(d => <span key={d.day}>{d.label}</span>)}</div>
          <span className="text-xs muted">Temps actif : minutes avec un geste sur une page de travail (clic, défilement, saisie). Un jour compte comme travaillé à partir de 10 min.</span>
        </Card>
        <Card id="cal" title="Les 4 dernières semaines" className="flex-[2_1_320px]">
          <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1.5 text-xs muted text-center"><span />{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <span key={i}>{x}</span>)}</div>
          {w.calendar.map(row => (
            <div key={row.label} className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1.5 items-center" data-cal-row>
              <span className="text-xs muted whitespace-nowrap">{row.label}</span>
              {row.cells.map(c => (
                <span key={c.day} data-tip={`${new Date(`${c.day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} : ${c.future ? 'à venir' : c.minutes ? hm(c.minutes) : 'rien'}`} tabIndex={0}
                  className="h-8 rounded-md text-[11px] font-semibold flex items-center justify-center" style={{ background: c.future ? 'transparent' : heat(c.minutes), color: c.minutes > 10 ? '#fff' : '#344054', boxShadow: c.inWeek ? 'inset 0 0 0 2px var(--color-ink)' : undefined, border: c.future ? '1px dashed var(--color-line-strong)' : undefined }}>
                  {c.minutes || ''}
                </span>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap gap-3 text-xs muted items-center">
            {[['#EEF0F3', 'rien'], ['#C7D2FE', 'moins de 10 min'], ['#7D93EC', '10 à 30 min'], [C.brand, 'plus de 30 min']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1"><i className="inline-block size-3 rounded-[3px]" style={{ background: c }} />{l}</span>)}
          </div>
          <span className="text-[13px] text-ink-2">Semaine affichée encadrée · {w.cal_days_worked} jour{w.cal_days_worked > 1 ? 's' : ''} travaillé{w.cal_days_worked > 1 ? 's' : ''} sur 28</span>
        </Card>
      </div>

      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <Card id="objectif" title="Objectif de la semaine">
          <div className="flex items-center gap-5 flex-wrap" data-goal>
            <Ring value={w.active_min} max={w.goal_min} label={`${hm(w.active_min)} sur ${hm(w.goal_min)}`} />
            <div className="flex flex-col gap-1 text-[15px]">
              <span><strong>{hm(w.active_min)}</strong> de temps actif</span>
              <span className="muted">sur {hm(w.goal_min)} fixées par vous</span>
              <span className="muted">{w.active_min >= w.goal_min ? 'objectif atteint' : `reste ${hm(w.goal_min - w.active_min)}`}</span>
            </div>
          </div>
        </Card>
        <Card id="matieres" title="Temps par matière"><Donut parts={w.bySubject} total={totalSubj} colors={(_, i) => SUBJ_COLORS[i] ?? C.grey} /></Card>
        <Card id="activites" title="Temps par activité"><Donut parts={w.byKind} total={w.byKind.reduce((n, p) => n + p.minutes, 0)} colors={p => KIND_COLORS[p.label] ?? C.grey} /></Card>
      </div>

      <Card id="travaille" title="Ce qui a été travaillé" aside={<span className="text-sm muted">un cours par ligne, toute la semaine regroupée</span>}>
        {w.courses.length === 0 ? <p className="m-0 text-sm muted">Aucun cours travaillé cette semaine.</p> : (
          <>
          {/* téléphone : une fiche par cours */}
          <ul className="md:hidden list-none m-0 p-0 flex flex-col gap-3" aria-label="Cours travaillés">
            {w.courses.map(c => (
              <li key={c.course_id} className="rounded-2xl border border-line px-4 py-3 flex flex-col gap-2">
                <span className="flex justify-between gap-3"><span><strong className="block text-[15px] leading-snug">{c.title}</strong><span className="text-[13px] muted">{c.subject}{c.when ? ` · ${c.when}` : ''}</span></span><strong className="whitespace-nowrap">{c.minutes ? hm(c.minutes) : '—'}</strong></span>
                {([['① Leçon', c.lesson], ['② Exercices', c.exercises], ['③ Évaluation', c.evaluation]] as const).map(([l, x]) => (
                  <span key={l} className="flex items-center justify-between gap-3 text-sm"><span className="muted">{l}</span><span className={`pill !whitespace-normal text-right text-[13px] ${TONE[x.tone]}`}>{x.text}</span></span>
                ))}
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto max-md:hidden">
            <div className="min-w-[820px] flex flex-col" data-course-rows>
              <div className="grid grid-cols-[minmax(220px,2fr)_repeat(3,minmax(150px,1fr))_90px] gap-3 py-2 text-xs font-bold tracking-wide muted border-b border-line">
                <span>COURS</span><span>① LEÇON</span><span>② EXERCICES</span><span>③ ÉVALUATION</span><span className="text-right">TEMPS ACTIF</span>
              </div>
              {w.courses.map(c => (
                <div key={c.course_id} data-course={c.course_id} className="grid grid-cols-[minmax(220px,2fr)_repeat(3,minmax(150px,1fr))_90px] gap-3 py-3.5 border-b border-soft items-center">
                  <span className="flex flex-col"><strong className="text-[15px]">{c.title}</strong><span className="text-[13px] muted">{c.subject}{c.when ? ` · ${c.when}` : ''}</span></span>
                  {[c.lesson, c.exercises, c.evaluation].map((x, i) => <span key={i} className={`pill self-start w-fit max-w-full !whitespace-normal leading-snug text-[13px] ${TONE[x.tone]}`}>{x.text}</span>)}
                  <strong className="text-right text-[15px]">{c.minutes ? hm(c.minutes) : '—'}</strong>
                </div>
              ))}
            </div>
          </div>
          </>
        )}
        <Link className="text-sm font-semibold self-start" href={`/parent/journal/detail${eleve ? `?eleve=${eleve}` : ''}`}>Voir le détail minute par minute</Link>
      </Card>

      <div className="flex flex-wrap gap-6 items-stretch">
        <section id="questions" aria-labelledby="ratees" className="card flex-[3_1_520px] min-w-0 flex flex-col gap-3 scroll-mt-4">
          <div><h2 id="ratees" className="text-lg font-semibold m-0">Questions ratées cette semaine</h2><span className="text-sm muted">Sa réponse et la bonne réponse : de quoi en parler ensemble.</span></div>
          {w.missed.length === 0 && <p className="m-0 text-sm muted">Aucune question ratée cette semaine (exercices corrigés par la plateforme et évaluations notées).</p>}
          {w.missed.slice(0, 3).map((m, i) => <MissedCard key={i} m={m} name={name} />)}
          {w.missed.length > 3 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Voir les {w.missed.length} questions ratées</summary>
              <div className="flex flex-col gap-3 mt-3">{w.missed.slice(3).map((m, i) => <MissedCard key={i} m={m} name={name} />)}</div>
            </details>
          )}
        </section>
        <aside aria-label="À venir et à regarder" className="flex-[2_1_320px] min-w-0 flex flex-col gap-6">
          <Card id="avenir" title="À venir">
            {w.upcoming.length === 0 && <p className="m-0 text-sm muted">Rien de prévu pour l’instant.</p>}
            <ul className="list-none m-0 p-0 flex flex-col" data-upcoming>
              {w.upcoming.map((u, i) => (
                <li key={i} className="flex justify-between gap-3 py-2.5 border-t border-soft first:border-t-0 text-sm">
                  <span><strong>{u.kind === 'cours' ? 'Prochain cours' : u.kind === 'retard' ? 'Révision en retard' : 'Révision'}</strong> · {u.title}</span>
                  <span className={`whitespace-nowrap ${u.kind === 'retard' ? 'text-warm-dark font-semibold' : 'muted'}`}>{u.when}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card id="regarder" title="À regarder ensemble">
            {w.look.length === 0 ? <p className="m-0 text-sm muted">Rien cette semaine.</p> : w.look.map((l, i) => <p key={i} className="m-0 text-sm leading-relaxed">{l}</p>)}
            <span className="text-[13px] muted">Uniquement des faits enregistrés par la plateforme, horodatés par le serveur.</span>
          </Card>
        </aside>
      </div>
      <p className="m-0 text-xs muted pb-2">Inspiré de pratiques évaluées : résumé hebdomadaire en 3 lignes (Bergman &amp; Chan 2021 ; Kraft &amp; Rogers 2015), rapports d’usage et questions ratées (IXL, Khan Academy), calendrier d’assiduité. Aucune comparaison avec d’autres élèves.</p>
    </Screen>
  );
}

function MissedCard({ m, name }: { m: { course: string; where: string; question: string; answer: string; correct: string }; name: string }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3 flex flex-col gap-2" data-missed>
      <span className="text-[13px] muted">{m.course} · {m.where}</span>
      <strong className="text-[15px] leading-snug">{m.question}</strong>
      <div className="grid gap-2.5 sm:grid-cols-2 text-sm">
        <span className="rounded-xl bg-warm-soft px-3 py-2"><span className="lbl block text-warm-dark">Réponse de {name}</span>{m.answer}</span>
        <span className="rounded-xl bg-brand-soft px-3 py-2"><span className="lbl block text-brand-dark">Bonne réponse</span>{m.correct}</span>
      </div>
    </div>
  );
}
