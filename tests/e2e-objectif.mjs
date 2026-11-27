// Objectif de temps par jour ou par semaine (maquette validée le 27/11/2026) : réglage du parent, anneau du jour et semaine
// sur l'accueil de l'élève, barre pendant le travail, « Mes résultats » (notes par matière, erreurs à reprendre, cette semaine),
// « Revoir ce cours » sur un cours acquis. Valeurs attendues calculées à la main. Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`.
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
const [fr, ma] = await sql`select c.id, c.title, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code in ('TG001', 'TG034') order by c.code`;
// aujourd'hui : 18 min de leçon (séance commencée à minuit et quelques, heure de Paris, pour rester le même jour)
await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
  values (${st.id}, ${fr.id}, 'lesson', least(now(), ((now() at time zone 'Europe/Paris')::date::timestamp at time zone 'Europe/Paris') + interval '1 minute'), now(), now(), 1080, 1080)`;
// une copie de maths notée 9/20 avec la première question fausse ; français acquis (16/20)
const q1 = ma.doc.evaluation.variants[0].sections.flatMap(s => s.questions)[0];
const wrong = q1.type === 'qcm' ? String((Number(Array.isArray(q1.answer) ? q1.answer[0] : q1.answer) + 1) % q1.options.length) : '999';
const [att] = await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, started_at, deadline_at, submitted_at, answers, scores, final_score, graded_at)
  values (${st.id}, ${ma.id}, ${ma.version_id}, 1, 0, 'graded', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', now() - interval '2 days' + interval '20 minutes', ${sql.json({ [q1.id]: wrong })}, ${sql.json({ [q1.id]: 0 })}, 9, now() - interval '2 days') returning id`;
await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, mastery, best_eval_score) values (${st.id}, ${fr.id}, now() - interval '5 days', now() - interval '5 days', 4, 16)`;
await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, started_at, submitted_at, answers, scores, final_score, graded_at) values (${st.id}, ${fr.id}, ${fr.version_id}, 1, 0, 'graded', now() - interval '4 days', now() - interval '4 days', '{}', '{}', 16, now() - interval '4 days')`;

const b = await chromium.launch();
const login = async (user, pass, vp) => {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  p.errs = []; p.on('pageerror', e => { if (!/#418/.test(e.message)) p.errs.push(e.message.slice(0, 80)); });
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', user); await p.fill('input[name=password]', pass);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
  return p;
};
console.log('Parent : objectif par jour');
const pa = await login('parent@test.local', 'parent-test-1234', { width: 1366, height: 900 });
await pa.goto(`${BASE}/parent/enfants/${st.id}?onglet=regles`);
await pa.click('[data-goal-form] label:has-text("Par jour")');
await pa.selectOption('select[name=daily]', '30');
for (const d of ['samedi', 'dimanche']) await pa.click(`[data-goal-form] label:has(input[aria-label="${d}"])`);
ok((await pa.locator('[data-goal-week]').innerText()).includes('3 h 30 par semaine'), 'calcul affiché : 30 min × 7 jours = 3 h 30 par semaine');
await pa.click('button:has-text("Enregistrer")'); await pa.waitForSelector('text=Règles enregistrées');
const [s1] = await sql`select settings from students where id = ${st.id}`;
ok(s1.settings.goal_mode === 'jour' && s1.settings.daily_goal_minutes === 30 && s1.settings.goal_days.length === 7 && s1.settings.weekly_goal_minutes === 210, 'enregistré : 30 min par jour, 7 jours, objectif de la semaine 210 min');

console.log('Élève : l’accueil');
const el = await login('lea', 'lea-test-1234', { width: 390, height: 844 });
await el.goto(BASE + '/eleve');
const card = (await el.locator('[data-goal-card]').innerText()).replace(/\s+/g, ' ');
ok(card.includes('18') && card.includes('sur 30 min') && card.includes('Encore 12 min pour ton objectif'), `anneau du jour : 18 sur 30 min, encore 12 min (« ${card.slice(0, 120)} »)`);
ok((await el.locator('[data-goal-week]').innerText()).includes('18 min sur 3 h 30'), 'cette semaine : 18 min sur 3 h 30');
ok(await el.locator('[data-day-cell]').count() === 7, 'les 7 jours de la semaine');
console.log('Pendant le travail');
await el.goto(`${BASE}/eleve/cours/${fr.id}/lecon`);
ok((await el.locator('[data-today-bar]').innerText()).includes('Aujourd’hui 18 / 30 min'), 'barre en haut de la leçon : Aujourd’hui 18 / 30 min');
console.log('Mes résultats');
await el.goto(BASE + '/eleve/resultats');
ok((await el.locator('[data-my-subjects]').innerText()).includes('Mathématiques') && (await el.locator('[data-my-subjects]').innerText()).includes('9 /20'), 'notes par matière : maths 9/20');
ok(await el.locator(`[data-my-errors] a[href="/eleve/cours/${ma.id}/bilan/${att.id}"]`).count() === 1, 'erreurs à reprendre : lien vers le bilan de la copie');
const wk = (await el.locator('[data-my-week]').innerText()).replace(/\s+/g, ' ');
ok(wk.includes('18 min / 3 h 30') && /Jours avec l’objectif atteint 0 sur [1-7]/.test(wk), `cette semaine : 18 min / 3 h 30, jours avec l’objectif atteint (« ${wk} »)`);
console.log('Revoir un cours acquis');
await el.goto(BASE + '/eleve/parcours?onglet=acquis');
ok(await el.locator(`[data-review-course][href="/eleve/cours/${fr.id}"]`).count() === 1, '« Revoir ce cours » sur le cours acquis');
console.log('Parent : objectif par semaine');
await pa.goto(`${BASE}/parent/enfants/${st.id}?onglet=regles`);
await pa.click('[data-goal-form] label:has-text("Par semaine")');
await pa.selectOption('select[name=goal_h]', '4');
await pa.click('button:has-text("Enregistrer")'); await pa.waitForSelector('text=Règles enregistrées');
const [s2] = await sql`select settings from students where id = ${st.id}`;
ok(s2.settings.goal_mode === 'semaine' && s2.settings.weekly_goal_minutes === 240, 'par semaine : 4 h');
await el.goto(BASE + '/eleve');
ok((await el.locator('[data-goal-week]').innerText()).includes('18 min sur 4 h') && (await el.locator('[data-goal-today]').innerText()).includes('18 min de travail'), 'l’élève voit 18 min sur 4 h, et son temps du jour sans objectif journalier');
for (const p of [pa, el]) ok(p.errs.length === 0, `aucune erreur JS (${p.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nObjectif de temps : OK');
