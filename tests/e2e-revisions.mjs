// Révisions espacées (maquette validée le 26/11/2026) : leçon finie → révision le lendemain ; réussite (≥ 4/5) → intervalle
// suivant (1, 3, 7, 14, 30, 60 j) ; échec → 1 jour ; jusqu'à 5 questions par cours (exercices et points de contrôle), corrigées par la plateforme ; au plus 2 cours.
// Valeurs attendues calculées à la main. Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`.
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
const cs = await sql`select c.id, c.code, c.title, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code in ('TG001', 'TG034') order by c.code`;
const [fr, ma] = cs;
// maths finie il y a 3 jours (révision due il y a 2 jours), français il y a 2 jours (due hier) : maths passe en premier
await sql`insert into course_progress (student_id, course_id, lesson_done_at) values (${st.id}, ${ma.id}, now() - interval '3 days'), (${st.id}, ${fr.id}, now() - interval '2 days')`;

// bonne réponse d'une question de la séance, à partir du cours (clé ex:/ev:/cp:)
const findQ = (doc, key) => {
  const [t, a, b] = key.split(':');
  if (t === 'ex') return doc.exercises.items.find(q => q.id === a);
  if (t === 'ev') return doc.evaluation.variants[+a].sections.flatMap(s => s.questions).find(q => q.id === b);
  const c = doc.lesson.parts[+a].checkpoint.variants[+b]; return { type: 'qcm', options: c.options, answer: c.answer };
};
const b = await chromium.launch();
const el = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = []; el.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
el.on('dialog', d => { errs.push('fenêtre native'); d.dismiss(); });
await el.goto(BASE + '/connexion'); await el.fill('input[name=login]', 'lea'); await el.fill('input[name=password]', 'lea-test-1234');
await el.click('button[type=submit]'); await el.waitForURL(u => !u.pathname.startsWith('/connexion'));

console.log('Accueil de l’élève');
const card = (await el.locator('[data-review-today]').innerText()).replace(/\s+/g, ' ');
ok(card.includes('Ta révision du jour') && card.includes('2 cours') && card.includes(ma.title) && card.includes(fr.title), `2 cours à revoir (« ${card.slice(0, 140)} »)`);

console.log('La révision : maths tout juste, français tout faux');
await el.click('[data-review-today] a:has-text("Commencer")'); await el.waitForURL(/\/eleve\/revision/);
const [ses] = await sql`select id, questions from review_sessions where student_id = ${st.id} and finished_at is null`;
ok(ses.questions.length === 10 && ses.questions.slice(0, 5).every(q => q.course_id === ma.id) && ses.questions.slice(5).every(q => q.course_id === fr.id), '10 questions : 5 de maths (plus en retard) puis 5 de français');
ok(new Set(ses.questions.map(q => `${q.course_id}:${q.key}`)).size === 10, 'aucune question en double (un même numéro peut exister dans deux cours)');
ok(ses.questions.every(q => !q.key.startsWith('ev:')), 'aucune question de l’évaluation (elle doit rester inconnue)');
ok(new Set(ses.questions.filter(q => q.key.startsWith('cp:')).map(q => `${q.course_id}:${q.key.split(':')[1]}`)).size === ses.questions.filter(q => q.key.startsWith('cp:')).length, 'une seule variante par point de contrôle');
const answerIt = async (i, right) => {
  const sq = ses.questions[i]; const q = findQ(sq.course_id === ma.id ? ma.doc : fr.doc, sq.key);
  await el.waitForSelector(`[data-review-q="${i}"]`);
  if (q.type === 'qcm') {
    const good = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(Number);
    const picks = right ? good : [[...Array(q.options.length).keys()].find(k => !good.includes(k))];
    if (good.length > 1) { for (const k of picks) await el.click(`[data-review-q="${i}"] [data-option="${k}"]`); await el.click('button:has-text("Valider")'); }
    else await el.click(`[data-review-q="${i}"] [data-option="${picks[0]}"]`);
  } else {
    await el.fill('input[aria-label="Ta réponse"]', right ? (q.type === 'numeric' ? String(q.answer).replace('.', ',') : String(q.answer[0])) : 'zzz');
    await el.click('button:has-text("Valider")');
  }
  await el.waitForSelector('[data-review-result]');
  ok((await el.getAttribute('[data-review-result]', 'data-review-result')) === (right ? 'juste' : 'faux'), `question ${i + 1} : ${right ? 'juste' : 'fausse, avec la réponse attendue'}`);
  await el.click('[data-review-next]');
};
await answerIt(0, true);
await el.reload();   // reprise après un rechargement : on continue où on en était
await answerIt(1, true);
for (let i = 2; i < 5; i++) await answerIt(i, true);
for (let i = 5; i < 10; i++) await answerIt(i, false);
await el.waitForSelector('[data-review-done]');
ok((await el.locator('[data-review-score]').innerText()).includes('5 / 10'), 'résultat : 5 / 10');
ok(await el.locator('[data-next="3"]').count() === 1 && await el.locator('[data-next="1"]').count() === 1, 'maths 5/5 → dans 3 jours ; français 0/5 → demain');
const sch = await sql`select course_id, step, ((due_at at time zone 'Europe/Paris')::date - (now() at time zone 'Europe/Paris')::date)::int as d from review_schedule where student_id = ${st.id} order by course_id`;
const s = Object.fromEntries(sch.map(r => [r.course_id, r]));
ok(s[ma.id].step === 1 && s[ma.id].d === 3 && s[fr.id].step === 0 && s[fr.id].d === 1, 'calendrier enregistré : maths palier 2 (3 j), français palier 1 (1 j)');
const pts = await sql`select coalesce(sum(amount), 0)::int as n from points_ledger where student_id = ${st.id}`;
ok(pts[0].n === 0, 'pas de points retirés ni ajoutés en douce');

