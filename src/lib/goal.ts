import 'server-only';
import { sql } from './db';
import { WORK_DAY_S } from './stats';
import type { StudentSettings } from './settings';

// Objectif de temps de travail (décision du propriétaire, 27/11/2026) : par semaine, ou par jour sur les jours choisis.
// Par jour, l'objectif de la semaine vaut « minutes par jour × nombre de jours » (calculé à l'enregistrement) : toutes les pages
// qui parlent de la semaine restent cohérentes. Mêmes temps que partout : séances comptées le jour où elles commencent (Paris).

export const weeklyFrom = (s: Pick<StudentSettings, 'goal_mode' | 'daily_goal_minutes' | 'goal_days' | 'weekly_goal_minutes'>) =>
  s.goal_mode === 'jour' ? s.daily_goal_minutes * s.goal_days.length : s.weekly_goal_minutes;

export type GoalDay = { day: string; dow: number; minutes: number; goal: number | null; met: boolean; today: boolean; future: boolean };
export type GoalView = { mode: 'semaine' | 'jour'; today: GoalDay; days: GoalDay[]; week_min: number; week_goal: number; goal_days_met: number; goal_days_elapsed: number };

/** Temps de travail du jour en secondes (heure de Paris). */
export async function todaySeconds(studentId: string) {
  const [r] = await sql<{ s: number }[]>`select coalesce(sum(active_seconds), 0)::int as s from work_sessions
    where student_id = ${studentId} and (started_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date`;
  return r.s;
}

export async function goalView(studentId: string, s: StudentSettings): Promise<GoalView> {
  const rows = await sql<{ day: string; dow: number; s: number; today: boolean; future: boolean }[]>`
    with w as (select date_trunc('week', now() at time zone 'Europe/Paris')::date as mon, (now() at time zone 'Europe/Paris')::date as today),
    d as (select (w.mon + i)::date as day, w.today from w, generate_series(0, 6) i)
    select to_char(d.day, 'YYYY-MM-DD') as day, extract(isodow from d.day)::int as dow, (d.day = d.today) as today, (d.day > d.today) as future,
      coalesce((select sum(active_seconds) from work_sessions ws where ws.student_id = ${studentId} and (ws.started_at at time zone 'Europe/Paris')::date = d.day), 0)::int as s
    from d order by d.day`;
  const days: GoalDay[] = rows.map(r => {
    const minutes = Math.floor(r.s / 60);
    const goal = s.goal_mode === 'jour' && s.goal_days.includes(r.dow) ? s.daily_goal_minutes : null;
    // « atteint » : l'objectif du jour s'il y en a un ; sinon (objectif par semaine) un jour travaillé (10 min ou plus)
    const met = goal !== null ? minutes >= goal : s.goal_mode === 'semaine' && r.s >= WORK_DAY_S;
    return { day: r.day, dow: r.dow, minutes, goal, met, today: r.today, future: r.future };
  });
  const goalDays = days.filter(d => d.goal !== null && !d.future);
  return {
    mode: s.goal_mode, today: days.find(d => d.today)!, days,
    week_min: days.reduce((n, d) => n + d.minutes, 0), week_goal: weeklyFrom(s),
    goal_days_met: goalDays.filter(d => d.met).length, goal_days_elapsed: goalDays.length,
  };
}

/** Pour la barre affichée pendant le travail : temps du jour et objectif du jour (null si pas d'objectif ce jour-là). */
export async function todayInfo(studentId: string, s: StudentSettings) {
  const [r] = await sql<{ s: number; dow: number }[]>`select coalesce((select sum(active_seconds) from work_sessions where student_id = ${studentId}
    and (started_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date), 0)::int as s,
    extract(isodow from now() at time zone 'Europe/Paris')::int as dow`;
  return { todaySec: r.s, goalMin: s.goal_mode === 'jour' && s.goal_days.includes(r.dow) ? s.daily_goal_minutes : null };
}
