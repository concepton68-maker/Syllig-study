// « Activité » du parent (maquette validée le 26/11/2026) : 3 chiffres, ce qui a été fait jour par jour, « Revoir ensemble » (copie et exercices).
// Valeurs attendues calculées à la main sur des données construites. Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`.
// Usage : BASE=… DATABASE_URL=… node tests/e2e-activite.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"weekly_goal_minutes": 300, "gender": "fille"}'::jsonb where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const cs = await sql`select c.id, c.title, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code in ('TG001', 'TG034') order by c.code`;
const [fr, ma] = cs;   // TG001 français, TG034 mathématiques
// lundi 0 h (heure de Paris) de la semaine en cours
const mon = sql`(date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')`;
const ses = (c, kind, minutes, hoursAfterMonday) => sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
  values (${st.id}, ${c.id}, ${kind}, ${mon} + make_interval(hours => ${hoursAfterMonday}), now(), now(), ${minutes * 60 + 60}, ${minutes * 60})`;
// lundi : 40 min de leçon de français + 20 min d'exercices de maths (= 60 min, 1 jour) ; lundi 9 h et 10 h
await ses(fr, 'lesson', 40, 9); await ses(ma, 'exercises', 20, 10);
// lundi 18 h : évaluation de maths, 15 min (= total 75 min)
await ses(ma, 'evaluation', 15, 18);
// 3 semaines plus tôt : 25 min (calendrier seulement)
await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
  values (${st.id}, ${fr.id}, 'lesson', ${mon} - interval '20 days' + interval '10 hours', now(), now(), 1600, 1500)`;
