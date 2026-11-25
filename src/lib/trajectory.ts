import 'server-only';
import { sql } from './db';
import { evalQuestions } from './course-format';
import { versionById } from './progress';
import { DIMS, type Dim } from './checkin';

// Trajectoire de l'élève : pas une photo à l'instant T, mais où il va, semaine après semaine.
//  - investissement de chaque semaine (régularité, temps, concentration, effort en évaluation) ;
//  - compréhension sur 3 semaines glissantes (points de contrôle, exercices, évaluations sérieuses, tests),
//    car une seule semaine contient trop peu de mesures pour être fiable ;
//  - la même compréhension matière par matière ;
//  - le ressenti de l'élève d'un questionnaire à l'autre.

export type WeekPoint = { week: string; label: string; serieux: number | null; comprehension: number | null; minutes: number; measures: number };
export type Trend = { dir: 'hausse' | 'baisse' | 'stable' | 'inconnue'; delta: number; text: string };
export type SubjectTrend = { subject: string; points: { at: string; v: number }[]; last: number; trend: Trend };
export type FeelingTrend = { dim: Dim; label: string; bad: boolean; values: { at: string; v: number }[] };
export type Trajectory = { weeks: WeekPoint[]; serieux: Trend; comprehension: Trend; subjects: SubjectTrend[]; feelings: FeelingTrend[] };

const W = 12;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const weighted = (xs: [number, number][]) => { const w = xs.reduce((a, [, k]) => a + k, 0); return w ? Math.round(xs.reduce((a, [v, k]) => a + v * k, 0) / w) : null; };

/** Pente (régression linéaire) sur les derniers points connus, ramenée à « points gagnés sur la période ». */
export function trendOf(vals: (number | null)[], unit = 'pts', span = 6): Trend {
  const pts = vals.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null).slice(-span);
  if (pts.length < 3) return { dir: 'inconnue', delta: 0, text: 'pas encore assez de semaines pour une tendance' };
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  const slope = den ? pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / den : 0;
  const delta = Math.round(slope * (pts.at(-1)![0] - pts[0][0]));
  const dir = delta >= 8 ? 'hausse' : delta <= -8 ? 'baisse' : 'stable';
  return { dir, delta, text: dir === 'stable' ? 'stable' : `${dir === 'hausse' ? 'en hausse' : 'en baisse'} (${delta > 0 ? '+' : ''}${delta} ${unit})` };
}

