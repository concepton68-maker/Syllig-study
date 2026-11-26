import 'server-only';
import { sql } from './db';
import { autoCorrect, evalQuestions, type CourseDocument, type Question } from './course-format';
import { versionById } from './progress';
import { logEvent } from './activity';
import { answerText, expectedText } from './review';

// Révisions espacées (maquette validée par le propriétaire le 26/11/2026).
// Fondements : effet de test (Roediger & Karpicke 2006 ; méta-analyse Adesope et al. 2017), espacement (méta-analyse
// Cepeda et al. 2006), jugés les plus utiles par Dunlosky et al. 2013 ; intervalles qui s'allongent après une réussite (Leitner ;
// revue Kang 2016). L'intervalle optimal exact n'est pas connu (Cepeda et al. 2008) : la règle ci-dessous est simple et prudente.
//  - leçon finie → première révision le lendemain ;
//  - réussite (au moins 4 questions justes sur 5) → intervalle suivant : 1, 3, 7, 14, 30, 60 jours ;
//  - sinon → retour à 1 jour ;
//  - 5 questions par cours, corrigées par la plateforme, celles que l'élève a vues le moins récemment en révision ;
//  - au plus 2 cours par jour (les plus en retard d'abord).
export const INTERVALS = [1, 3, 7, 14, 30, 60];
export const PER_COURSE = 5;
export const MAX_COURSES = 2;
const passes = (ok: number, total: number) => ok >= Math.ceil(total * 0.8);   // 4 sur 5

type PoolItem = { key: string; q: Question };
/** Questions corrigeables par la plateforme : exercices, évaluations (sans texte support), points de contrôle de la leçon. */
export function questionPool(doc: CourseDocument): PoolItem[] {
  const ok = (q: Question) => q.type !== 'open' && !q.text_ref && autoCorrect(q, '') !== null;
  const out: PoolItem[] = [];
  for (const q of doc.exercises.items) if (ok(q)) out.push({ key: `ex:${q.id}`, q });
  doc.evaluation.variants.forEach((_, v) => { for (const q of evalQuestions(doc, v)) if (ok(q)) out.push({ key: `ev:${v}:${q.id}`, q }); });
  doc.lesson.parts.forEach((p, i) => p.checkpoint?.variants.forEach((c, j) => out.push({ key: `cp:${i}:${j}`, q: {
    id: `cp${i}_${j}`, type: 'qcm', prompt: c.quote ? `${c.prompt}\n\n« ${c.quote} »` : c.prompt, options: c.options, answer: c.answer,
    solution: c.explanation ?? c.options[c.answer] } as Question })));
  // une même question peut figurer dans deux variantes : on ne la garde qu'une fois (même énoncé)
  const seen = new Set<string>();
  return out.filter(x => { const k = x.q.prompt.trim(); if (seen.has(k)) return false; seen.add(k); return true; });
}
const findQ = (doc: CourseDocument, key: string) => questionPool(doc).find(x => x.key === key)?.q ?? null;

/** Programme les premières révisions : leçons finies sans calendrier → le lendemain de la fin de la leçon. */
async function ensureSchedule(studentId: string) {
  await sql`insert into review_schedule (student_id, course_id, step, due_at)
    select p.student_id, p.course_id, 0, p.lesson_done_at + interval '1 day' from course_progress p
    join courses c on c.id = p.course_id join course_versions v on v.course_id = c.id and v.status = 'published'
    where p.student_id = ${studentId} and p.lesson_done_at is not null
    on conflict do nothing`;
}

export type DueCourse = { course_id: number; title: string; subject: string; due_at: Date; step: number };
export async function dueCourses(studentId: string, levelCode: string): Promise<DueCourse[]> {
  await ensureSchedule(studentId);
  return sql<DueCourse[]>`select r.course_id, c.title, sj.name as subject, r.due_at, r.step from review_schedule r
    join courses c on c.id = r.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where r.student_id = ${studentId} and r.due_at <= now() and sj.level_code = ${levelCode}
    order by r.due_at limit ${MAX_COURSES}`;
}
export async function nextReviews(studentId: string, levelCode: string, n = 3) {
  await ensureSchedule(studentId);
  return sql<{ course_id: number; title: string; due_at: Date; days: number }[]>`
    select r.course_id, c.title, r.due_at,
      greatest(0, ((r.due_at at time zone 'Europe/Paris')::date - (now() at time zone 'Europe/Paris')::date))::int as days
    from review_schedule r join courses c on c.id = r.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
    where r.student_id = ${studentId} and r.due_at > now() and sj.level_code = ${levelCode} order by r.due_at limit ${n}`;
}

