import 'server-only';
import { sql } from './db';
import { evalQuestions, autoCorrect, type Question } from './course-format';
import { versionById, parcours, pickNext } from './progress';
import { WORK_DAY_S } from './stats';
import type { Student } from './access';

// « Activité » du parent : une semaine (lundi → dimanche, heure de Paris), uniquement des faits mesurés.
// Inspiré de pratiques courantes :
// rapport d'usage et « questions ratées » (IXL, Khan Academy), calendrier d'assiduité, aucune comparaison avec d'autres élèves.

export type DayBar = { day: string; label: string; minutes: number };
export type CalCell = { day: string; minutes: number; inWeek: boolean; future: boolean };
export type Part = { label: string; minutes: number };
export type CourseLine = {
  course_id: number; title: string; subject: string; when: string; minutes: number;
  lesson: { text: string; tone: Tone }; exercises: { text: string; tone: Tone }; evaluation: { text: string; tone: Tone };
};
export type Tone = 'ok' | 'warn' | 'neutral' | 'none';
export type Missed = { at: number; course: string; where: 'évaluation' | 'exercices'; question: string; answer: string; correct: string; correctLabel: string };
export type Upcoming = { kind: 'revision' | 'retard' | 'cours'; title: string; when: string };
export type Week = {
  start: string; end: string; prev: string; next: string | null; isCurrent: boolean; label: string;
  goal_min: number; active_min: number; days_worked: number; days_elapsed: number; week_over: boolean; courses_count: number; evals_count: number;
  days: DayBar[]; calendar: { label: string; cells: CalCell[] }[]; cal_days_worked: number; cal_days_elapsed: number;
  bySubject: Part[]; byKind: Part[];
  courses: CourseLine[]; missed: Missed[];
  point: { text: string; href?: string } | null; idea: string; ideaExplain: boolean;
  upcoming: Upcoming[]; look: string[];
};

