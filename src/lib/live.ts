import 'server-only';
import { sql } from './db';

// Suivi de l'activité pour le parent : état en direct, frise de la journée, semaine, répartition, indicateurs.
// Tout vient du serveur (signaux toutes les 15 s envoyés par la page de travail de l'élève), jamais de l'horloge de l'élève.

export type LiveState = 'travaille' | 'pause' | 'hors_ligne';
export type Live = {
  state: LiveState; since: string | null; lastSeen: string | null;
  kind: string | null; course: string | null; sessionMin: number; sessionActiveMin: number;
};
export type Segment = { start: string; end: string; state: 'travail' | 'pause'; kind: string; course: string | null };
export type DaySeries = { day: string; label: string; active: number; pause: number };

const ONLINE_S = 45;   // au-delà, plus de signal : l'élève n'est plus sur une page de travail

export async function liveStatus(studentId: string): Promise<Live> {
  const [s] = await sql<{ id: string; kind: string; course: string | null; started_at: Date; last_beat_at: Date; was_active: boolean; open_seconds: number; active_seconds: number; fresh: boolean }[]>`
    select w.id, w.kind, c.title as course, w.started_at, w.last_beat_at, w.was_active, w.open_seconds, w.active_seconds,
      w.ended_at is null and w.last_beat_at > now() - make_interval(secs => ${ONLINE_S}) as fresh
    from work_sessions w left join courses c on c.id = w.course_id
    where w.student_id = ${studentId} order by w.last_beat_at desc limit 1`;
  if (!s) return { state: 'hors_ligne', since: null, lastSeen: null, kind: null, course: null, sessionMin: 0, sessionActiveMin: 0 };
  if (!s.fresh) return { state: 'hors_ligne', since: s.last_beat_at.toISOString(), lastSeen: s.last_beat_at.toISOString(), kind: s.kind, course: s.course, sessionMin: 0, sessionActiveMin: 0 };
  // depuis quand dans cet état : dernier signal de l'autre état dans la séance
  const [chg] = await sql<{ at: Date }[]>`select at from activity_beats where session_id = ${s.id} and active <> ${s.was_active} order by at desc limit 1`;
  return {
    state: s.was_active ? 'travaille' : 'pause', since: (chg?.at ?? s.started_at).toISOString(), lastSeen: s.last_beat_at.toISOString(),
    kind: s.kind, course: s.course, sessionMin: Math.round(s.open_seconds / 60), sessionActiveMin: Math.round(s.active_seconds / 60),
  };
}

// Frise d'une journée (heure de Paris) : blocs de travail effectif et de pause, fusionnés quand ils se suivent
export async function dayTimeline(studentId: string, day?: string): Promise<{ day: string; segments: Segment[]; active: number; pause: number }> {
  const d = day ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const beats = await sql<{ at: Date; seconds: number; active: boolean; kind: string; course: string | null; session_id: string }[]>`
    select b.at, b.seconds, b.active, w.kind, c.title as course, b.session_id from activity_beats b
    join work_sessions w on w.id = b.session_id left join courses c on c.id = w.course_id
    where b.student_id = ${studentId} and (b.at at time zone 'Europe/Paris')::date = ${d}::date order by b.at`;
  const segs: Segment[] = [];
  let active = 0, pause = 0;
  for (const b of beats) {
    if (!b.seconds) continue;
    const state = b.active ? 'travail' : 'pause';
    if (b.active) active += b.seconds; else pause += b.seconds;
    const start = new Date(b.at.getTime() - b.seconds * 1000);
    const last = segs.at(-1);
    if (last && last.state === state && last.kind === b.kind && last.course === b.course && start.getTime() - new Date(last.end).getTime() <= 20_000) last.end = b.at.toISOString();
    else segs.push({ start: start.toISOString(), end: b.at.toISOString(), state, kind: b.kind, course: b.course });
  }
  return { day: d, segments: segs, active, pause };
}

// 7 derniers jours : travail effectif et pauses par jour (totaux des séances, donc aussi l'historique d'avant les signaux)
export async function lastDays(studentId: string, n = 7): Promise<DaySeries[]> {
  const rows = await sql<{ day: string; active: number; open: number }[]>`
    with d as (select generate_series(0, ${n - 1}) as i)
    select to_char(((now() at time zone 'Europe/Paris')::date - d.i), 'YYYY-MM-DD') as day,
      coalesce(sum(w.active_seconds), 0)::int as active, coalesce(sum(w.open_seconds), 0)::int as open
    from d left join work_sessions w on w.student_id = ${studentId} and (w.started_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date - d.i
    group by d.i order by d.i desc`;
  return rows.map(r => ({ day: r.day, active: r.active, pause: Math.max(0, r.open - r.active),
    label: new Date(`${r.day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) }));
}

// Répartition du travail effectif (30 derniers jours) par activité et par matière ; indicateurs de la semaine
export async function breakdown(studentId: string) {
  const byKind = await sql<{ kind: string; s: number }[]>`
    select kind, sum(active_seconds)::int as s from work_sessions where student_id = ${studentId} and started_at > now() - interval '30 days' group by kind order by 2 desc`;
  const bySubject = await sql<{ subject: string; s: number }[]>`
    select coalesce(sj.name, 'Autre') as subject, sum(w.active_seconds)::int as s from work_sessions w
    left join courses c on c.id = w.course_id left join chapters ch on ch.id = c.chapter_id left join subjects sj on sj.id = ch.subject_id
    where w.student_id = ${studentId} and w.started_at > now() - interval '30 days' group by 1 having sum(w.active_seconds) > 0 order by 2 desc limit 6`;
  // 7 derniers jours civils (heure de Paris, aujourd'hui compris) : la même fenêtre que le graphique des 7 jours
  const [k] = await sql<{ active: number; open: number; sessions: number; days: number; pauses: number; focus: number }[]>`
    with b as (select (((now() at time zone 'Europe/Paris')::date - 6)::timestamp at time zone 'Europe/Paris') as start),
    s as (select * from work_sessions where student_id = ${studentId} and started_at >= (select start from b)),
    d as (select (started_at at time zone 'Europe/Paris')::date as day, sum(active_seconds) as a from s group by 1)
    select coalesce((select sum(active_seconds) from s), 0)::int as active, coalesce((select sum(open_seconds) from s), 0)::int as open,
      (select count(*) from s where open_seconds > 0)::int as sessions,
      (select count(*) from d where a >= 60)::int as days, coalesce((select sum(idle_pauses) from s), 0)::int as pauses,
      (select coalesce(sum(focus_losses), 0)::int from eval_attempts where student_id = ${studentId} and started_at >= (select start from b)) as focus`;
  return { byKind, bySubject, week: k };
}
