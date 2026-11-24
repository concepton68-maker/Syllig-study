import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { recentSessions, lookTogether, KIND } from '@/lib/parent-data';
import { hm } from '@/lib/stats';
import { PageTitle } from '@/components/Shell';
import { ChildPicker } from '@/components/ChildPicker';
import { PaneScreen, Panes, Pane } from '@/components/Layout';

export const metadata = { title: 'Journal d’activité' };
export const dynamic = 'force-dynamic';

const EVENT: Record<string, string> = {
  seance_terminee: 'Séance terminée', lecon_terminee: 'Leçon terminée', point_controle_reussi: 'Point de contrôle réussi',
  point_controle_a_reessayer: 'Point de contrôle à réessayer', exercices_remis: 'Exercices remis', exercices_termines: 'Exercices terminés',
  evaluation_commencee: 'Évaluation commencée', evaluation_remise: 'Copie remise', evaluation_remise_automatiquement: 'Copie remise à la fin du temps',
  evaluation_sortie_fenetre: 'Sortie de la fenêtre', evaluation_retour_fenetre: 'Retour dans la fenêtre', evaluation_coller_bloque: 'Collage bloqué',
  evaluation_notee: 'Évaluation notée', evaluation_demandee: 'Évaluation demandée', evaluation_autorisee: 'Évaluation autorisée',
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
  if (d.score_sur_10 !== undefined) p.push(`${d.score_sur_10}/10`);
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

export default async function Journal({ searchParams }: { searchParams: Promise<{ eleve?: string }> }) {
  const { eleve } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  LEVEL_NAMES = Object.fromEntries((await sql<{ code: string; name: string }[]>`select code, name from levels`).map(l => [l.code, l.name]));
  const [chk] = await sql<{ broken_ids: string[]; total: string }[]>`select * from verify_activity_chain(${student.id})`;
  const events = await sql<{ id: string; at: Date; event: string; title: string | null; data: Record<string, unknown>; hash: string }[]>`
    select l.id, l.at, l.event, c.title, l.data, l.hash from activity_log l left join courses c on c.id = l.course_id
    where l.student_id = ${student.id} order by l.id desc limit 200`;
  const sessions = await recentSessions(student.id, 40);
  const intact = chk.broken_ids.length === 0;

  return (
    <PaneScreen top={<>
      <ChildPicker students={students} current={student} path="/parent/journal" />
      <PageTitle kicker="Journal d’activité horodaté" title={`Chaque séance de ${student.first_name}, telle qu’elle s’est passée`}
        sub="Les heures viennent du serveur, pas de l’ordinateur de l’élève. Le journal ne peut pas être modifié après coup.">
        <span className={`pill min-h-8 ${intact ? 'bg-brand-soft text-brand-dark' : 'bg-warm-soft text-warm-dark'}`}>
          {intact ? `Journal intact · ${chk.total} événements vérifiés` : `Journal altéré : ${chk.broken_ids.length} ligne(s)`}
        </span>
      </PageTitle>
    </>}>
      <Panes>
        <Pane className="flex-[999_1_560px]"><section className="card flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Séances</h2>
          {sessions.length === 0 && <span className="muted text-sm">Aucune séance pour l’instant.</span>}
          {sessions.map(s => {
            const why = lookTogether(s);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
                <span className="w-[150px] font-semibold">{fmt(s.started_at)}</span>
                <span className="flex-[1_1_220px] min-w-0"><strong>{s.title ?? '—'}</strong><span className="block muted">{s.subject ? `${s.subject} · ` : ''}{KIND[s.kind]}</span></span>
                <span className="w-[150px]"><strong>{hm(s.active_seconds)}</strong> actives<span className="block muted">sur {hm(s.open_seconds)} ouvertes</span></span>
                <span className="w-[70px] font-bold">{s.final_score ? `${Number(s.final_score).toLocaleString('fr-FR')}/20` : ''}</span>
                <span className={`pill ${why ? 'bg-warm-soft text-warm-dark' : 'bg-brand-soft text-brand-dark'}`} title={why ?? undefined}>{why ? 'À regarder ensemble' : 'Conforme'}</span>
                {why && <span className="basis-full muted text-[13px] pl-[162px] max-sm:pl-0">{why}</span>}
              </div>
            );
          })}
        </section></Pane>
        <Pane className="flex-[1_1_380px]">
          <section className="card flex flex-col gap-1">
            <h2 className="text-lg font-semibold mb-2">Derniers événements</h2>
            <ol className="list-none m-0 p-0">
              {events.map(e => (
                <li key={e.id} className="flex gap-3 py-2 border-t border-soft text-sm">
                  <span className="w-[112px] shrink-0 muted font-mono text-xs pt-0.5">{e.at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span><strong>{EVENT[e.event] ?? e.event}</strong>{e.title ? ` · ${e.title}` : ''}<span className="block muted text-[13px]">{describe(e.event, e.data)}</span></span>
                </li>
              ))}
            </ol>
          </section>
          <section className="card flex flex-col gap-2">
            <h2 className="text-base font-semibold">Pourquoi ce journal est fiable</h2>
            <span className="muted text-[13px] leading-relaxed">Chaque événement porte l’empreinte du précédent. Effacer ou modifier une ligne casserait la chaîne, ce que la vérification ci-dessus détecterait. La base refuse d’ailleurs toute modification du journal.</span>
            {events[0] && <span className="font-mono text-xs muted break-all">dernier sceau · {events[0].hash.slice(0, 20)}</span>}
          </section>
        </Pane>
      </Panes>
    </PaneScreen>
  );
}
