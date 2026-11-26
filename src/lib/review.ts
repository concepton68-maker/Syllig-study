import 'server-only';
import { sql } from './db';
import { evalQuestions, type Question } from './course-format';
import { versionById } from './progress';
import { getAttempt } from './evaluation';

// « Retracer » et « Revoir ensemble » (maquette validée par le propriétaire le 26/11/2026).
// Uniquement ce qui est enregistré : séances, contrôles, exercices remis, copies remises. Aucune interprétation.

const PARIS = 'Europe/Paris';
export type Kind = 'lesson' | 'exercises' | 'evaluation' | 'other';
export type TimelineItem = {
  key: string; at: number; time: string; kind: Kind; title: string; subject: string;
  what: string; minutes: number | null; result: string | null; warn: boolean; href: string | null;
};
export type TimelineDay = { day: string; minutes: number; items: TimelineItem[] };

const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' });
const dayOf = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: PARIS });   // AAAA-MM-JJ, heure de Paris
const fr = (n: number) => n.toLocaleString('fr-FR');

/** Ce que l'élève a fait, jour par jour, sur la semaine [start, end[ (bornes en heure de Paris). */
export async function weekTimeline(studentId: string, monday: string): Promise<TimelineDay[]> {
  const [b] = await sql<{ start: Date; end: Date }[]>`select (${monday}::date::timestamp at time zone ${PARIS}) as start, ((${monday}::date + 7)::timestamp at time zone ${PARIS}) as end`;
  const { start, end } = b;
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${monday}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const sessions = await sql<{ course_id: number | null; kind: string; started_at: Date; active: number; title: string | null; subject: string | null }[]>`
    select w.course_id, w.kind, w.started_at, w.active_seconds as active, c.title, sj.name as subject
    from work_sessions w left join courses c on c.id = w.course_id left join chapters ch on ch.id = c.chapter_id left join subjects sj on sj.id = ch.subject_id
    where w.student_id = ${studentId} and w.started_at >= ${start} and w.started_at < ${end} order by w.started_at`;
  const subs = await sql<{ id: string; course_id: number; submitted_at: Date; auto: Record<string, boolean> | null; title: string; subject: string }[]>`
    select e.id, e.course_id, e.submitted_at, e.auto_results as auto, c.title, sj.name as subject from exercise_submissions e
    join courses c on c.id = e.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where e.student_id = ${studentId} and e.submitted_at >= ${start} and e.submitted_at < ${end} order by e.submitted_at`;
  const atts = await sql<{ id: string; course_id: number; version_id: string; variant: number; status: string; answers: Record<string, string>; final_score: string | null;
    started_at: Date | null; submitted_at: Date; deadline_at: Date | null; title: string; subject: string }[]>`
    select a.id, a.course_id, a.version_id, a.variant, a.status, a.answers, a.final_score, a.started_at, a.submitted_at, a.deadline_at, c.title, sj.name as subject
    from eval_attempts a join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where a.student_id = ${studentId} and a.status in ('submitted', 'graded') and a.submitted_at >= ${start} and a.submitted_at < ${end} order by a.submitted_at`;
  // contrôles de leçon : premier essai de chaque partie, compté le jour où il a été fait
  const cps = await sql<{ course_id: number; at: Date; ok: boolean }[]>`
    select course_id, min(answered_at) as at, (array_agg(correct order by answered_at))[1] as ok from checkpoint_answers
    where student_id = ${studentId} group by course_id, part_index having min(answered_at) >= ${start} and min(answered_at) < ${end}`;
  const done = await sql<{ course_id: number; at: Date }[]>`
    select course_id, lesson_done_at as at from course_progress where student_id = ${studentId} and lesson_done_at >= ${start} and lesson_done_at < ${end}`;

  // temps de chaque activité : regroupé par jour, cours et type ; minutes entières dont la somme = le total du jour (plus grand reste)
  type G = { day: string; course_id: number | null; kind: Kind; first: Date; sec: number; title: string; subject: string; minutes: number };
  const kindOf = (k: string): Kind => k === 'lesson' ? 'lesson' : k === 'exercises' || k === 'review' ? 'exercises' : k === 'evaluation' ? 'evaluation' : 'other';
  const groups = new Map<string, G>();
  for (const s of sessions) {
    const day = dayOf(s.started_at), kind = kindOf(s.kind), key = `${day}|${s.course_id ?? '-'}|${kind}`;
    const g = groups.get(key) ?? { day, course_id: s.course_id, kind, first: s.started_at, sec: 0, title: s.title ?? 'Autre activité', subject: s.subject ?? '', minutes: 0 };
    g.sec += s.active; groups.set(key, g);
  }
  const dayTotal = new Map<string, number>();
  for (const d of weekDays) {
    const gs = [...groups.values()].filter(g => g.day === d);
    const sec = gs.reduce((n, g) => n + g.sec, 0), total = Math.floor(sec / 60);
    dayTotal.set(d, total);
    if (!sec) continue;
    const parts = gs.map(g => { const x = (g.sec / sec) * total; g.minutes = Math.floor(x); return { g, rest: x - Math.floor(x) }; });
    let left = total - parts.reduce((n, p) => n + p.g.minutes, 0);
    for (const p of parts.sort((a, b) => b.rest - a.rest)) { if (left <= 0) break; p.g.minutes++; left--; }
  }
  const take = (day: string, course: number, kind: Kind) => { const k = `${day}|${course}|${kind}`; const g = groups.get(k); groups.delete(k); return g?.minutes ?? null; };

  const items: TimelineItem[] = [];
  // exercices remis : le temps du jour sur ces exercices est rattaché à la dernière série remise ce jour-là
  for (const [i, e] of subs.entries()) {
    const day = dayOf(e.submitted_at);
    const last = !subs.slice(i + 1).some(x => x.course_id === e.course_id && dayOf(x.submitted_at) === day);
    const k = Object.keys(e.auto ?? {}), ok = k.filter(id => e.auto![id]).length;
    items.push({ key: `ex-${e.id}`, at: e.submitted_at.getTime(), time: hhmm(e.submitted_at), kind: 'exercises', title: e.title, subject: e.subject,
      what: 'exercices remis', minutes: last ? take(day, e.course_id, 'exercises') : null,
      result: k.length ? `${ok} juste${ok > 1 ? 's' : ''} sur ${k.length}` : null, warn: false, href: `/parent/revoir/exercices/${e.id}` });
  }
  for (const [i, a] of atts.entries()) {
    const day = dayOf(a.submitted_at);
    const last = !atts.slice(i + 1).some(x => x.course_id === a.course_id && dayOf(x.submitted_at) === day);
    const doc = (await versionById(a.version_id))?.document;
    const qs = doc ? evalQuestions(doc, a.variant) : [];
    const blank = qs.filter(q => !(a.answers?.[q.id] ?? '').trim()).length;
    const allowed = a.deadline_at && a.started_at ? Math.round((a.deadline_at.getTime() - a.started_at.getTime()) / 60000) : doc?.evaluation.duration_min ?? 0;
    const used = a.started_at ? Math.max(1, Math.round((a.submitted_at.getTime() - a.started_at.getTime()) / 60000)) : allowed;
    const start0 = a.started_at ?? a.submitted_at;
    const m = last ? take(day, a.course_id, 'evaluation') : null;
    items.push({ key: `ev-${a.id}`, at: start0.getTime(), time: hhmm(start0), kind: 'evaluation', title: a.title, subject: a.subject,
      what: `évaluation rendue en ${used} min sur ${allowed}${blank ? ` · ${blank} sans réponse` : ''}`, minutes: m === null ? null : m,
      result: a.status === 'graded' && a.final_score !== null ? `${fr(Number(a.final_score))}/20` : 'en correction', warn: blank > 0, href: `/parent/revoir/copie/${a.id}` });
  }
  // le reste : leçons, exercices non remis, évaluations non remises, autres pages
  for (const g of groups.values()) {
    const cp = g.course_id === null ? [] : cps.filter(c => c.course_id === g.course_id && dayOf(c.at) === g.day);
    const finished = g.kind === 'lesson' && done.some(d => d.course_id === g.course_id && dayOf(d.at) === g.day);
    const okN = cp.filter(c => c.ok).length;
    items.push({ key: `g-${g.day}-${g.course_id}-${g.kind}`, at: g.first.getTime(), time: hhmm(g.first), kind: g.kind, title: g.title, subject: g.subject,
      what: g.kind === 'lesson' ? (finished ? 'leçon terminée' : 'leçon') : g.kind === 'exercises' ? 'exercices, pas encore remis' : g.kind === 'evaluation' ? 'évaluation, pas encore remise' : 'autre page',
      minutes: g.minutes, result: g.kind === 'lesson' && cp.length ? `contrôles ${okN}/${cp.length}` : null, warn: false, href: null });
  }
  // une séance de moins d'une minute sans rien remis n'est pas une activité à retracer
  const shown = items.filter(i => i.href || (i.minutes ?? 0) > 0 || i.result);
  return weekDays.map(d => ({ day: d, minutes: dayTotal.get(d) ?? 0, items: shown.filter(i => dayOf(new Date(i.at)) === d).sort((a, b) => a.at - b.at) }));
}

