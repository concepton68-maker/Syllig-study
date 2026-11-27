// « M'entraîner » sur un cours déjà fait (maquette validée le 27/11/2026) : trois choix sur un cours acquis, 5 questions
// (exercices et points de contrôle, jamais l'évaluation) corrigées aussitôt, fin avec le résultat et la partie à relire,
// note et calendrier des révisions inchangés, ligne « entraînement (sans note) » dans l'Activité du parent, nouvelles questions
// au tour suivant. Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale' where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const [c] = await sql`select c.id, c.title, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = 'TG001'`;
// cours acquis : leçon, exercices, évaluation notée 16/20 hier (délai de nouvelle tentative pas encore passé)
await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, mastery, best_eval_score) values (${st.id}, ${c.id}, now() - interval '5 days', now() - interval '5 days', 4, 16)`;
await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, started_at, submitted_at, answers, scores, final_score, graded_at)
  values (${st.id}, ${c.id}, ${c.version_id}, 1, 0, 'graded', now() - interval '1 day', now() - interval '1 day', '{}', '{}', 16, now() - interval '1 day')`;
await sql`insert into review_schedule (student_id, course_id, step, due_at) values (${st.id}, ${c.id}, 2, now() + interval '5 days')`;
const [sched0] = await sql`select step, due_at from review_schedule where student_id = ${st.id} and course_id = ${c.id}`;
const evalIds = new Set(c.doc.evaluation.variants.flatMap(v => v.sections.flatMap(s => s.questions.map(q => q.id))));