await sql`insert into course_progress (student_id, course_id, lesson_done_at, next_review_at) values (${st.id}, ${fr.id}, ${mon} + interval '9 hours 40 minutes', now() - interval '5 days')`;
// copie de maths incomplète : 2 min utilisées sur 30, la première question fausse, le reste vide ; notée 3/20 ; 2 sorties de fenêtre
const v0 = ma.doc.evaluation.variants[0];
const qs = v0.sections.flatMap(s => s.questions);
const q1 = qs[0];
const wrong = q1.type === 'qcm' ? String((Number(Array.isArray(q1.answer) ? q1.answer[0] : q1.answer) + 1) % q1.options.length) : '999';
await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, started_at, deadline_at, submitted_at, answers, scores, final_score, focus_losses, focus_lost_seconds)
  values (${st.id}, ${ma.id}, ${ma.version_id}, 1, 0, 'graded', ${mon} + interval '18 hours', ${mon} + interval '18 hours 30 minutes', ${mon} + interval '18 hours 2 minutes',
    ${sql.json({ [q1.id]: wrong })}, ${sql.json({ [q1.id]: 0 })}, 3, 2, 130)`;

// exercices de français remis DEUX fois avec la même erreur : la question ne doit apparaître qu'une fois (dernière série)
const exq = fr.doc.exercises.items.find(q => q.type === 'qcm');
const exWrong = String((Number(Array.isArray(exq.answer) ? exq.answer[0] : exq.answer) + 1) % exq.options.length);
for (const h of [11, 12]) await sql`insert into exercise_submissions (student_id, course_id, version_id, answers, auto_results, submitted_at, checked_at)
  values (${st.id}, ${fr.id}, ${fr.version_id}, ${sql.json({ [exq.id]: exWrong })}, ${sql.json({ [exq.id]: false })}, ${mon} + make_interval(hours => ${h}), ${mon} + make_interval(hours => ${h}))`;

const b = await chromium.launch();
const pa = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errs = []; pa.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(BASE + '/parent/journal');
const txt = async sel => (await pa.locator(sel).innerText()).replace(/\s+/g, ' ');

console.log('La semaine en chiffres');
ok((await pa.locator('[data-goal] svg').getAttribute('aria-label')).includes('1 h 15 sur 5 h, 25 %'), 'anneau : 1 h 15 sur 5 h = 25 %');
ok((await txt('[data-days]')).includes('1 / 7'), 'jours travaillés : 1 / 7');
const subj = await txt('[data-subjects]');
ok(/Français 40 min/.test(subj) && /Mathématiques 35 min/.test(subj), `par matière : français 40 min, maths 35 min (« ${subj} »)`);

console.log('Ce qui a été fait, jour par jour');
const monday = await pa.locator('[data-day]').first();
const mt = (await monday.innerText()).replace(/\s+/g, ' ');
ok(mt.includes('1 h 15'), 'total du lundi : 1 h 15');
ok(await pa.locator('[data-day]').count() === 7, 'les 7 jours sont listés');
ok(/09:00 L .*leçon terminée · 40 min/.test(mt), `leçon de français à 09:00, terminée, 40 min (« ${mt.slice(0, 200)} »)`);
ok(/exercices, pas encore remis · 20 min/.test(mt), 'exercices de maths commencés, non remis : 20 min');
ok(mt.includes(`évaluation rendue en 2 min sur 30 · ${qs.length - 1} sans réponse · 15 min`) && mt.includes('3/20'), 'évaluation : rendue en 2 min sur 30, questions sans réponse, 3/20');
ok(await monday.locator('[data-item="exercises"] >> text=0 juste sur 1').count() === 2, 'les deux séries d’exercices de français : 0 juste sur 1');
await pa.click('[data-type="evaluations"]'); await pa.waitForURL(/type=evaluations/);
ok(await pa.locator('[data-item]').count() === 1 && await pa.locator('[data-item="evaluation"]').count() === 1, 'filtre « Évaluations » : seulement la copie');

console.log('Revoir ensemble : la copie');
await pa.click('[data-item="evaluation"] >> text=Revoir'); await pa.waitForURL(/revoir\/copie\//);
const reviewUrl = pa.url();
ok((await txt('[data-review-score]')).includes('3 /20'), 'note 3/20');
const chips = await txt('[data-review-chips]');
ok(chips.includes('1 fausse') && chips.includes(`${qs.length - 1} sans réponse`) && chips.includes('rendue en 2 min sur 30') && chips.includes('page masquée 2 fois'), `résumé (« ${chips} »)`);
ok(await pa.locator('[data-review-q]').count() === qs.length, 'filtre « À revoir » : toutes les questions non justes');
const first = (await pa.locator('[data-review-q]').first().innerText()).replace(/\s+/g, ' ');
ok(/Réponse de/i.test(first) && /Corrigé/i.test(first) && (q1.type !== 'qcm' || first.includes(q1.options[Number(wrong)].replace(/\*\*|\$/g, '').slice(0, 12))), 'sa réponse à côté du corrigé');
await pa.click('[data-filter="all"]'); await pa.waitForURL(/tout=1/);
ok(await pa.locator('[data-review-q]').count() === qs.length, 'filtre « Toutes »');
await pa.click('[data-edit-grade]'); await pa.waitForURL(/parent\/copies\//);
ok(await pa.isVisible('text=Motif de la modification'), '« Modifier la note » ouvre la correction (avec motif)');
await pa.goBack(); await pa.click('text=‹ La semaine'); await pa.waitForURL(/journal\?/);

console.log('Revoir ensemble : les exercices');
await pa.locator('[data-item="exercises"] >> text=Revoir').first().click(); await pa.waitForURL(/revoir\/exercices\//);
ok((await txt('[data-review-score]')).includes('0/1 justes') && (await txt('[data-review-chips]')).includes('1 fausse'), 'exercices : 0/1 juste, 1 fausse');
ok(!/hausse|baisse|motivation|implication|concentration/i.test(await pa.locator('main').innerText()), 'aucune interprétation');

console.log('Accueil (mêmes chiffres que l’Activité)');
await pa.goto(BASE + '/parent');
const hw = await txt('[data-home-week]');
ok(hw.includes('1 h 15') && hw.includes('1 / 7 jours') && (await pa.locator('[data-home-week] svg').getAttribute('aria-label')).includes('25 %'), `cette semaine : 1 h 15, 1 / 7 jours, 25 % (« ${hw} »)`);
const hn = await txt('[data-home-notes]');
ok(hn.includes('3/20') && await pa.locator('[data-home-notes] a[href^="/parent/revoir/copie/"]').count() === 1, 'dernières notes : 3/20 avec « Revoir »');
ok(await pa.locator('[data-home-acquired] [data-acq]').count() >= 1, 'cours acquis par matière');

console.log('Navigation');
await pa.goto(BASE + '/parent/journal');
await pa.click('a[aria-label="Semaine précédente"]'); await pa.waitForURL(/semaine=/);
ok((await txt('[data-days]')).includes('0 / 7'), 'semaine précédente : 0 / 7');
await pa.click('text=Voir le détail minute par minute'); await pa.waitForURL(/journal\/detail/);
ok(await pa.isVisible('text=Journal intact'), 'le détail minute par minute reste accessible');
const ph = await (await b.newContext({ viewport: { width: 375, height: 667 }, storageState: await pa.context().storageState() })).newPage();
for (const u of ['/parent/journal', reviewUrl]) { await ph.goto(u.startsWith('http') ? u : BASE + u); ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `aucun débordement sur téléphone (${u.replace(BASE, '')})`); }
ok(errs.length === 0, `aucune erreur JS (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nActivité de la semaine : OK');
