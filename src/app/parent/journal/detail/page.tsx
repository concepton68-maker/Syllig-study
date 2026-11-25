import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { lookTogether, type SessionRow } from '@/lib/parent-data';
import { hm } from '@/lib/stats';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { PaneScreen, Panes, Pane } from '@/components/Layout';

export const metadata = { title: 'Détail de l’activité' };
export const dynamic = 'force-dynamic';

const EVENT: Record<string, string> = {
  bilan_ia: 'Bilan pédagogique demandé à l’IA', consentement_ia: 'Accord pour l’IA modifié', remise_a_niveau_ajoutee: 'Leçon de remise à niveau ajoutée au parcours', positionnement_propose: 'Test de positionnement proposé',
  positionnement_commence: 'Test de positionnement commencé', positionnement_termine: 'Test de positionnement terminé',
  seance_terminee: 'Séance terminée', lecon_terminee: 'Leçon terminée', point_controle_reussi: 'Point de contrôle réussi',
  point_controle_a_reessayer: 'Point de contrôle à réessayer', exercices_remis: 'Exercices remis', exercices_termines: 'Exercices terminés',
  evaluation_commencee: 'Évaluation commencée', evaluation_remise: 'Copie remise', evaluation_remise_automatiquement: 'Copie remise à la fin du temps',
  evaluation_sortie_fenetre: 'Sortie de la fenêtre', evaluation_retour_fenetre: 'Retour dans la fenêtre', evaluation_coller_bloque: 'Collage bloqué',
  revision_faite: 'Révision faite (exercices refaits)', questionnaire_rempli: 'Questionnaire « Comment je travaille » rempli', evaluation_notee: 'Évaluation notée', evaluation_demandee: 'Évaluation demandée', evaluation_autorisee: 'Évaluation autorisée',
  evaluation_reportee: 'Évaluation reportée', niveau_atteint: 'Niveau atteint', copies_exportees: 'Copies exportées pour correction',
  corrections_importees: 'Corrections importées', note_modifiee: 'Note modifiée',
  cours_reinitialise: 'Cours réinitialisé', parcours_reinitialise: 'Parcours réinitialisé',
  niveau_corrige: 'Niveau corrigé', annee_scolaire_commencee: 'Nouvelle année scolaire',
};
let LEVEL_NAMES: Record<string, string> = {};
const fmt = (d: Date) => d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function describe(e: string, d: Record<string, unknown>) {
  const p: string[] = [];
  if (d.partie) p.push(`partie ${d.partie}`);
  if (d.tentative) p.push(`tentative ${d.tentative}`);
  if (d.note !== undefined) p.push(`${String(d.note).replace('.', ',')}/20`);
  if (d.auto_total !== undefined) p.push(`${d.auto_ok} sur ${d.auto_total} corrigés par la plateforme${Number(d.auto_eval_total) ? `, ${d.auto_eval_ok} sur ${d.auto_eval_total} auto-évalués` : ''}`);
  else if (d.score_sur_10 !== undefined) p.push(`${d.score_sur_10}/10`);
  if (d.duree_min !== undefined && d.duree_min !== null) p.push(`${String(d.duree_min).replace('.', ',')} min`);
  if (d.absence_s !== undefined) p.push(`hors de la page ${d.absence_s} s`);
  if (d.actif_s !== undefined) p.push(`${Math.round(Number(d.actif_s) / 60)} min actives sur ${Math.round(Number(d.ouvert_s) / 60)} ouvertes`);
  if (d.libelle) p.push(String(d.libelle));
  if (e === 'niveau_corrige') p.push(`${LEVEL_NAMES[String(d.avant)] ?? d.avant} → ${LEVEL_NAMES[String(d.apres)] ?? d.apres}`);
  if (e === 'annee_scolaire_commencee') p.push(`${d.annee ?? ''} · ${LEVEL_NAMES[String(d.niveau)] ?? d.niveau}`);
  if (d.motif) p.push(`motif : ${d.motif}`);
  if (e === 'evaluation_remise' || e === 'evaluation_remise_automatiquement') { if (Number(d.sorties_fenetre) > 0) p.push(`${d.sorties_fenetre} sortie(s) de fenêtre`); }
  return p.join(' · ');
}