type SessionQ = { course_id: number; version_id: string; key: string };
export type Session = { id: string; questions: SessionQ[]; created_at: Date; finished_at: Date | null };

/** La révision du jour : celle qui est commencée, sinon une nouvelle si des cours sont à revoir. */
export async function openSession(studentId: string, levelCode: string): Promise<Session | null> {
  const [cur] = await sql<Session[]>`select id, questions, created_at, finished_at from review_sessions where student_id = ${studentId} and finished_at is null order by created_at desc limit 1`;
  if (cur) return cur;
  const due = await dueCourses(studentId, levelCode);
  const questions: SessionQ[] = [];
  for (const d of due) {
    const [v] = await sql<{ id: string; document: CourseDocument }[]>`select id, document from course_versions where course_id = ${d.course_id} and status = 'published'`;
    if (!v) continue;
    const pool = questionPool(v.document);
    if (!pool.length) {   // aucun question corrigeable : on ne bloque pas, on passe à l'intervalle suivant
      await sql`update review_schedule set due_at = now() + make_interval(days => ${INTERVALS[Math.min(d.step + 1, INTERVALS.length - 1)]}) where student_id = ${studentId} and course_id = ${d.course_id}`;
      continue;
    }
    const seen = await sql<{ key: string; last: Date }[]>`select key, max(answered_at) as last from review_items where student_id = ${studentId} and course_id = ${d.course_id} group by key`;
    const last = new Map(seen.map(s => [s.key, s.last.getTime()]));
    const [prev] = await sql<{ keys: string[] }[]>`select array_agg(i.key) as keys from review_items i where i.session_id = (
      select session_id from review_items where student_id = ${studentId} and course_id = ${d.course_id} order by answered_at desc limit 1) and i.course_id = ${d.course_id}`;
    const recent = new Set(prev?.keys ?? []);
    // jamais vues d'abord (au hasard), puis les plus anciennes ; jamais deux fois de suite la même si le choix le permet
    const ranked = pool.map(p => ({ p, t: last.get(p.key) ?? -1, r: Math.random() })).sort((a, b) => a.t - b.t || a.r - b.r);
    const fresh = ranked.filter(x => !recent.has(x.p.key));
    const pick = [...fresh, ...ranked.filter(x => recent.has(x.p.key))].slice(0, PER_COURSE);
    for (const x of pick) questions.push({ course_id: d.course_id, version_id: v.id, key: x.p.key });
  }
  if (!questions.length) return null;
  const [s] = await sql<Session[]>`insert into review_sessions (student_id, questions) values (${studentId}, ${sql.json(questions)}) returning id, questions, created_at, finished_at`;
  return s;
}

export type PublicQ = { idx: number; course: string; prompt: string; type: Question['type']; options: string[] | null; multi: boolean };
export type Answered = { idx: number; correct: boolean; given: string; expected: string; solution: string | null };
export type Summary = { course_id: number; title: string; ok: number; total: number; passed: boolean; next_days: number }[];

/** Questions de la séance, sans les réponses (envoyées au navigateur), et ce qui est déjà répondu (reprise). */
export async function sessionView(s: Session): Promise<{ questions: PublicQ[]; answered: Answered[] }> {
  const titles = new Map((await sql<{ id: number; title: string }[]>`select id, title from courses where id = any(${[...new Set(s.questions.map(q => q.course_id))]}::int[])`).map(r => [r.id, r.title]));
  const items = await sql<{ idx: number; answer: string; correct: boolean }[]>`select idx, answer, correct from review_items where session_id = ${s.id}`;
  const questions: PublicQ[] = [], answered: Answered[] = [];
  for (const [idx, x] of s.questions.entries()) {
    const doc = (await versionById(x.version_id))?.document;
    const q = doc ? findQ(doc, x.key) : null;
    if (!q) continue;
    questions.push({ idx, course: titles.get(x.course_id) ?? '', prompt: q.prompt, type: q.type, options: q.options ?? null, multi: Array.isArray(q.answer) && q.type === 'qcm' && q.answer.length > 1 });
    const it = items.find(i => i.idx === idx);
    if (it) answered.push(feedback(idx, q, it.answer, it.correct));
  }
  return { questions, answered };
}
function feedback(idx: number, q: Question, given: string, correct: boolean): Answered {
  const exp = expectedText(q);
  const sol = q.solution?.trim() && q.solution.trim() !== exp ? q.solution.trim() : null;
  return { idx, correct, given: answerText(q, given).text, expected: exp, solution: sol };
}