// ——— Revoir ensemble ———
export type Status = 'ok' | 'part' | 'ko' | 'vide' | 'attente' | 'self_ok' | 'self_ko' | 'nc';
export type ReviewQuestion = { id: string; n: number; prompt: string; status: Status; points: string | null; answer: string; answerIsOption: boolean; expected: string; solution: string | null; comment: string | null };
export type Review = {
  kind: 'copie' | 'exercices'; studentId: string; courseTitle: string; subject: string; when: string; day: string;
  score: { big: string; small: string }; chips: { label: string; status: Status | 'info' }[];
  questions: ReviewQuestion[]; editHref: string | null; editLabel: string | null; texts: unknown[];
};

const answerText = (q: Question, a: string | undefined) => {
  if (!(a ?? '').trim()) return { text: '—', option: false };
  if (q.type === 'qcm' && q.options) return { text: a!.split(',').map(i => q.options![Number(i)] ?? i).join(' ; '), option: true };
  return { text: a!, option: false };
};
const expectedText = (q: Question) => {
  if (q.type === 'qcm' && q.options) return (Array.isArray(q.answer) ? q.answer : [q.answer]).map(i => q.options![Number(i)]).join(' ; ');
  if (q.type === 'numeric') return String(q.answer).replace('.', ',').replace(/^-/, '−') + (q.tolerance ? ` (à ${String(q.tolerance).replace('.', ',')} près)` : '');
  if (q.type === 'short' && Array.isArray(q.answer)) return String(q.answer[0]) + (q.answer.length > 1 ? ` (aussi accepté : ${q.answer.slice(1).join(', ')})` : '');
  return q.solution;
};
const whenOf = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + hhmm(d);
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;

