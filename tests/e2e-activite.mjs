// « Activité » du parent (maquette validée le 25/11/2026) : la semaine en 3 lignes, temps par jour, calendrier de 4 semaines,
// objectif, répartitions, un cours par ligne, questions ratées (réponse de l'élève et bonne réponse), à venir, à regarder ensemble.
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

const b = await chromium.launch();
const pa = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errs = []; pa.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(BASE + '/parent/journal');
const txt = async sel => (await pa.locator(sel).innerText()).replace(/\s+/g, ' ');

console.log('La semaine en 3 lignes');
const three = await txt('[data-three-lines]');
ok(three.includes('1 jour travaillé') && three.includes('1 h 15') && three.includes('5 h'), `fait : 1 jour travaillé, 1 h 15 sur 5 h (« ${three.slice(0, 120)} »)`);
ok((await txt('[data-point]')).includes(`« ${ma.title} » a été rendue en 2 min sur 30`), 'point précis : la copie incomplète, avec ses chiffres');
ok((await txt('[data-idea]')).includes('question ratée'), 'idée liée au point : regarder la question ratée ensemble');
console.log('Graphiques');
ok((await pa.locator('[data-day-bars]').getAttribute('aria-label')).includes(': 75 min'), 'barre du lundi : 75 min');
ok((await txt('[data-goal]')).includes('25 %'), 'anneau : 75 min sur 300 = 25 %');
ok((await txt('#matieres ~ *, section[aria-labelledby="matieres"]')).includes('Mathématiques 35 min') && (await txt('section[aria-labelledby="matieres"]')).includes('Français 40 min'), 'temps par matière : français 40 min, maths 35 min');
ok((await txt('section[aria-labelledby="activites"]')).includes('Leçons 40 min') && (await txt('section[aria-labelledby="activites"]')).includes('Évaluations 15 min'), 'temps par activité');
ok(await pa.locator('[data-cal-row]').count() === 4 && (await txt('section[aria-labelledby="cal"]')).includes('2 jours travaillés sur 28'), 'calendrier : 4 semaines, 2 jours travaillés sur 28');
console.log('Un cours par ligne');
const rows = await txt('[data-course-rows]');
ok(await pa.locator('[data-course]').count() === 2, 'deux cours, une ligne chacun');
ok((await txt(`[data-course="${ma.id}"]`)).includes('Copie incomplète · 3/20'), 'maths : copie incomplète 3/20');
ok((await txt(`[data-course="${fr.id}"]`)).includes('Terminée cette semaine'), 'français : leçon terminée cette semaine');
console.log('Questions ratées, à venir, à regarder');
const miss = await txt('[data-missed]');
ok(/réponse de/i.test(miss) && /bonne réponse/i.test(miss) && miss.includes('−15') && (q1.type !== 'qcm' || miss.includes(q1.options[Number(wrong)].slice(0, 15))), 'question ratée : réponse de l’élève (texte de l’option) et bonne réponse');
ok((await txt('[data-upcoming]')).includes('Révision en retard') && (await txt('[data-upcoming]')).includes('en retard de 5 jours'), 'révision en retard de 5 jours');
ok((await txt('section[aria-labelledby="regarder"]')).includes('quittée 2 fois'), 'à regarder : 2 sorties de fenêtre');
ok(!/hausse|baisse|motivation|implication|concentration/i.test(await pa.locator('main').innerText()), 'aucune interprétation');
console.log('Navigation');
await pa.click('a[aria-label="Semaine précédente"]');
await pa.waitForURL(/semaine=/);
ok((await txt('[data-three-lines]')).includes('0 jour travaillé'), 'semaine précédente : 0 jour travaillé');
await pa.click('text=Voir le détail minute par minute');
await pa.waitForURL(/journal\/detail/);
ok(await pa.isVisible('text=Journal intact'), 'le détail minute par minute reste accessible');
const ph = await (await b.newContext({ viewport: { width: 375, height: 667 }, storageState: await pa.context().storageState() })).newPage();
await ph.goto(BASE + '/parent/journal');
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'aucun débordement sur téléphone');
ok(errs.length === 0, `aucune erreur JS (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nActivité de la semaine : OK');