// filtres du journal : familles d'événements
const FILTERS: Record<string, { label: string; match: (e: string) => boolean }> = {
  tout: { label: 'Tout', match: () => true },
  evaluations: { label: 'Évaluations', match: e => e.startsWith('evaluation') || e === 'note_modifiee' || e === 'niveau_atteint' },
  travail: { label: 'Leçons et exercices', match: e => /^(seance|lecon|point_controle|exercices|revision)/.test(e) },
  parent: { label: 'Actions du parent', match: e => /(autorisee|reportee|exportees|importees|reinitialise|niveau_corrige|annee_scolaire|note_modifiee|bilan_ia|positionnement_propose|consentement_ia)/.test(e) },
};
const DAYS = 7;
const PARIS = 'Europe/Paris';
const dayKey = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: PARIS });
const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' });
const dayTitle = (k: string) => {
  const today = dayKey(new Date()), yest = dayKey(new Date(Date.now() - 864e5));
  const label = new Date(`${k}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return k === today ? `Aujourd’hui · ${label}` : k === yest ? `Hier · ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
};
type Ev = { id: string; at: Date; event: string; course_id: number | null; title: string | null; subject: string | null; data: Record<string, unknown>; hash: string };
type Block = { key: string; title: string | null; subject: string | null; events: Ev[]; sessions: SessionRow[] };

// Résumé d'un cours sur une journée : où l'élève en est arrivé, en quelques étiquettes (le détail reste dépliable)
function summary(b: Block) {
  const chips: { text: string; tone?: 'ok' | 'warn' }[] = [];
  const has = (e: string) => b.events.some(x => x.event === e);
  const parts = b.events.filter(x => x.event.startsWith('point_controle')).map(x => Number(x.data.partie ?? 0));
  if (has('lecon_terminee')) chips.push({ text: '① Leçon terminée', tone: 'ok' });
  else if (parts.length) chips.push({ text: `① Leçon : jusqu’à la partie ${Math.max(...parts)}` });
  else if (b.sessions.some(x => x.kind === 'lesson')) chips.push({ text: '① Leçon en cours' });
  const ok = b.events.filter(x => x.event === 'point_controle_reussi').length, ko = b.events.filter(x => x.event === 'point_controle_a_reessayer').length;
  if (ok + ko) chips.push({ text: `Contrôles : ${ok} réussi${ok > 1 ? 's' : ''}${ko ? `, ${ko} à refaire` : ''}`, tone: ko > ok ? 'warn' : undefined });
  const ex = [...b.events].reverse().find(x => x.event === 'exercices_termines' || x.event === 'revision_faite');
  if (ex) chips.push(ex.data.auto_total !== undefined
    ? { text: `② Exercices : ${ex.data.auto_ok} sur ${ex.data.auto_total} corrigés par la plateforme${Number(ex.data.auto_eval_total) ? ` (+ ${ex.data.auto_eval_ok} sur ${ex.data.auto_eval_total} auto-évalués)` : ''}` }
    : { text: `② Exercices ${ex.data.score_sur_10}/10 (auto-évaluation comprise)` });
  else if (has('exercices_remis')) chips.push({ text: '② Exercices remis' });
  else if (b.sessions.some(x => x.kind === 'exercises')) chips.push({ text: '② Exercices en cours' });
  const note = [...b.events].reverse().find(x => x.event === 'evaluation_notee');
  if (note) chips.push({ text: `③ Évaluation ${String(note.data.note).replace('.', ',')}/20`, tone: Number(note.data.note) >= 10 ? 'ok' : 'warn' });
  else if (has('evaluation_remise') || has('evaluation_remise_automatiquement')) chips.push({ text: '③ Copie remise' });
  else if (has('evaluation_demandee')) chips.push({ text: '③ Évaluation demandée' });
  else if (b.sessions.some(x => x.kind === 'evaluation')) chips.push({ text: '③ Évaluation commencée' });
  const lvl = [...b.events].reverse().find(x => x.event === 'niveau_atteint');
  if (lvl) chips.push({ text: `Niveau ${lvl.data.niveau} atteint`, tone: 'ok' });
  return chips;
}

export default async function Journal({ searchParams }: { searchParams: Promise<{ eleve?: string; filtre?: string; avant?: string }> }) {
  const { eleve, filtre: f, avant } = await searchParams;
  const filtre = f && f in FILTERS ? f : 'tout';
  const before = avant && /^\d{4}-\d{2}-\d{2}$/.test(avant) ? avant : null;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  LEVEL_NAMES = Object.fromEntries((await sql<{ code: string; name: string }[]>`select code, name from levels`).map(l => [l.code, l.name]));
  const [chk] = await sql<{ broken_ids: string[]; total: string }[]>`select * from verify_activity_chain(${student.id})`;
  const intact = chk.broken_ids.length === 0;

  // les jours où il s'est passé quelque chose (journal ou séances), par page de 7
  const dayRows = await sql<{ d: string }[]>`
    select to_char(d, 'YYYY-MM-DD') as d from (
      select (at at time zone ${PARIS})::date as d from activity_log where student_id = ${student.id}
      union select (started_at at time zone ${PARIS})::date from work_sessions where student_id = ${student.id} and open_seconds > 0) x
    ${before ? sql`where d < ${before}::date` : sql``} order by d desc limit ${DAYS + 1}`;
  const days = dayRows.slice(0, DAYS).map(r => r.d);
  const more = dayRows.length > DAYS;
  const from = days.at(-1), to = days[0];
  const events = from ? await sql<Ev[]>`
    select l.id, l.at, l.event, l.course_id, c.title, sj.name as subject, l.data, l.hash from activity_log l
    left join courses c on c.id = l.course_id left join chapters ch on ch.id = c.chapter_id left join subjects sj on sj.id = ch.subject_id
    where l.student_id = ${student.id} and (l.at at time zone ${PARIS})::date between ${from}::date and ${to}::date order by l.id` : [];
  const sessions = from ? await sql<SessionRow[]>`
    select w.id, w.started_at, w.kind, w.course_id, c.title, s.name as subject, w.active_seconds, w.open_seconds, w.idle_pauses,
      case w.kind when 'lesson' then (v.document->'lesson'->>'duration_min')::int when 'exercises' then (v.document->'exercises'->>'duration_min')::int
        when 'evaluation' then (v.document->'evaluation'->>'duration_min')::int end as planned_min,
      a.focus_losses, a.focus_lost_seconds, a.paste_blocked, a.final_score
    from work_sessions w
    left join courses c on c.id = w.course_id left join chapters ch on ch.id = c.chapter_id left join subjects s on s.id = ch.subject_id
    left join course_versions v on v.course_id = w.course_id and v.status = 'published'
    left join lateral (select * from eval_attempts e where w.kind = 'evaluation' and e.student_id = w.student_id and e.course_id = w.course_id
      and e.started_at between w.started_at - interval '2 minutes' and coalesce(w.ended_at, w.last_beat_at) + interval '1 minute' order by e.started_at desc limit 1) a on true
    where w.student_id = ${student.id} and w.open_seconds > 0 and (w.started_at at time zone ${PARIS})::date between ${from}::date and ${to}::date
    order by w.started_at` : [];

  // regroupement : jour → cours (un bloc par cours et par jour) ; ce qui n'est pas lié à un cours va dans « Autres événements »
  const byDay = days.map(d => {
    const blocks = new Map<string, Block>();
    const get = (cid: number | null, title: string | null, subject: string | null) => {
      const k = cid === null ? 'hors' : String(cid);
      if (!blocks.has(k)) blocks.set(k, { key: k, title, subject, events: [], sessions: [] });
      return blocks.get(k)!;
    };
    for (const s of sessions.filter(s => dayKey(s.started_at) === d)) get(s.course_id, s.title, s.subject).sessions.push(s);
    for (const e of events.filter(e => dayKey(e.at) === d)) { if (e.event === 'seance_terminee') continue; get(e.course_id, e.title, e.subject).events.push(e); }
    const list = [...blocks.values()].filter(b => filtre === 'tout' || b.events.some(e => FILTERS[filtre].match(e.event)))
      .sort((a, b) => (a.key === 'hors' ? 1 : b.key === 'hors' ? -1 : 0) || (b.events.at(-1)?.at.getTime() ?? b.sessions.at(-1)?.started_at.getTime() ?? 0) - (a.events.at(-1)?.at.getTime() ?? a.sessions.at(-1)?.started_at.getTime() ?? 0));
    const active = sessions.filter(s => dayKey(s.started_at) === d).reduce((n, s) => n + s.active_seconds, 0);
    return { d, list, active };
  });
  const q = (extra: Record<string, string>) => '?' + new URLSearchParams({ ...(eleve ? { eleve } : {}), ...(filtre !== 'tout' ? { filtre } : {}), ...extra }).toString();
  const lastHash = events.at(-1)?.hash;

  return (
    <PaneScreen top={<>
      <ChildPicker students={students} current={student} path="/parent/journal/detail" />
      <PageTitle kicker="Détail minute par minute" title={`Ce que ${student.first_name} a fait, jour par jour`}
        sub="Un bloc par cours et par jour : où il en est arrivé, son temps de travail réel, ce qui mérite d’en parler. Le détail minute par minute se déplie.">
        <a className="btn" href={`/parent/journal${eleve ? `?eleve=${eleve}` : ''}`}>‹ La semaine</a>
        <span className={`pill min-h-8 ${intact ? 'bg-brand-soft text-brand-dark' : 'bg-warm-soft text-warm-dark'}`}>
          {intact ? `Journal intact · ${chk.total} événements vérifiés` : `Journal altéré : ${chk.broken_ids.length} ligne(s)`}
        </span>
      </PageTitle>
    </>}>
      <Panes>
        <Pane className="flex-[999_1_620px]">
          <nav aria-label="Filtrer le journal" className="flex flex-wrap gap-1.5">
            {Object.entries(FILTERS).map(([id, x]) => (
              <a key={id} href={'?' + new URLSearchParams({ ...(eleve ? { eleve } : {}), ...(id !== 'tout' ? { filtre: id } : {}) }).toString()}
                aria-current={filtre === id ? 'true' : undefined}
                className={`pill no-underline ${filtre === id ? 'bg-brand text-white' : 'bg-white border border-line text-ink-2'}`}>{x.label}</a>
            ))}
          </nav>
          {days.length === 0 && <section className="card muted text-sm">Aucune activité pour l’instant.</section>}
          {byDay.map(({ d, list, active }) => (
            <section key={d} className="card !p-0 flex flex-col overflow-hidden" data-day={d}>
              <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 bg-surface-2 border-b border-line">
                <h2 className="text-base font-semibold m-0 mr-auto">{dayTitle(d)}</h2>
                <span className="text-sm muted">{active ? <><strong className="text-ink">{hm(active)}</strong> de travail effectif</> : 'pas de séance de travail'}</span>
              </header>
              {list.length === 0 && <span className="muted text-sm px-5 py-3">Rien de ce type ce jour-là.</span>}
              {list.map(b => {
                const why = b.sessions.map(lookTogether).filter(Boolean) as string[];
                const act = b.sessions.reduce((n, s) => n + s.active_seconds, 0), open = b.sessions.reduce((n, s) => n + s.open_seconds, 0);
                const times = [...b.events.map(e => e.at), ...b.sessions.map(s => s.started_at)].sort((x, y) => x.getTime() - y.getTime());
                const chips = b.key === 'hors' ? [] : summary(b);
                const shown = b.events.filter(e => FILTERS[filtre].match(e.event));
                return (
                  <article key={b.key} className="px-5 py-4 border-t border-soft first-of-type:border-t-0 flex flex-col gap-2" data-course-block={b.key}>
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                      <div className="flex-[1_1_260px] min-w-0">
                        <strong className="block">{b.key === 'hors' ? 'Autres événements' : b.title}</strong>
                        <span className="muted text-sm">{b.key === 'hors' ? 'tests, bilans, réglages' : b.subject}{times.length ? ` · ${hhmm(times[0])}${times.length > 1 && hhmm(times.at(-1)!) !== hhmm(times[0]) ? ` → ${hhmm(times.at(-1)!)}` : ''}` : ''}</span>
                      </div>
                      {act > 0 && <span className="text-sm text-right"><strong>{hm(act)}</strong> effectives<span className="block muted text-xs">sur {hm(open)} de page ouverte</span></span>}
                    </div>
                    {chips.length > 0 && (
                      <ul className="list-none m-0 p-0 flex flex-wrap gap-1.5" aria-label="Où il en est arrivé">
                        {chips.map(c => <li key={c.text} className={`pill text-[13px] ${c.tone === 'ok' ? 'bg-brand-soft text-brand-dark' : c.tone === 'warn' ? 'bg-warm-soft text-warm-dark' : 'bg-soft text-ink-2'}`}>{c.text}</li>)}
                      </ul>
                    )}
                    {why.length > 0 && <span className="text-[13px] rounded-lg bg-warm-soft text-warm-dark px-3 py-1.5 self-start" data-look>À regarder ensemble : {why.join(' · ')}</span>}
                    {shown.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer muted select-none">Détail minute par minute ({shown.length} événement{shown.length > 1 ? 's' : ''})</summary>
                        <ol className="list-none m-0 mt-2 p-0 border-l-2 border-line ml-1">
                          {shown.map(e => (
                            <li key={e.id} className="relative pl-4 py-1">
                              <span className="absolute -left-[5px] top-[11px] w-2 h-2 rounded-full bg-line-strong" aria-hidden="true" />
                              <span className="font-mono text-xs muted mr-2">{hhmm(e.at)}</span><strong className="font-medium">{EVENT[e.event] ?? e.event}</strong>
                              {describe(e.event, e.data) && <span className="muted"> · {describe(e.event, e.data)}</span>}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
          <div className="flex gap-2">
            {before && <a className="btn" href={q({})}>‹ Les plus récents</a>}
            {more && <a className="btn" href={q({ avant: days.at(-1)! })}>Jours précédents ›</a>}
          </div>
        </Pane>
        <Pane className="flex-[1_1_320px]">
          <section className="card flex flex-col gap-2">
            <h2 className="text-base font-semibold">Comment lire ce journal</h2>
            <ul className="m-0 pl-5 text-[13px] text-ink-2 flex flex-col gap-1">
              <li>Un bloc par cours et par jour, du plus récent au plus ancien.</li>
              <li>Le temps « effectif » compte les minutes où l’élève fait un geste sur la page de travail (clic, défilement, saisie) ; après 60 s sans geste, le temps n’est plus compté.</li>
              <li><span className="text-warm-dark font-semibold">À regarder ensemble</span> : sorties de fenêtre pendant une évaluation, leçon survolée.</li>
            </ul>
          </section>
          <section className="card flex flex-col gap-2">
            <h2 className="text-base font-semibold">Pourquoi ce journal est fiable</h2>
            <span className="muted text-[13px] leading-relaxed">Chaque événement porte l’empreinte du précédent. Effacer ou modifier une ligne casserait la chaîne, ce que la vérification ci-dessus détecterait. La base refuse d’ailleurs toute modification du journal. Les heures viennent du serveur, pas de l’ordinateur de l’élève.</span>
            {lastHash && <span className="font-mono text-xs muted break-all">dernier sceau · {lastHash.slice(0, 20)}</span>}
          </section>
        </Pane>
      </Panes>
    </PaneScreen>
  );
}
