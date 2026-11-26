import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { hm } from '@/lib/stats';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';
import Link from 'next/link';

export const metadata = { title: 'Détail de l’activité' };
export const dynamic = 'force-dynamic';

const EVENT: Record<string, string> = {
  bilan_ia: 'Bilan pédagogique demandé à l’IA', consentement_ia: 'Accord pour l’IA modifié', remise_a_niveau_ajoutee: 'Leçon de remise à niveau ajoutée au parcours', positionnement_propose: 'Test de positionnement proposé',
  positionnement_commence: 'Test de positionnement commencé', positionnement_termine: 'Test de positionnement terminé',
  seance_terminee: 'Séance terminée', seance_fermee_sans_reponse: 'Séance fermée : pas de réponse à « Tu es là ? »', lecon_passee: 'Passée pour l’instant', lecon_terminee: 'Leçon terminée', point_controle_reussi: 'Point de contrôle réussi',
  point_controle_a_reessayer: 'Point de contrôle à réessayer', exercices_remis: 'Exercices remis', exercices_termines: 'Exercices terminés',
  evaluation_commencee: 'Évaluation commencée', evaluation_remise: 'Copie remise', evaluation_remise_automatiquement: 'Copie remise à la fin du temps',
  evaluation_sortie_fenetre: 'Sortie de la fenêtre', evaluation_retour_fenetre: 'Retour dans la fenêtre', evaluation_coller_bloque: 'Collage bloqué',
  revision_faite: 'Révision faite (exercices refaits)', revision_espacee: 'Révision espacée', questionnaire_rempli: 'Questionnaire « Comment je travaille » rempli', evaluation_notee: 'Évaluation notée', evaluation_demandee: 'Évaluation demandée', evaluation_autorisee: 'Évaluation autorisée',
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
  if (d.actif_s !== undefined) p.push(`${Math.floor(Number(d.actif_s) / 60)} min de travail`);
  if (d.retire_s !== undefined && Number(d.retire_s) >= 60) p.push(`${Math.floor(Number(d.retire_s) / 60)} min sans geste non comptées`);
  if (d.libelle) p.push(String(d.libelle));
  if (e === 'niveau_corrige') p.push(`${LEVEL_NAMES[String(d.avant)] ?? d.avant} → ${LEVEL_NAMES[String(d.apres)] ?? d.apres}`);
  if (e === 'annee_scolaire_commencee') p.push(`${d.annee ?? ''} · ${LEVEL_NAMES[String(d.niveau)] ?? d.niveau}`);
  if (d.motif) p.push(`motif : ${d.motif}`);
  if (e === 'evaluation_remise' || e === 'evaluation_remise_automatiquement') { if (Number(d.sorties_fenetre) > 0) p.push(`${d.sorties_fenetre} sortie(s) de fenêtre`); }
  return p.join(' · ');
}