/** Une réponse : corrigée aussitôt ; à la dernière, la séance est close et les prochaines dates calculées. */
export async function answerQuestion(studentId: string, sessionId: string, idx: number, answer: string): Promise<{ result: Answered; summary: Summary | null } | null> {
  const [s] = await sql<Session[]>`select id, questions, created_at, finished_at from review_sessions where id = ${sessionId} and student_id = ${studentId}`;
  if (!s || s.finished_at || !s.questions[idx]) return null;
  const x = s.questions[idx];
  const doc = (await versionById(x.version_id))?.document;
  const q = doc ? findQ(doc, x.key) : null;
  if (!q) return null;
  const correct = autoCorrect(q, answer) === true;
  const ins = await sql`insert into review_items (session_id, idx, student_id, course_id, key, answer, correct) values (${s.id}, ${idx}, ${studentId}, ${x.course_id}, ${x.key}, ${answer.slice(0, 500)}, ${correct})
    on conflict do nothing returning 1`;
  if (!ins.length) {   // déjà répondu (double clic) : on renvoie la réponse enregistrée
    const [it] = await sql<{ answer: string; correct: boolean }[]>`select answer, correct from review_items where session_id = ${s.id} and idx = ${idx}`;
    return { result: feedback(idx, q, it.answer, it.correct), summary: null };
  }
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from review_items where session_id = ${s.id}`;
  const summary = n >= s.questions.length ? await finish(studentId, s) : null;
  return { result: feedback(idx, q, answer, correct), summary };
}

async function finish(studentId: string, s: Session): Promise<Summary> {
  const done = await sql`update review_sessions set finished_at = now() where id = ${s.id} and finished_at is null returning 1`;
  if (!done.length) return [];
  const rows = await sql<{ course_id: number; title: string; ok: number; total: number }[]>`
    select i.course_id, c.title, count(*) filter (where i.correct)::int as ok, count(*)::int as total from review_items i join courses c on c.id = i.course_id
    where i.session_id = ${s.id} group by i.course_id, c.title`;
  const out: Summary = [];
  for (const r of rows) {
    const [sch] = await sql<{ step: number }[]>`select step from review_schedule where student_id = ${studentId} and course_id = ${r.course_id}`;
    const step = sch?.step ?? 0;
    const passed = passes(r.ok, r.total);
    const nextStep = passed ? Math.min(step + 1, INTERVALS.length - 1) : 0;
    const nextDays = INTERVALS[nextStep];
    // écart depuis la révision précédente (ou depuis la fin de la leçon), en jours civils de Paris
    const [g] = await sql<{ gap: number }[]>`select greatest(0, ((now() at time zone 'Europe/Paris')::date - (coalesce(
        (select max(at) from review_results where student_id = ${studentId} and course_id = ${r.course_id}),
        (select lesson_done_at from course_progress where student_id = ${studentId} and course_id = ${r.course_id}), now()) at time zone 'Europe/Paris')::date))::int as gap`;
    await sql`insert into review_results (student_id, course_id, session_id, ok, total, gap_days, passed, next_days)
      values (${studentId}, ${r.course_id}, ${s.id}, ${r.ok}, ${r.total}, ${g.gap}, ${passed}, ${nextDays})`;
    await sql`insert into review_schedule (student_id, course_id, step, due_at) values (${studentId}, ${r.course_id}, ${nextStep}, now() + make_interval(days => ${nextDays}))
      on conflict (student_id, course_id) do update set step = excluded.step, due_at = excluded.due_at`;
    await logEvent(studentId, 'revision_espacee', { courseId: r.course_id, data: { justes: r.ok, total: r.total, prochaine_dans_jours: nextDays } });
    out.push({ course_id: r.course_id, title: r.title, ok: r.ok, total: r.total, passed, next_days: nextDays });
  }
  return out;
}

/** Côté parent (Bilan) : chaque révision depuis le 1er septembre, par cours, et la prochaine date. */
export async function reviewOverview(studentId: string, levelCode: string, since: Date) {
  await ensureSchedule(studentId);
  const sched = await sql<{ course_id: number; title: string; subject: string; due_at: Date }[]>`
    select r.course_id, c.title, sj.name as subject, r.due_at from review_schedule r join courses c on c.id = r.course_id
    join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id where r.student_id = ${studentId} and sj.level_code = ${levelCode} order by r.due_at`;
  const res = await sql<{ course_id: number; at: Date; ok: number; total: number; gap_days: number; passed: boolean }[]>`
    select course_id, at, ok, total, gap_days, passed from review_results where student_id = ${studentId} and at >= ${since} order by at`;
  const courses = sched.map(c => ({ ...c, results: res.filter(r => r.course_id === c.course_id) }));
  return { courses, ok: res.reduce((n, r) => n + r.ok, 0), total: res.reduce((n, r) => n + r.total, 0), count: res.length };
}