export async function trajectory(studentId: string): Promise<Trajectory> {
  const [st] = await sql<{ goal: number; created: Date }[]>`select coalesce((settings->>'weekly_goal_minutes')::int, 300) as goal, created_at as created from students where id = ${studentId}`;
  const weeks = await sql<{ week: string; start: Date; end: Date; active: number; open: number; days: number }[]>`
    with w as (select generate_series(0, ${W - 1}) as i),
    b as (select i, (date_trunc('week', now() at time zone 'Europe/Paris') - make_interval(weeks => i)) at time zone 'Europe/Paris' as start from w)
    select to_char(b.start at time zone 'Europe/Paris', 'YYYY-MM-DD') as week, b.start, b.start + interval '7 days' as end,
      coalesce(sum(s.active_seconds), 0)::int as active, coalesce(sum(s.open_seconds), 0)::int as open,
      (select count(distinct (x.started_at at time zone 'Europe/Paris')::date)::int from work_sessions x where x.student_id = ${studentId}
        and x.started_at >= b.start and x.started_at < b.start + interval '7 days' and x.active_seconds >= 600) as days
    from b left join work_sessions s on s.student_id = ${studentId} and s.started_at >= b.start and s.started_at < b.start + interval '7 days'
    group by b.i, b.start order by b.start`;
  const since = weeks[0].start;
  const [first] = await sql<{ at: Date | null }[]>`select least((select min(started_at) from work_sessions where student_id = ${studentId}),
    (select min(at) from activity_log where student_id = ${studentId})) as at`;
  const startOf = first.at ?? st.created;

  // mesures datées
  const evals = await sql<{ submitted_at: Date; started_at: Date | null; version_id: string; variant: number; answers: Record<string, string>; final_score: string | null; status: string; focus_losses: number; subject: string }[]>`
    select a.submitted_at, a.started_at, a.version_id, a.variant, a.answers, a.final_score, a.status, a.focus_losses, sj.name as subject
    from eval_attempts a join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${studentId} and a.status in ('submitted', 'graded') and a.submitted_at >= ${since} order by a.submitted_at`;
  const evalFacts: { at: Date; effort: number; score: number | null; subject: string }[] = [];
  for (const a of evals) {
    const doc = (await versionById(a.version_id))?.document;
    if (!doc) continue;
    const qs = evalQuestions(doc, a.variant);
    const blank = qs.length ? qs.filter(q => !(a.answers?.[q.id] ?? '').trim()).length / qs.length : 0;
    const allowed = doc.evaluation.duration_min;
    const used = a.started_at ? (a.submitted_at.getTime() - a.started_at.getTime()) / 60000 : null;
    const effort = 0.4 * (used === null ? 1 : clamp(used / (allowed * 0.5))) + 0.4 * (1 - blank) + 0.2 * clamp(1 - 0.15 * Math.max(0, a.focus_losses - 1));
    const serious = (used === null || used >= allowed * 0.3) && blank < 0.4;
    evalFacts.push({ at: a.submitted_at, effort: effort * 100, score: a.status === 'graded' && a.final_score !== null && serious ? Number(a.final_score) * 5 : null, subject: a.subject });
  }
  const cps = await sql<{ at: Date; ok: boolean }[]>`
    select min(answered_at) as at, (array_agg(correct order by answered_at))[1] as ok from checkpoint_answers
    where student_id = ${studentId} group by course_id, part_index having min(answered_at) >= ${since}`;
  const exs = await sql<{ checked_at: Date; version_id: string; auto_results: Record<string, boolean> | null; self_check: Record<string, boolean> | null; subject: string }[]>`
    select e.checked_at, e.version_id, e.auto_results, e.self_check, sj.name as subject from exercise_submissions e
    join courses c on c.id = e.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where e.student_id = ${studentId} and e.checked_at >= ${since} order by e.checked_at`;
  const exFacts: { at: Date; score: number; subject: string }[] = [];
  for (const e of exs) {
    const doc = (await versionById(e.version_id))?.document;
    if (!doc) continue;
    const items = doc.exercises.items;
    const ok = items.filter(q => (q.id in (e.auto_results ?? {}) ? e.auto_results![q.id] : !!e.self_check?.[q.id])).length;
    exFacts.push({ at: e.checked_at, score: (ok / Math.max(1, items.length)) * 100, subject: e.subject });
  }
  const tests = await sql<{ at: Date; score: number; total: number }[]>`select submitted_at as at, score, total from placement_tests
    where student_id = ${studentId} and status = 'termine' and submitted_at >= ${since}`;

  const inRange = (d: Date, a: Date, b: Date) => d.getTime() >= a.getTime() && d.getTime() < b.getTime();
  const points: WeekPoint[] = weeks.map((w, i) => {
    const started = w.end.getTime() > startOf.getTime();
    // investissement de la semaine
    const ev = evalFacts.filter(e => inRange(e.at, w.start, w.end));
    const s: [number, number][] = [];
    // semaine en cours : objectifs ramenés aux jours déjà écoulés (sinon elle paraît toujours « en chute »)
    const frac = i === weeks.length - 1 ? Math.max(1 / 7, Math.min(1, (Date.now() - w.start.getTime()) / (7 * 864e5))) : 1;
    if (started) {
      s.push([clamp(w.days / Math.max(1, 4 * frac)) * 100, 25], [clamp(w.active / (st.goal * 60 * frac)) * 100, 15]);
      if (w.open >= 600) s.push([clamp((w.active / w.open - 0.4) / 0.45) * 100, 20]);
      if (ev.length) s.push([ev.reduce((a, e) => a + e.effort, 0) / ev.length, 20]);
    }
    // compréhension sur 3 semaines glissantes
    const a = weeks[Math.max(0, i - 2)].start, b = w.end;
    const c: [number, number][] = [];
    const cp = cps.filter(x => inRange(x.at, a, b));
    if (cp.length) c.push([(cp.filter(x => x.ok).length / cp.length) * 100, 25]);
    const ex = exFacts.filter(x => inRange(x.at, a, b));
    if (ex.length) c.push([ex.reduce((n, x) => n + x.score, 0) / ex.length, 25]);
    const sc = evalFacts.filter(x => x.score !== null && inRange(x.at, a, b));
    if (sc.length) c.push([sc.reduce((n, x) => n + x.score!, 0) / sc.length, 35]);
    const t = tests.filter(x => inRange(x.at, a, b) && x.total);
    if (t.length) c.push([(t.reduce((n, x) => n + x.score / x.total, 0) / t.length) * 100, 15]);
    return {
      week: w.week, label: new Date(`${w.week}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      serieux: started ? weighted(s) : null, comprehension: weighted(c), minutes: Math.round(w.active / 60),
      measures: cp.length + ex.length + sc.length + t.length,
    };
  });

  // matière par matière : chaque mesure de compréhension (exercices, évaluations sérieuses), dans l'ordre du temps
  const bySubject = new Map<string, { at: Date; v: number }[]>();
  for (const x of [...exFacts.map(e => ({ at: e.at, v: e.score, subject: e.subject })), ...evalFacts.filter(e => e.score !== null).map(e => ({ at: e.at, v: e.score!, subject: e.subject }))])
    bySubject.set(x.subject, [...(bySubject.get(x.subject) ?? []), { at: x.at, v: x.v }]);
  const subjects: SubjectTrend[] = [...bySubject.entries()].filter(([, p]) => p.length >= 2).map(([subject, p]) => {
    const sorted = p.sort((m, n) => m.at.getTime() - n.at.getTime());
    return { subject, points: sorted.map(x => ({ at: x.at.toISOString(), v: Math.round(x.v) })), last: Math.round(sorted.at(-1)!.v), trend: trendOf(sorted.map(x => x.v), 'pts', 8) };
  }).sort((a, b) => b.points.length - a.points.length);

  const checkins = await sql<{ created_at: Date; scores: Partial<Record<Dim, number>> }[]>`
    select created_at, scores from student_checkins where student_id = ${studentId} order by created_at`;
  const feelings: FeelingTrend[] = (['envie', 'confiance', 'stress', 'organisation'] as Dim[]).map(d => ({
    dim: d, label: DIMS[d].label, bad: !!DIMS[d].bad,
    values: checkins.filter(c => c.scores[d] !== undefined).map(c => ({ at: c.created_at.toISOString(), v: c.scores[d]! })),
  })).filter(f => f.values.length > 0);

  // la semaine en cours n'est pas finie : affichée, mais exclue des tendances (elle ferait croire à une baisse)
  const done = points.slice(0, -1);
  points[points.length - 1].label += ' (en cours)';
  return { weeks: points, serieux: trendOf(done.map(p => p.serieux)), comprehension: trendOf(done.map(p => p.comprehension)), subjects, feelings };
}