export async function copyReview(id: string): Promise<Review | null> {
  const a = await getAttempt(id);
  if (!a || !['submitted', 'graded'].includes(a.status) || !a.submitted_at) return null;
  const doc = (await versionById(a.version_id))?.document;
  if (!doc) return null;
  const [c] = await sql<{ title: string; subject: string }[]>`select c.title, sj.name as subject from courses c join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id where c.id = ${a.course_id}`;
  const graded = a.status === 'graded';
  const qs = evalQuestions(doc, a.variant);
  const questions: ReviewQuestion[] = qs.map((q, i) => {
    const ans = answerText(q, a.answers?.[q.id]);
    const max = q.points ?? 0;
    // une question sans réponse vaut 0 point, notée ou non
    const pts = ans.text === '—' ? 0 : graded ? (a.scores?.[q.id] ?? a.auto_scores?.[q.id]) : a.auto_scores?.[q.id];
    const status: Status = ans.text === '—' ? 'vide' : pts === undefined || pts === null ? 'attente' : pts >= max ? 'ok' : pts <= 0 ? 'ko' : 'part';
    const sol = q.type === 'open' ? null : q.solution?.trim() || null;
    return { id: q.id, n: i + 1, prompt: q.prompt, status, points: pts === undefined || pts === null ? `? / ${fr(max)}` : `${fr(pts)} / ${fr(max)}`,
      answer: ans.text, answerIsOption: ans.option, expected: expectedText(q), solution: sol && sol !== expectedText(q) ? sol : null,
      comment: (graded ? a.feedback?.[q.id] : null) || null };
  });
  const n = (s: Status) => questions.filter(q => q.status === s).length;
  const allowed = a.deadline_at && a.started_at ? Math.round((a.deadline_at.getTime() - a.started_at.getTime()) / 60000) : doc.evaluation.duration_min;
  const used = a.started_at ? Math.max(1, Math.round((a.submitted_at.getTime() - a.started_at.getTime()) / 60000)) : allowed;
  const chips: Review['chips'] = [
    ...(n('ok') ? [{ label: plural(n('ok'), 'juste'), status: 'ok' as const }] : []),
    ...(n('part') ? [{ label: `${n('part')} en partie`, status: 'part' as const }] : []),
    ...(n('ko') ? [{ label: plural(n('ko'), 'fausse'), status: 'ko' as const }] : []),
    ...(n('vide') ? [{ label: `${n('vide')} sans réponse`, status: 'vide' as const }] : []),
    ...(n('attente') ? [{ label: `${n('attente')} à corriger`, status: 'attente' as const }] : []),
    { label: `rendue en ${used} min sur ${allowed}`, status: 'info' },
    ...(a.focus_losses ? [{ label: `page masquée ${a.focus_losses} fois`, status: 'info' as const }] : []),
  ];
  const variant = doc.evaluation.variants[a.variant % doc.evaluation.variants.length];
  return {
    kind: 'copie', studentId: a.student_id, courseTitle: c.title, subject: c.subject, when: whenOf(a.started_at ?? a.submitted_at), day: dayOf(a.submitted_at),
    score: graded && a.final_score !== null ? { big: fr(Number(a.final_score)), small: '/20' } : { big: 'en correction', small: '' },
    chips, questions, texts: variant.texts ?? [],
    editHref: `/parent/copies/${a.id}`, editLabel: graded ? 'Modifier la note' : 'Corriger et noter',
  };
}