const PARIS = 'Europe/Paris';
const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...o });
const hm = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
const clip = (s: string | undefined, n: number) => { const t = (s ?? '').replace(/\*\*|__|`|\$/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
// une citation dans une phrase : sans le point final (« Calcule 3 + 4 » et non « Calcule 3 + 4. »)
const quote = (s: string, n: number) => clip(s, n).replace(/[.\s]+$/, '');
const KIND: Record<string, string> = { lesson: 'Leçons', exercises: 'Exercices', evaluation: 'Évaluations', review: 'Révisions' };

// réponse lisible : pour un QCM, le texte de l'option choisie plutôt que son numéro
function readable(q: Question, a: string | undefined) {
  if (!(a ?? '').trim()) return '(sans réponse)';
  if (q.type === 'qcm' && q.options) return a!.split(',').map(i => q.options![Number(i)] ?? i).join(' ; ');
  return clip(a, 140);
}
function expected(q: Question) {
  if (q.type === 'qcm' && q.options) return (Array.isArray(q.answer) ? q.answer : [q.answer]).map(i => q.options![Number(i)]).join(' ; ');
  if (q.type === 'numeric') return String(q.answer).replace('.', ',').replace(/^-/, '−') + (q.tolerance ? ` (à ${String(q.tolerance).replace('.', ',')} près)` : '');
  if (q.type === 'short' && Array.isArray(q.answer)) return String(q.answer[0]) + (q.answer.length > 1 ? ' (ou une autre forme acceptée)' : '');
  return clip(q.solution, 160);
}

/** Lundi (heure de Paris) de la semaine qui contient `ref` (AAAA-MM-JJ), ou de la semaine en cours. */
export async function mondayOf(ref?: string) {
  const t = ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? new Date(`${ref}T12:00:00Z`) : null;
  const valid = !!t && !Number.isNaN(t.getTime()) && t.getUTCFullYear() >= 2000 && t.getUTCFullYear() <= 2100 && t.toISOString().slice(0, 10) === ref;
  const [r] = await sql<{ d: string; cur: string }[]>`
    select to_char(date_trunc('week', ${valid ? sql`${ref!}::date` : sql`(now() at time zone ${PARIS})::date`}), 'YYYY-MM-DD') as d,
      to_char(date_trunc('week', (now() at time zone ${PARIS})::date), 'YYYY-MM-DD') as cur`;
  return { monday: r.d > r.cur ? r.cur : r.d, current: r.cur };
}

export async function weekReport(student: Student, ref?: string): Promise<Week> {
  const { monday, current } = await mondayOf(ref);
  const [b] = await sql<{ start: Date; end: Date; cal_start: Date; sunday: string; prev: string; next: string; today: string }[]>`
    select (${monday}::date::timestamp at time zone ${PARIS}) as start, ((${monday}::date + 7)::timestamp at time zone ${PARIS}) as end,
      ((${monday}::date - 21)::timestamp at time zone ${PARIS}) as cal_start,
      to_char(${monday}::date + 6, 'YYYY-MM-DD') as sunday, to_char(${monday}::date - 7, 'YYYY-MM-DD') as prev,
      to_char(${monday}::date + 7, 'YYYY-MM-DD') as next, to_char((now() at time zone ${PARIS})::date, 'YYYY-MM-DD') as today`;
  const sid = student.id;
  const goal = student.settings.weekly_goal_minutes;

  // temps de travail par jour sur 4 semaines (calendrier), dont la semaine affichée
  const perDay = await sql<{ day: string; s: number }[]>`
    select to_char((started_at at time zone ${PARIS})::date, 'YYYY-MM-DD') as day, sum(active_seconds)::int as s
    from work_sessions where student_id = ${sid} and started_at >= ${b.cal_start} and started_at < ${b.end} group by 1`;
  const secOf = new Map(perDay.map(r => [r.day, r.s]));
  const dayList = (from: string, n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(`${from}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const weekDays = dayList(monday, 7);
  const days: DayBar[] = weekDays.map(d => ({ day: d, label: fmtDay(d, { weekday: 'short', day: 'numeric' }), minutes: Math.floor((secOf.get(d) ?? 0) / 60) }));
  const calDays = dayList(new Date(new Date(`${monday}T12:00:00Z`).getTime() - 21 * 864e5).toISOString().slice(0, 10), 28);
  const calendar = [0, 1, 2, 3].map(w => ({
    label: fmtDay(calDays[w * 7], { day: 'numeric', month: 'short' }),
    cells: calDays.slice(w * 7, w * 7 + 7).map(d => ({ day: d, minutes: Math.floor((secOf.get(d) ?? 0) / 60), inWeek: w === 3, future: d > b.today })),
  }));
  const active = weekDays.reduce((n, d) => n + (secOf.get(d) ?? 0), 0);
  const dayMinutes = weekDays.reduce((n, d) => n + Math.floor((secOf.get(d) ?? 0) / 60), 0);   // le total affiché = la somme des barres

  // séances de la semaine, par cours
  const sessions = await sql<{ course_id: number | null; kind: string; started_at: Date; active: number; title: string | null; subject: string | null; doc_parts: number | null }[]>`
    select w.course_id, w.kind, w.started_at, w.active_seconds as active, c.title, sj.name as subject,
      (select jsonb_array_length(v.document->'lesson'->'parts') from course_versions v where v.course_id = w.course_id and v.status = 'published' order by v.version desc limit 1) as doc_parts
    from work_sessions w left join courses c on c.id = w.course_id left join chapters ch on ch.id = c.chapter_id left join subjects sj on sj.id = ch.subject_id
    where w.student_id = ${sid} and w.started_at >= ${b.start} and w.started_at < ${b.end} and w.open_seconds > 0 order by w.started_at`;
  const subj = new Map<string, number>(), kinds = new Map<string, number>();
  for (const s of sessions) {
    const sn = s.subject ?? (s.kind === 'review' ? 'Révisions' : 'Autre'); subj.set(sn, (subj.get(sn) ?? 0) + s.active);
    const k = KIND[s.kind] ?? 'Autre'; kinds.set(k, (kinds.get(k) ?? 0) + s.active);
  }
  // répartition en minutes entières dont la somme vaut exactement le total de la semaine (méthode du plus grand reste)
  const totalMin = dayMinutes;
  const parts = (m: Map<string, number>) => {
    const sum = [...m.values()].reduce((a, b) => a + b, 0);
    if (!sum || !totalMin) return [];
    const raw = [...m.entries()].map(([label, sec]) => ({ label, exact: (sec / sum) * totalMin }));
    const out = raw.map(r => ({ label: r.label, minutes: Math.floor(r.exact), rest: r.exact - Math.floor(r.exact) }));
    let left = totalMin - out.reduce((n, o) => n + o.minutes, 0);
    for (const o of [...out].sort((a, b) => b.rest - a.rest)) { if (left <= 0) break; o.minutes++; left--; }
    return out.filter(o => o.minutes > 0).map(o => ({ label: o.label, minutes: o.minutes })).sort((a, b) => b.minutes - a.minutes);
  };
  let bySubject = parts(subj);
  if (bySubject.length > 4) bySubject = [...bySubject.slice(0, 3), { label: 'Autres matières', minutes: bySubject.slice(3).reduce((n, p) => n + p.minutes, 0) }];
  const order = ['Leçons', 'Exercices', 'Évaluations', 'Autre'];
  const byKind = parts(kinds).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

  // événements, exercices et copies de la semaine
  const events = await sql<{ course_id: number | null; event: string; data: Record<string, unknown> }[]>`
    select course_id, event, data from activity_log where student_id = ${sid} and at >= ${b.start} and at < ${b.end} order by id`;
  const exs = await sql<{ course_id: number; version_id: string; answers: Record<string, string>; auto_results: Record<string, boolean> | null; title: string; subject: string }[]>`
    select e.course_id, e.version_id, e.answers, e.auto_results, c.title, sj.name as subject from exercise_submissions e join courses c on c.id = e.course_id
    join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where e.student_id = ${sid} and e.submitted_at >= ${b.start} and e.submitted_at < ${b.end} order by e.submitted_at`;
  const atts = await sql<{ course_id: number; version_id: string; variant: number; status: string; answers: Record<string, string>; scores: Record<string, number> | null; auto_scores: Record<string, number> | null;
    final_score: string | null; started_at: Date | null; submitted_at: Date; deadline_at: Date | null; focus_losses: number; focus_lost_seconds: number; title: string; subject: string }[]>`
    select a.course_id, a.version_id, a.variant, a.status, a.answers, a.scores, a.auto_scores, a.final_score, a.started_at, a.submitted_at, a.deadline_at,
      a.focus_losses, a.focus_lost_seconds, c.title, sj.name as subject from eval_attempts a join courses c on c.id = a.course_id
      join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${sid} and a.status in ('submitted', 'graded') and a.submitted_at >= ${b.start} and a.submitted_at < ${b.end} order by a.submitted_at`;
  const progress = await sql<{ course_id: number; lesson_done_at: Date | null }[]>`select course_id, lesson_done_at from course_progress where student_id = ${sid}`;
  const doneAt = new Map(progress.map(p => [p.course_id, p.lesson_done_at]));

  // questions ratées : seulement la DERNIÈRE copie et la DERNIÈRE série d'exercices de chaque cours dans la semaine (pas de doublon),
  // et seulement les questions à 0 point (une réponse à points partiels n'est pas « ratée »)
  const missedEval = new Map<number, Missed[]>(), missedEx = new Map<number, Missed[]>();
  const evalInfo = new Map<number, { text: string; tone: Tone }>();
  const lastCopy = new Map<number, { title: string; used: number; allowed: number; blank: number; total: number; at: number }>();
  const look: string[] = [];
  for (const a of atts) {
    const doc = (await versionById(a.version_id))?.document;
    if (!doc) continue;
    const qs = evalQuestions(doc, a.variant);
    const blank = qs.filter(q => !(a.answers?.[q.id] ?? '').trim()).length;
    const allowed = a.deadline_at && a.started_at ? Math.round((a.deadline_at.getTime() - a.started_at.getTime()) / 60000) : doc.evaluation.duration_min;
    const used = a.started_at ? Math.max(1, Math.round((a.submitted_at.getTime() - a.started_at.getTime()) / 60000)) : allowed;
    const note = a.final_score === null ? null : Number(a.final_score).toLocaleString('fr-FR');
    const blanks = blank ? ` · ${blank} sans réponse sur ${qs.length}` : '';
    evalInfo.set(a.course_id, a.status !== 'graded' ? { text: `Remise · en correction${blanks}`, tone: blank ? 'warn' : 'neutral' }
      : { text: `${note}/20${blanks}`, tone: blank ? 'warn' : Number(a.final_score) >= 10 ? 'ok' : 'neutral' });
    lastCopy.set(a.course_id, { title: a.title, used, allowed, blank, total: qs.length, at: a.submitted_at.getTime() });
    if (a.focus_losses > 0) {
      const day = a.submitted_at.toLocaleDateString('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric' });
      look.push(`${day.charAt(0).toUpperCase() + day.slice(1)} · pendant l’évaluation « ${a.title} », la page de l’évaluation a été masquée ${a.focus_losses} fois (autre onglet, autre application ou écran verrouillé), ${Math.round(a.focus_lost_seconds / 60) || 'moins de 1'} min au total.`);
    }
    if (a.status === 'graded') {
      const pts = a.scores ?? a.auto_scores ?? {};
      missedEval.set(a.course_id, qs.filter(q => q.id in pts && pts[q.id] === 0).map(q => ({ at: a.submitted_at.getTime(), course: a.title, where: 'évaluation' as const, question: clip(q.prompt, 220),
        answer: readable(q, a.answers?.[q.id]), correct: expected(q), correctLabel: q.type === 'open' ? 'Corrigé' : 'Bonne réponse' })));
    }
  }
  const exInfo = new Map<number, { text: string; tone: Tone }>();
  for (const e of exs) {
    const doc = (await versionById(e.version_id))?.document;
    if (!doc) continue;
    const auto = e.auto_results ?? {};
    const ids = Object.keys(auto), ok = ids.filter(id => auto[id]).length;
    exInfo.set(e.course_id, ids.length ? { text: `${ok} justes sur ${ids.length} (corrigées par la plateforme)`, tone: ok / ids.length >= 0.8 ? 'ok' : 'neutral' } : { text: 'Remis', tone: 'neutral' });
    missedEx.set(e.course_id, doc.exercises.items.filter(q => q.id in auto && !auto[q.id] && autoCorrect(q, e.answers?.[q.id]) === false)
      .map(q => ({ at: 0, course: e.title, where: 'exercices' as const, question: clip(q.prompt, 220), answer: readable(q, e.answers?.[q.id]), correct: expected(q), correctLabel: 'Bonne réponse' })));
  }
  const missed: Missed[] = [...missedEval.values(), ...missedEx.values()].flat();
  const blankCopy = [...lastCopy.values()].filter(c => c.blank > 0).sort((a, b) => b.at - a.at)[0] ?? null;

  const courseSec = new Map<string, number>();
  for (const x of sessions) courseSec.set(String(x.course_id ?? 'aucun'), (courseSec.get(String(x.course_id ?? 'aucun')) ?? 0) + x.active);
  const courseMin = new Map(parts(courseSec).map(p => [p.label, p.minutes]));
  // une ligne par cours travaillé dans la semaine
  const ids = [...new Set([...sessions.map(s => s.course_id), ...exs.map(e => e.course_id), ...atts.map(a => a.course_id)].filter((x): x is number => x !== null))];
  const courses: CourseLine[] = ids.map(id => {
    const ss = sessions.filter(s => s.course_id === id);
    const meta = ss[0] ?? null;
    const title = meta?.title ?? exs.find(e => e.course_id === id)?.title ?? atts.find(a => a.course_id === id)!.title;
    const subject = meta?.subject ?? exs.find(e => e.course_id === id)?.subject ?? atts.find(a => a.course_id === id)?.subject ?? '';
    const ev = events.filter(e => e.course_id === id);
    const done = doneAt.get(id);
    const maxPart = Math.max(0, ...ev.filter(e => e.event.startsWith('point_controle')).map(e => Number(e.data.partie ?? 0)));
    const total = meta?.doc_parts ?? null;
    const lesson: { text: string; tone: Tone } = done && done < b.end ? { text: done >= b.start ? `Terminée cette semaine${total ? ` · ${total}/${total}` : ''}` : 'Terminée avant', tone: 'ok' }
      : maxPart ? { text: `Partie ${maxPart}${total ? ` sur ${total}` : ''}`, tone: 'neutral' } : ss.some(s => s.kind === 'lesson') ? { text: 'Commencée', tone: 'neutral' } : { text: '—', tone: 'none' };
    const dates = [...new Set(ss.map(s => s.started_at.toLocaleDateString('fr-FR', { timeZone: PARIS, weekday: 'short' })))];
    return {
      course_id: id, title, subject, minutes: courseMin.get(String(id)) ?? 0,
      when: dates.length > 1 ? `${dates[0]} → ${dates.at(-1)}` : dates[0] ?? '',
      lesson, exercises: exInfo.get(id) ?? { text: '—', tone: 'none' }, evaluation: evalInfo.get(id) ?? { text: '—', tone: 'none' },
    };
  }).filter(c => c.minutes > 0 || exs.some(e => e.course_id === c.course_id) || atts.some(a => a.course_id === c.course_id)).sort((a, b) => b.minutes - a.minutes);

  // à venir : révisions (en retard ou prévues dans les 7 jours) et prochain cours du parcours
  const upcoming: Upcoming[] = [];
  const reviews = await sql<{ title: string; at: Date; late_days: number }[]>`
    select c.title, p.next_review_at as at, greatest(0, ((now() at time zone ${PARIS})::date - (p.next_review_at at time zone ${PARIS})::date))::int as late_days
    from course_progress p join courses c on c.id = p.course_id
    where p.student_id = ${sid} and p.next_review_at is not null and p.next_review_at < now() + interval '7 days' order by p.next_review_at`;
  if (monday === current) for (const r of reviews) upcoming.push(r.late_days > 0
    ? { kind: 'retard', title: r.title, when: `en retard de ${r.late_days} jour${r.late_days > 1 ? 's' : ''}` }
    : { kind: 'revision', title: r.title, when: r.at.toLocaleDateString('fr-FR', { timeZone: PARIS, weekday: 'short', day: 'numeric', month: 'short' }) });
  const items = await parcours(sid, student.level_code);
  const nx = pickNext(items, student.settings.retry_delay_days);
  if (nx && monday === current) upcoming.push({ kind: 'cours', title: nx.title, when: nx.priority === 'prioritaire' ? 'prioritaire' : 'suivant' });

  // les 3 lignes : un fait, un point précis (fait vérifiable de CETTE semaine), une idée concrète liée à ce point
  const isCurrent = monday === current;
  const elapsed = weekDays.filter(d => d <= b.today).length;                 // jours écoulés (semaine en cours)
  const weekOver = b.end.getTime() <= Date.now();
  const worked = weekDays.filter(d => (secOf.get(d) ?? 0) >= WORK_DAY_S).length;
  const late = isCurrent ? reviews.find(r => r.late_days > 3) : undefined;  // un retard est un fait d'aujourd'hui : semaine en cours seulement
  const elle = student.settings.gender === 'fille' ? 'elle' : student.settings.gender === 'garcon' ? 'il' : 'il ou elle';
  let ideaExplain = true;
  let point: Week['point'] = null, idea = `Demandez-lui de vous montrer ce qu’${elle} a fait cette semaine et de vous expliquer une notion en 2 minutes.`;
  if (blankCopy) {
    point = { text: `Dernière évaluation « ${blankCopy.title} » : ${blankCopy.blank} question${blankCopy.blank > 1 ? 's' : ''} sans réponse sur ${blankCopy.total} (rendue en ${blankCopy.used} min, ${blankCopy.allowed} min accordées).`, href: '#questions' };
    idea = 'Regardez ensemble les questions laissées sans réponse, et demandez-lui comment ' + elle + ' s’y prendrait pour l’une d’elles.';
  } else if (late) {
    point = { text: `La révision « ${late.title} » est en retard de ${late.late_days} jours.` };
    idea = 'Proposez un créneau précis (jour et heure) pour faire cette révision.'; ideaExplain = false;
  } else if (worked === 0 && weekOver) {
    point = { text: 'Aucun jour travaillé (10 min ou plus) sur cette semaine.' };
    idea = 'Proposez un créneau fixe et court, à la même heure chaque jour.'; ideaExplain = false;
  } else if (missed[0]) {
    const first = missed[0];
    point = { text: `${missed.length} question${missed.length > 1 ? 's' : ''} ratée${missed.length > 1 ? 's' : ''} cette semaine, dont une dans « ${first.course} ».`, href: '#questions' };
    idea = `Demandez-lui de vous expliquer en 2 minutes comment répondre à « ${quote(first.question, 90)} » (${first.course}).`;
  }

  return {
    start: monday, end: b.sunday, prev: b.prev, next: isCurrent ? null : b.next, isCurrent,
    label: `du ${fmtDay(monday, { weekday: 'long', day: 'numeric', ...(monday.slice(5, 7) !== b.sunday.slice(5, 7) ? { month: 'long' } : {}) })} au ${fmtDay(b.sunday, { weekday: 'long', day: 'numeric', month: 'long' })}`.replace(/ 1 /g, ' 1er '),
    goal_min: goal, active_min: totalMin, days_worked: worked, days_elapsed: isCurrent ? elapsed : 7, week_over: weekOver,
    courses_count: courses.length, evals_count: atts.length,
    days, calendar, cal_days_worked: calDays.filter(d => (secOf.get(d) ?? 0) >= WORK_DAY_S).length, cal_days_elapsed: calDays.filter(d => d <= b.today).length,
    bySubject, byKind, courses, missed, point, idea, ideaExplain, upcoming, look,
  };
}
export { hm };
