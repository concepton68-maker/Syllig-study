import 'server-only';
import { sql } from './db';
import { evalQuestions } from './course-format';
import { versionById } from './progress';
import { ITEMS, SCALE } from './checkin';

// Trajectoire : les mêmes mesures, semaine après semaine (12 semaines, heure de Paris, changements d'heure compris).
// Uniquement des valeurs mesurées et leurs effectifs ; la comparaison « 4 dernières semaines terminées / 4 précédentes »
// est un simple calcul sur ces mesures. Aucune tendance extrapolée, aucune cause supposée.

export type WeekRow = {
  week: string; label: string; current: boolean;
  minutes: number; days: number;
  cp_ok: number; cp_total: number;     // points de contrôle, premier essai
  ex_ok: number; ex_total: number;     // exercices corrigés par la plateforme
  notes: number[];                     // notes des copies complètes (sur 20)
};
export type Compare = { label: string; before: string; after: string; dir: 'up' | 'down' | 'same' | 'none'; better: 'up' | 'down' };
export type SubjectSeries = { subject: string; points: { at: string; v: number; kind: 'exercices' | 'copie' }[]; first: number | null; last: number | null; n: number };
export type FeelingRow = { id: string; text: string; answers: { at: string; label: string }[] };
export type Trajectory = { weeks: WeekRow[]; compare: Compare[]; subjects: SubjectSeries[]; feelings: FeelingRow[] };

const W = 12;
const pct = (ok: number, total: number) => total ? Math.round((ok / total) * 100) : null;
const mean = (xs: number[]) => xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