export async function exerciseReview(id: string): Promise<Review | null> {
  const [e] = await sql<{ student_id: string; course_id: number; version_id: string; answers: Record<string, string>; auto_results: Record<string, boolean> | null;
    self_check: Record<string, boolean> | null; submitted_at: Date | null; title: string; subject: string }[]>`
    select e.student_id, e.course_id, e.version_id, e.answers, e.auto_results, e.self_check, e.submitted_at, c.title, sj.name as subject
    from exercise_submissions e join courses c on c.id = e.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id where e.id = ${id}`;
  if (!e || !e.submitted_at) return null;
  const doc = (await versionById(e.version_id))?.document;
  if (!doc) return null;
  const auto = e.auto_results ?? {}, self = e.self_check ?? {};
  const questions: ReviewQuestion[] = doc.exercises.items.map((q, i) => {
    const ans = answerText(q, e.answers?.[q.id]);
    const status: Status = ans.text === '—' ? 'vide' : q.id in auto ? (auto[q.id] ? 'ok' : 'ko') : q.id in self ? (self[q.id] ? 'self_ok' : 'self_ko') : 'nc';
    const sol = q.type === 'open' ? null : q.solution?.trim() || null;
    return { id: q.id, n: i + 1, prompt: q.prompt, status, points: null, answer: ans.text, answerIsOption: ans.option,
      expected: expectedText(q), solution: sol && sol !== expectedText(q) ? sol : null, comment: null };
  });
  const autoIds = Object.keys(auto), okN = autoIds.filter(k => auto[k]).length;
  const n = (s: Status) => questions.filter(q => q.status === s).length;
  const chips: Review['chips'] = [
    ...(n('ok') ? [{ label: plural(n('ok'), 'juste'), status: 'ok' as const }] : []),
    ...(n('ko') ? [{ label: plural(n('ko'), 'fausse'), status: 'ko' as const }] : []),
    ...(n('vide') ? [{ label: `${n('vide')} sans réponse`, status: 'vide' as const }] : []),
    ...(n('self_ok') + n('self_ko') ? [{ label: `${n('self_ok') + n('self_ko')} rédigée${n('self_ok') + n('self_ko') > 1 ? 's' : ''}, vérifiée${n('self_ok') + n('self_ko') > 1 ? 's' : ''} par l’élève`, status: 'info' as const }] : []),
    ...(n('nc') ? [{ label: `${n('nc')} non vérifiée${n('nc') > 1 ? 's' : ''}`, status: 'nc' as const }] : []),
  ];
  return {
    kind: 'exercices', studentId: e.student_id, courseTitle: e.title, subject: e.subject, when: whenOf(e.submitted_at), day: dayOf(e.submitted_at),
    score: autoIds.length ? { big: `${okN}/${autoIds.length}`, small: 'justes' } : { big: 'remis', small: '' },
    chips, questions, texts: [], editHref: null, editLabel: null,
  };
}
