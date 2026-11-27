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
// jours comptés : les jours d'objectif passés (lundi → hier), aujourd'hui seulement s'il est atteint
const [{ dow }] = await sql`select extract(isodow from now() at time zone 'Europe/Paris')::int as dow`;
ok(wk.includes('18 min / 3 h 30') && wk.includes(`Jours avec l’objectif atteint jours d’objectif passés, et aujourd’hui s’il est atteint 0 sur ${dow - 1}`), `cette semaine : 18 min / 3 h 30, 0 jour atteint sur ${dow - 1} (« ${wk} »)`);
console.log('Seuil de l’objectif du jour (30 min = 1800 s)');
const today = (sec) => sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
  values (${st.id}, ${fr.id}, 'exercises', least(now(), ((now() at time zone 'Europe/Paris')::date::timestamp at time zone 'Europe/Paris') + interval '2 minutes'), now(), now(), ${sec}, ${sec})`;
await today(719);   // 1080 + 719 = 1799 s = 29 min (arrondi vers le bas)
await el.goto(BASE + '/eleve');
ok((await el.locator('[data-goal-today]').innerText()).includes('Encore 1 min'), '1799 s : 29 min, encore 1 min');
await today(1);     // 1800 s
await el.goto(BASE + '/eleve');
ok((await el.locator('[data-goal-today]').innerText()).includes('Objectif du jour atteint') && await el.locator('[data-day-cell="atteint"]').count() === 1, '1800 s : objectif du jour atteint, une case bleue');
await el.goto(BASE + '/eleve/resultats');
ok((await el.locator('[data-my-week]').innerText()).replace(/\s+/g, ' ').includes(`1 sur ${dow}`), `aujourd’hui atteint : 1 sur ${dow}`);
console.log('Erreurs des exercices');
// un autre cours (le français a déjà sa copie dans les erreurs) : exercices remis avec 2 réponses fausses
const [ex] = await sql`select c.id, v.id as version_id from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = 'TG002'`;
await sql`insert into exercise_submissions (student_id, course_id, version_id, auto_results, submitted_at, checked_at, created_at) values (${st.id}, ${ex.id}, ${ex.version_id}, ${sql.json({ a: true, b: false, c: false })}, now() - interval '1 hour', now() - interval '1 hour', now() - interval '2 hours')`;
await el.goto(BASE + '/eleve/resultats');
const exLink = el.locator(`[data-my-errors] a[href="/eleve/cours/${ex.id}/exercices"]`);
ok(await exLink.count() === 1 && (await exLink.innerText()).includes('2 erreurs dans les exercices'), 'exercices remis : 2 erreurs, lien vers les exercices');
await sql`insert into exercise_submissions (student_id, course_id, version_id) values (${st.id}, ${ex.id}, ${ex.version_id})`;
await el.goto(BASE + '/eleve/resultats');
ok(await el.locator(`[data-my-errors] a[href="/eleve/cours/${ex.id}/exercices"]`).count() === 0, 'série recommencée (vide) : plus de lien vers une page sans les erreurs');
console.log('Le parent voit le même objectif');
await pa.goto(`${BASE}/parent/journal?eleve=${st.id}`);
ok((await pa.locator('main').innerText()).includes('objectif 3 h 30'), 'Activité : objectif 3 h 30');
console.log('Leçon finie : relire depuis le début');
await sql`update course_progress set lesson_done_at = now() where student_id = ${st.id} and course_id = ${fr.id}`;
await el.goto(`${BASE}/eleve/cours/${fr.id}`);
ok(await el.locator(`a[href="/eleve/cours/${fr.id}/lecon?debut=1"]`).count() >= 1, 'le lien de la leçon finie la rouvre au début');
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
ok((await el.locator('[data-goal-week]').innerText()).includes('30 min sur 4 h') && (await el.locator('[data-goal-today]').innerText()).includes('30 min de travail'), 'l’élève voit 30 min sur 4 h, et son temps du jour sans objectif journalier');
console.log('Barre en direct : le chiffre vient du serveur');
const live = await el.evaluate(async (c) => {
  const post = (b) => fetch('/api/activity', { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
  const { session } = await post({ action: 'start', kind: 'lesson', courseId: c });
  const beat = await post({ action: 'beat', session, active: true, gesture: true });
  await post({ action: 'end', session, active: false });
  const late = await fetch('/api/activity', { method: 'POST', body: JSON.stringify({ action: 'beat', session, active: true }) });
  return { today: beat.today, late: late.status };
}, fr.id);
ok(live.today >= 1800 && live.today <= 1803, `signal accepté : total du jour renvoyé par le serveur (${live.today} s)`);
ok(live.late === 409, 'signal d’une séance fermée refusé : rien n’est ajouté à la barre');
console.log('Parent : refus du formulaire');
await pa.goto(`${BASE}/parent/enfants/${st.id}?onglet=regles`);
await pa.click('[data-goal-form] label:has-text("Par jour")');
for (const d of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) { const c = pa.locator(`[data-goal-form] input[aria-label="${d}"]`); if (await c.isChecked()) await pa.click(`[data-goal-form] label:has(input[aria-label="${d}"])`); }
await pa.click('button:has-text("Enregistrer")'); await pa.waitForSelector('text=au moins un jour');
const [s3] = await sql`select settings from students where id = ${st.id}`;
ok(s3.settings.goal_mode === 'semaine' && s3.settings.weekly_goal_minutes === 240, 'aucun jour coché : refusé, réglage inchangé');
for (const p of [pa, el]) ok(p.errs.length === 0, `aucune erreur JS (${p.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nObjectif de temps : OK');