export async function trajectory(studentId: string): Promise<Trajectory> {
  // bornes des semaines calculées en heure locale de Paris (lundi 0 h → lundi suivant 0 h)
  const weeks = await sql<{ week: string; start: Date; end: Date }[]>`
    with w as (select generate_series(0, ${W - 1}) as i),
    b as (select i, date_trunc('week', now() at time zone 'Europe/Paris') - make_interval(weeks => i) as local_start from w)
    select to_char(local_start, 'YYYY-MM-DD') as week, local_start at time zone 'Europe/Paris' as start,
      (local_start + interval '7 days') at time zone 'Europe/Paris' as end from b order by local_start`;
  const since = weeks[0].start;
  const daysRows = await sql<{ day: Date; active: number }[]>`
    select ((started_at at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris' as day, sum(active_seconds)::int as active
    from work_sessions where student_id = ${studentId} and started_at >= ${since} group by 1`;
  const cps = await sql<{ at: Date; ok: boolean }[]>`
    select min(answered_at) as at, (array_agg(correct order by answered_at))[1] as ok from checkpoint_answers
    where student_id = ${studentId} group by course_id, part_index having min(answered_at) >= ${since}`;
  const exs = await sql<{ at: Date; auto: Record<string, boolean> | null; subject: string }[]>`
    select e.submitted_at as at, e.auto_results as auto, sj.name as subject from exercise_submissions e
    join courses c on c.id = e.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where e.student_id = ${studentId} and e.submitted_at >= ${since} order by e.submitted_at`;
  const atts = await sql<{ at: Date; started_at: Date | null; deadline_at: Date | null; version_id: string; variant: number; answers: Record<string, string>; note: string; subject: string }[]>`
    select a.submitted_at as at, a.started_at, a.deadline_at, a.version_id, a.variant, a.answers, a.final_score as note, sj.name as subject
    from eval_attempts a join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${studentId} and a.status = 'graded' and a.final_score is not null and a.submitted_at >= ${since} order by a.submitted_at`;
  const copies: { at: Date; note: number; subject: string }[] = [];
  for (const a of atts) {
    const doc = (await versionById(a.version_id))?.document;
    if (!doc) continue;
    const qs = evalQuestions(doc, a.variant);
    const answered = qs.filter(q => (a.answers?.[q.id] ?? '').trim()).length / Math.max(1, qs.length);
    const allowed = a.deadline_at && a.started_at ? (a.deadline_at.getTime() - a.started_at.getTime()) / 60000 : doc.evaluation.duration_min;
    const used = a.started_at ? (a.at.getTime() - a.started_at.getTime()) / 60000 : null;
    if ((used === null || used >= allowed * 0.3) && answered >= 0.6) copies.push({ at: a.at, note: Number(a.note), subject: a.subject });
  }
  const exFacts = exs.map(e => { const k = Object.keys(e.auto ?? {}); return { at: e.at, ok: k.filter(id => e.auto![id]).length, total: k.length, subject: e.subject }; }).filter(e => e.total > 0);

  const inW = (d: Date, w: { start: Date; end: Date }) => d.getTime() >= w.start.getTime() && d.getTime() < w.end.getTime();
  const rows: WeekRow[] = weeks.map((w, i) => {
    const dd = daysRows.filter(d => inW(d.day, w));
    const cp = cps.filter(c => inW(c.at, w)), ex = exFacts.filter(e => inW(e.at, w));
    return {
      week: w.week, current: i === weeks.length - 1,
      label: new Date(`${w.week}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      minutes: Math.round(dd.reduce((n, d) => n + d.active, 0) / 60), days: dd.filter(d => d.active >= 600).length,
      cp_ok: cp.filter(c => c.ok).length, cp_total: cp.length,
      ex_ok: ex.reduce((n, e) => n + e.ok, 0), ex_total: ex.reduce((n, e) => n + e.total, 0),
      notes: copies.filter(c => inW(c.at, w)).map(c => c.note),
    };
  });

  // 4 dernières semaines terminées comparées aux 4 précédentes (la semaine en cours n'est pas finie : exclue)
  const after = rows.slice(-5, -1), before = rows.slice(-9, -5);
  const sum = (rs: WeekRow[], f: (r: WeekRow) => number) => rs.reduce((n, r) => n + f(r), 0);
  const cmp = (label: string, b: number | null, a: number | null, fmt: (x: number) => string, better: 'up' | 'down' = 'up'): Compare => ({
    label, before: b === null ? '—' : fmt(b), after: a === null ? '—' : fmt(a), better,
    dir: a === null || b === null ? 'none' : a > b ? 'up' : a < b ? 'down' : 'same',
  });
  const compare: Compare[] = [
    cmp('Temps de travail effectif', sum(before, r => r.minutes), sum(after, r => r.minutes), x => `${x} min`),
    cmp('Jours travaillés (10 min ou plus)', sum(before, r => r.days), sum(after, r => r.days), x => `${x} j`),
    cmp('Contrôles réussis du premier coup', pct(sum(before, r => r.cp_ok), sum(before, r => r.cp_total)), pct(sum(after, r => r.cp_ok), sum(after, r => r.cp_total)), x => `${x} %`),
    cmp('Exercices réussis (corrigés par la plateforme)', pct(sum(before, r => r.ex_ok), sum(before, r => r.ex_total)), pct(sum(after, r => r.ex_ok), sum(after, r => r.ex_total)), x => `${x} %`),
    cmp('Moyenne des copies complètes', mean(before.flatMap(r => r.notes)), mean(after.flatMap(r => r.notes)), x => `${x.toLocaleString('fr-FR')}/20`),
  ];

  // par matière : chaque résultat dans l'ordre du temps (exercices en % de réussite, copies complètes ramenées en %)
  const bySubject = new Map<string, SubjectSeries['points']>();
  const add = (subject: string, p: SubjectSeries['points'][number]) => bySubject.set(subject, [...(bySubject.get(subject) ?? []), p]);
  for (const e of exFacts) add(e.subject, { at: e.at.toISOString(), v: Math.round((e.ok / e.total) * 100), kind: 'exercices' });
  for (const c of copies) add(c.subject, { at: c.at.toISOString(), v: Math.round(c.note * 5), kind: 'copie' });
  const subjects: SubjectSeries[] = [...bySubject.entries()].map(([subject, ps]) => {
    const p = ps.sort((a, b) => a.at.localeCompare(b.at));
    const k = Math.min(3, Math.floor(p.length / 2));
    const m = (xs: typeof p) => Math.round(xs.reduce((n, x) => n + x.v, 0) / xs.length);
    return { subject, points: p, n: p.length, first: k ? m(p.slice(0, k)) : null, last: k ? m(p.slice(-k)) : null };
  }).sort((a, b) => b.n - a.n);

  // ressenti : la réponse exacte de l'élève à chaque phrase, questionnaire après questionnaire (seulement ce qui a changé)
  const checkins = await sql<{ created_at: Date; answers: Record<string, number> }[]>`select created_at, answers from student_checkins where student_id = ${studentId} order by created_at`;
  const feelings: FeelingRow[] = checkins.length < 2 ? [] : ITEMS.map(it => ({
    id: it.id, text: it.text,
    answers: checkins.filter(c => typeof c.answers?.[it.id] === 'number').map(c => ({ at: c.created_at.toISOString(), label: SCALE[c.answers[it.id]] })),
  })).filter(f => f.answers.length >= 2 && f.answers[0].label !== f.answers.at(-1)!.label);

  return { weeks: rows, compare, subjects, feelings };
}