const DAYS = 7;
const PARIS = 'Europe/Paris';
const dayKey = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: PARIS });
const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' });
const dayTitle = (k: string) => {
  const label = new Date(`${k}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
type Ev = { id: string; at: Date; event: string; title: string | null; data: Record<string, unknown> };

// Détail minute par minute (simplifié le 26/11/2026 à la demande du propriétaire) : la trace exacte, une ligne par événement,
// regroupée par jour. Aucune étiquette d'interprétation : le résumé et « Revoir » sont dans l'Activité.
export default async function Journal({ searchParams }: { searchParams: Promise<{ eleve?: string; avant?: string }> }) {
  const { eleve, avant } = await searchParams;
  const before = avant && /^\d{4}-\d{2}-\d{2}$/.test(avant) ? avant : null;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  LEVEL_NAMES = Object.fromEntries((await sql<{ code: string; name: string }[]>`select code, name from levels`).map(l => [l.code, l.name]));
  const [chk] = await sql<{ broken_ids: string[]; total: string }[]>`select * from verify_activity_chain(${student.id})`;
  const intact = chk.broken_ids.length === 0;
  const dayRows = await sql<{ d: string }[]>`
    select to_char(d, 'YYYY-MM-DD') as d from (
      select (at at time zone ${PARIS})::date as d from activity_log where student_id = ${student.id}
      union select (started_at at time zone ${PARIS})::date from work_sessions where student_id = ${student.id} and open_seconds > 0) x
    ${before ? sql`where d < ${before}::date` : sql``} order by d desc limit ${DAYS + 1}`;
  const days = dayRows.slice(0, DAYS).map(r => r.d);
  const more = dayRows.length > DAYS;
  const from = days.at(-1), to = days[0];
  const events = from ? await sql<Ev[]>`
    select l.id, l.at, l.event, c.title, l.data from activity_log l left join courses c on c.id = l.course_id
    where l.student_id = ${student.id} and (l.at at time zone ${PARIS})::date between ${from}::date and ${to}::date order by l.id` : [];
  // temps de travail du jour (même calcul que l'Activité) et rythme : part du temps de travail avec un geste dans la minute
  const totals = from ? await sql<{ d: string; s: number; g: number | null; gs: number }[]>`
    select to_char((started_at at time zone ${PARIS})::date, 'YYYY-MM-DD') as d, sum(active_seconds)::int as s,
      sum(gesture_seconds) filter (where gesture_seconds is not null)::int as g, coalesce(sum(active_seconds) filter (where gesture_seconds is not null), 0)::int as gs
    from work_sessions where student_id = ${student.id} and (started_at at time zone ${PARIS})::date between ${from}::date and ${to}::date group by 1` : [];
  const q = (p: Record<string, string>) => `?${new URLSearchParams({ ...(eleve ? { eleve } : {}), ...p })}`;

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent/journal/detail" />
      <PageTitle kicker="Détail minute par minute" title={`La trace de ${student.first_name}`} sub={intact ? `Journal intact · ${chk.total} événements vérifiés` : `Journal altéré : ${chk.broken_ids.length} ligne(s)`}>
        <Link className="btn" href={`/parent/journal${eleve ? `?eleve=${eleve}` : ''}`}>‹ La semaine</Link>
      </PageTitle>
    </>}>
      {days.length === 0 && <p className="card m-0 text-sm muted">Rien d’enregistré pour l’instant.</p>}
      {days.map((d, i) => {
        const ev = events.filter(e => dayKey(e.at) === d);
        const t = totals.find(x => x.d === d);
        const min = Math.floor((t?.s ?? 0) / 60);
        const rythm = t && t.g !== null && t.gs >= 300 ? Math.round((t.g / t.gs) * 100) : null;
        return (
          <details key={d} open={i === 0} className="card" data-day={d}>
            <summary className="cursor-pointer flex flex-wrap justify-between gap-x-4 gap-y-1 items-baseline">
              <strong className="text-[15px]">{dayTitle(d)}</strong>
              <span className="text-sm muted">{min ? `${hm(min * 60)} de travail` : 'pas de travail'}{rythm !== null ? ` · rythme ${rythm} %` : ''} · {ev.length} événement{ev.length > 1 ? 's' : ''}</span>
            </summary>
            <ol className="list-none m-0 mt-3 p-0 flex flex-col text-sm">
              {ev.map(e => (
                <li key={e.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 py-1.5 border-t border-soft" data-event={e.event}>
                  <span className="muted tabular-nums">{hhmm(e.at)}</span>
                  <span>{e.title && <strong>{e.title} · </strong>}{EVENT[e.event] ?? e.event}{(() => { const x = describe(e.event, e.data ?? {}); return x ? <span className="muted"> · {x}</span> : null; })()}</span>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
      <p className="m-0 text-xs muted">Temps de travail : page de travail visible à l’écran ; il s’arrête si la page est cachée ou après {Math.round(student.settings.idle_seconds / 60)} min sans rien toucher ; si personne ne répond alors à « Tu es là ? » dans les 60 s, la séance se ferme et ces minutes ne sont pas comptées. Rythme (au moins 5 min de travail mesurées) : part de ce temps avec un geste (clic, défilement, saisie, souris ou toucher) dans la minute ; ni bon ni mauvais en soi, mesuré depuis le 26/11/2026. Chaque événement porte l’empreinte du précédent : une ligne effacée ou modifiée serait détectée. Heures du serveur.</p>
      {more && <Link className="btn self-start" href={q({ avant: days.at(-1)! })}>Jours précédents ›</Link>}
    </Screen>
  );
}