console.log('Au plus 2 cours par jour');
await sql`update review_schedule set due_at = now() - interval '1 minute' where student_id = ${st.id} and course_id = ${ma.id}`;
await el.goto(BASE + '/eleve/revision');
ok(await el.locator('[data-no-review]').count() === 1, 'déjà 2 cours revus aujourd’hui : pas de nouvelle séance');

console.log('Le lendemain : d’autres questions');
await sql`update review_results set at = at - interval '1 day' where student_id = ${st.id}`;
await el.goto(BASE + '/eleve/revision');
const [ses2] = await sql`select questions from review_sessions where student_id = ${st.id} and finished_at is null`;
const before = new Set(ses.questions.filter(q => q.course_id === ma.id).map(q => q.key));
ok(ses2.questions.length === 5 && ses2.questions.every(q => !before.has(q.key)), 'maths : 5 questions qu’elle n’a pas eues la dernière fois');
await sql`delete from review_sessions where student_id = ${st.id} and finished_at is null`;
await sql`update review_schedule set due_at = now() + interval '3 days' where student_id = ${st.id} and course_id = ${ma.id}`;

console.log('Côté parent');
const pa = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(BASE + '/parent/bilan');
ok((await pa.locator('[data-revisions-total]').innerText()).includes('5 questions justes sur 10') && (await pa.locator('[data-revisions-total]').innerText()).includes('2 révisions'), 'Bilan : 5 justes sur 10, 2 révisions');
const rm = (await pa.locator(`[data-revision-course="${ma.id}"]`).innerText()).replace(/\s+/g, ' ');
const rf = (await pa.locator(`[data-revision-course="${fr.id}"]`).innerText()).replace(/\s+/g, ' ');
ok(rm.includes('J+3 · 5/5') && rm.includes('dans 3 jours'), `maths : J+3 · 5/5, prochaine dans 3 jours (« ${rm} »)`);
ok(rf.includes('J+2 · 0/5') && rf.includes('demain'), `français : J+2 · 0/5, prochaine demain (« ${rf} »)`);
await pa.click('[data-revisions-sources] summary');
const src = await pa.locator('[data-revisions-sources]').innerText();
ok(src.includes('Roediger') && src.includes('Cepeda') && src.includes('Dunlosky') && src.includes('pas prouvé'), 'règle, études et limite affichées');
await pa.goto(BASE + '/parent/journal?type=revisions');
await sql`update review_results set at = at + interval '1 day' where student_id = ${st.id}`;
await pa.goto(BASE + '/parent/journal?type=revisions');
ok(await pa.locator('[data-item="review"]:has-text("5/5")').count() === 1 && await pa.locator('[data-item="review"]:has-text("0/5")').count() === 1, 'Activité : les 2 révisions, filtre « Révisions »');
ok(errs.length === 0, `aucune erreur JS ni fenêtre native (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nRévisions espacées : OK');