const b = await chromium.launch();
const login = async (user, pass) => {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.errs = []; p.on('pageerror', e => { if (!/#418/.test(e.message)) p.errs.push(e.message.slice(0, 80)); }); p.on('dialog', d => { p.errs.push('fenêtre native'); d.dismiss(); });
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', user); await p.fill('input[name=password]', pass);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
  return p;
};
const el = await login('lea', 'lea-test-1234');

console.log('1. Cours acquis : trois choix');
await el.goto(`${BASE}/eleve/cours/${c.id}`);
ok(await el.locator('[data-redo] [data-train]').count() === 1, '« M’entraîner » en premier');
ok(await el.locator(`[data-reread][href="/eleve/cours/${c.id}/lecon?debut=1"]`).count() === 1, '« Relire la leçon » depuis le début');
const retake = (await el.locator('[data-retake]').innerText()).replace(/\s+/g, ' ');
ok(retake.includes('Un autre sujet') && retake.includes('Possible à partir du'), `« Repasser le test » : autre sujet, date affichée (« ${retake} »)`);
ok((await el.locator('[data-redo]').innerText()).includes('Ta meilleure note : 16/20'), 'meilleure note rappelée');

console.log('2. Entraînement : 5 questions, la première ratée exprès');
await el.click('[data-redo] [data-train]');
await el.waitForURL(/\/entrainement$/);
const [s1] = await sql`select id, questions from review_sessions where student_id = ${st.id} and kind = 'entrainement' and course_id = ${c.id} and finished_at is null`;
ok(s1 && s1.questions.length === 5, '5 questions choisies');
ok(s1.questions.every(q => q.key.startsWith('ex:') || q.key.startsWith('cp:')) && !s1.questions.some(q => evalIds.has(q.key.slice(3))), 'uniquement exercices et points de contrôle, jamais l’évaluation');
const qOf = key => {
  if (key.startsWith('ex:')) return c.doc.exercises.items.find(q => q.id === key.slice(3));
  const [, i, j] = key.split(':').map(Number); const v = c.doc.lesson.parts[i].checkpoint.variants[j];
  return { type: 'qcm', answer: v.answer, options: v.options, part: i + 1 };
};
let wrongPart = null;
for (let n = 0; n < 5; n++) {
  await el.waitForSelector('[data-review-q]');
  const idx = Number(await el.locator('[data-review-q]').getAttribute('data-review-q'));
  const key = s1.questions[idx].key, q = qOf(key);
  const wrong = n === 0;
  if (wrong) wrongPart = q.part ?? q.lesson_part ?? null;
  if (q.type === 'qcm') {
    const right = Array.isArray(q.answer) ? q.answer[0] : q.answer;
    await el.click(`[data-option="${wrong ? (right + 1) % q.options.length : right}"]`);
    if (Array.isArray(q.answer) && q.answer.length > 1 && !wrong) { for (const k of q.answer.slice(1)) await el.click(`[data-option="${k}"]`); await el.click('button:has-text("Valider")'); }
    else if (Array.isArray(q.answer) && q.answer.length > 1) await el.click('button:has-text("Valider")');
  } else {
    await el.fill('input[aria-label="Ta réponse"]', wrong ? 'zzz' : String(Array.isArray(q.answer) ? q.answer[0] : q.answer));
    await el.click('button:has-text("Valider")');
  }
  await el.waitForSelector(`[data-review-result="${wrong ? 'faux' : 'juste'}"]`);
  if (n === 0) ok((await el.locator('[data-review-q]').innerText()).includes('Ça ne change pas ta note'), 'rappel : ça ne change pas la note');
  await el.click('[data-review-next]');
}
await el.waitForSelector('[data-training-done]');
const done = (await el.locator('[data-training-done]').innerText()).replace(/\s+/g, ' ');
ok(done.includes('4 justes sur 5') && (done.match(/À revoir/g) ?? []).length === 1, `fin : 4 justes sur 5, une question à revoir (« ${done.slice(0, 120)} »)`);
if (wrongPart) ok(await el.locator(`[data-reread-part="${wrongPart}"][href="/eleve/cours/${c.id}/lecon?debut=1#partie-${wrongPart}"]`).count() === 1, `lien vers la partie ${wrongPart} de la leçon à relire`);

console.log('3. Rien ne change dans la note ni le calendrier');
const [p] = await sql`select best_eval_score, mastery from course_progress where student_id = ${st.id} and course_id = ${c.id}`;
ok(Number(p.best_eval_score) === 16 && p.mastery === 4, 'meilleure note 16/20 et niveau inchangés');
const [sched1] = await sql`select step, due_at from review_schedule where student_id = ${st.id} and course_id = ${c.id}`;
ok(sched1.step === sched0.step && sched1.due_at.getTime() === sched0.due_at.getTime(), 'calendrier des révisions espacées inchangé');
ok((await sql`select count(*)::int as n from review_results where student_id = ${st.id}`)[0].n === 0, 'aucun résultat de révision espacée créé');
const [log] = await sql`select data from activity_log where student_id = ${st.id} and event = 'entrainement' order by at desc limit 1`;
ok(log && log.data.justes === 4 && log.data.total === 5, 'journal : entraînement 4/5');

console.log('4. 5 autres questions');
await el.click('[data-train-again]');
await el.waitForSelector('[data-review-q]');
const [s2] = await sql`select questions from review_sessions where student_id = ${st.id} and kind = 'entrainement' and finished_at is null`;
const before = new Set(s1.questions.map(q => q.key));
const freshN = s2.questions.filter(q => !before.has(q.key)).length;
ok(s2.questions.length === 5 && freshN === 5, `nouvelle série : ${freshN} questions sur 5 pas vues au tour précédent`);
ok((await sql`select count(*)::int as n from review_sessions where student_id = ${st.id} and kind = 'revision'`)[0].n === 0, 'la révision du jour n’est pas mélangée avec l’entraînement');

console.log('6. Pas avant les exercices remis (leurs corrigés s’y affichent), pas le jour de la révision du cours');
const [c2] = await sql`select id from courses where code = 'TG002'`;
await sql`insert into course_progress (student_id, course_id, lesson_done_at, mastery) values (${st.id}, ${c2.id}, now() - interval '1 day', 1)`;
await el.goto(`${BASE}/eleve/cours/${c2.id}`);
ok(await el.locator('[data-train]').count() === 0, 'leçon finie, exercices pas remis : pas de « M’entraîner »');
await el.goto(`${BASE}/eleve/cours/${c2.id}/entrainement`);
ok(new URL(el.url()).pathname === `/eleve/cours/${c2.id}` && (await sql`select count(*)::int as n from review_sessions where course_id = ${c2.id}`)[0].n === 0, 'adresse directe : renvoyé au cours, aucune séance créée');
await sql`delete from review_sessions where student_id = ${st.id} and kind = 'entrainement' and finished_at is null`;
await sql`update review_schedule set due_at = now() - interval '1 hour' where student_id = ${st.id} and course_id = ${c.id}`;
await el.goto(`${BASE}/eleve/cours/${c.id}`);
ok(await el.locator('[data-train-revision][href="/eleve/revision"]').count() === 1 && await el.locator('[data-train]').count() === 0, 'révision du cours due : « Ta révision du jour » à la place de l’entraînement');
await el.goto(`${BASE}/eleve/cours/${c.id}/entrainement`);
ok(new URL(el.url()).pathname === `/eleve/cours/${c.id}`, 'adresse directe le jour de la révision : renvoyé au cours');
await el.goto(`${BASE}/eleve/revision`);
ok(await el.locator('[data-review-q]').count() === 1, 'la révision du jour s’ouvre normalement');

// révision due mais limite de 2 cours atteinte aujourd'hui : la révision du jour ne le propose pas, l'entraînement reste possible
const others = await sql`select id from courses where code in ('TG034', 'TG035')`;
const [sess] = await sql`insert into review_sessions (student_id, questions, finished_at) values (${st.id}, '[]', now()) returning id`;
for (const o of others) await sql`insert into review_results (student_id, course_id, session_id, ok, total, gap_days, passed, next_days) values (${st.id}, ${o.id}, ${sess.id}, 5, 5, 1, true, 3)`;
await sql`delete from review_sessions where student_id = ${st.id} and kind = 'revision' and finished_at is null`;
await el.goto(`${BASE}/eleve/cours/${c.id}`);
ok(await el.locator('[data-train]').count() === 1 && await el.locator('[data-train-revision]').count() === 0, '2 cours déjà révisés aujourd’hui : ce cours n’est pas proposé en révision, « M’entraîner » revient');

console.log('5. Le parent le voit dans l’Activité');
const pa = await login('parent@test.local', 'parent-test-1234');
await pa.goto(`${BASE}/parent/journal?eleve=${st.id}`);
const act = (await pa.locator('main').innerText()).replace(/\s+/g, ' ');
ok(act.includes('entraînement (sans note)') && act.includes('4 justes sur 5'), 'Activité : « entraînement (sans note) », 4 justes sur 5');
for (const x of [el, pa]) ok(x.errs.length === 0, `aucune erreur JS (${x.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nEntraînement : OK');
