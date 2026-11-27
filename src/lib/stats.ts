import 'server-only';
import { sql } from './db';

// Un « jour travaillé » : au moins 10 minutes de temps de travail cumulé dans la journée (heure de Paris). Même seuil partout.
export const WORK_DAY_S = 600;

const WEEK_START = sql`(date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')`;

export type DayStat = { day: string; active: number; open: number };

export async function weekStats(studentId: string) {
  const days = await sql<DayStat[]>`
    with d as (select generate_series(0, 6) as i)
    select to_char((date_trunc('week', now() at time zone 'Europe/Paris') + make_interval(days => d.i))::date, 'YYYY-MM-DD') as day,
      coalesce(sum(w.active_seconds), 0)::int as active, coalesce(sum(w.open_seconds), 0)::int as open
    from d left join work_sessions w on w.student_id = ${studentId}
      and (w.started_at at time zone 'Europe/Paris')::date = (date_trunc('week', now() at time zone 'Europe/Paris') + make_interval(days => d.i))::date
    group by d.i order by d.i`;
  const active = days.reduce((s, d) => s + d.active, 0);
  const open = days.reduce((s, d) => s + d.open, 0);
  const [{ week_points, total_points }] = await sql<{ week_points: number; total_points: number }[]>`
    select coalesce(sum(amount) filter (where at >= ${WEEK_START}), 0)::int as week_points, coalesce(sum(amount), 0)::int as total_points
    from points_ledger where student_id = ${studentId}`;
  return { days, active, open, activeDays: days.filter(d => d.active >= WORK_DAY_S).length, week_points, total_points };
}

// Série : jours consécutifs (jusqu'à aujourd'hui ou hier) avec au moins 10 min de travail (WORK_DAY_S, même seuil partout)
export async function streak(studentId: string) {
  const rows = await sql<{ day: string }[]>`
    select (started_at at time zone 'Europe/Paris')::date::text as day from work_sessions
    where student_id = ${studentId} group by 1 having sum(active_seconds) >= ${WORK_DAY_S} order by 1 desc limit 400`;
  const set = new Set(rows.map(r => r.day));
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  let n = 0;
  const d = new Date();
  if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
  while (set.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const minutes = (s: number) => Math.round(s / 60);
export function hm(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
