// « Ne veut pas » ou « n'arrive pas » : deux profils d'élèves fabriqués en base, le parent voit la bonne lecture
// (carte investissement × compréhension, détail des mesures, évaluation bâclée écartée de la compréhension).
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-serieux.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"weekly_goal_minutes": 300}'::jsonb where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const cs = await sql`select c.id, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published'
  where c.code in ('TG001', 'TG034') order by c.code`;
const qids = (doc, variant = 0) => { const v = doc.evaluation.variants[variant % doc.evaluation.variants.length]; return v.sections.flatMap(s => s.questions.map(q => q.id)); };

async function wipe() {
  for (const t of ['activity_beats', 'work_sessions', 'checkpoint_answers', 'exercise_submissions', 'eval_attempts', 'course_progress', 'placement_tests'])
    await sql`delete from ${sql(t)} where student_id = ${st.id}`;
}
// séances : n séances réparties sur des jours différents, ratio actif/ouvert
async function sessions(n, activeMin, ratio, kind = 'lesson') {
  for (let i = 0; i < n; i++) await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
    values (${st.id}, ${cs[0].id}, ${kind}, now() - make_interval(days => ${i * 2 + 1}), now() - make_interval(days => ${i * 2 + 1}), now() - make_interval(days => ${i * 2 + 1}),
      ${Math.round(activeMin * 60 / ratio)}, ${activeMin * 60})`;
}
async function course(c, { lessonMin, cpOk, cpTotal, exo, evals }) {
  const expected = c.doc.lesson.duration_min;
  await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
    values (${st.id}, ${c.id}, 'lesson', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days', ${Math.round(lessonMin * 60 * 1.1)}, ${Math.round(lessonMin * 60)})`;
  await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, exercises_score) values (${st.id}, ${c.id}, now(), now(), ${exo})`;
  for (let p = 0; p < cpTotal; p++) await sql`insert into checkpoint_answers (student_id, course_id, version_id, part_index, variant, choice, correct)
    values (${st.id}, ${c.id}, ${c.version_id}, ${p}, 0, 0, ${p < cpOk})`;
  let n = 1;
  for (const e of evals) {
    const ids = qids(c.doc);
    const answers = Object.fromEntries(ids.slice(0, Math.round(ids.length * e.filled)).map(id => [id, 'réponse']));
    await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, status, started_at, submitted_at, deadline_at, answers, final_score, scores)
      values (${st.id}, ${c.id}, ${c.version_id}, ${n++}, 'graded', now() - interval '2 days', now() - interval '2 days' + make_interval(mins => ${e.min}),
        now() - interval '2 days' + make_interval(mins => ${c.doc.evaluation.duration_min}), ${sql.json(answers)}, ${e.score}, '{}'::jsonb)`;
  }
  return expected;
}

const b = await chromium.launch();
const pa = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errs = []; pa.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
const look = async () => { await pa.goto(BASE + '/parent/bilan'); return pa.locator('[data-engagement]'); };

console.log('Pas assez de données');
await wipe();
await sessions(2, 20, 0.9);
let card = await look();
ok(await card.getAttribute('data-engagement') === 'aucun', 'pas de profil tant qu’il y a trop peu de travail');
ok((await card.innerText()).includes('Pas encore de profil'), 'le parent sait pourquoi');

console.log('Élève qui n’arrive pas');
await wipe();
await sessions(10, 35, 0.9);
for (const c of cs) { const exp = c.doc.lesson.duration_min; await course(c, { lessonMin: exp, cpOk: 1, cpTotal: 5, exo: 3, evals: [{ min: c.doc.evaluation.duration_min - 2, filled: 1, score: 6 }] }); }
card = await look();
ok(await card.getAttribute('data-engagement') === 'difficulte', `profil « il travaille mais bloque » (${await card.getAttribute('data-engagement')})`);
const s1 = Number((await card.locator('[data-axis="serieux"] [data-axis-score]').innerText()).replace(/\D/g, ''));
const c1 = Number((await card.locator('[data-axis="comprehension"] [data-axis-score]').innerText()).replace(/\D/g, ''));
ok(s1 >= 60 && c1 < 60, `investissement ${s1} %, compréhension ${c1} %`);
ok(await card.locator('[data-overall]').count() === 1 && await card.locator('[data-subject]').count() >= 1, 'carte : point de l’élève et points par matière');
ok((await card.innerText()).includes('test de positionnement'), 'conseil adapté : chercher les bases qui manquent');

console.log('Élève qui ne veut pas');
await wipe();
await sessions(5, 12, 0.45);
for (const c of cs) { const exp = c.doc.lesson.duration_min; await course(c, { lessonMin: Math.round(exp * 0.5), cpOk: 4, cpTotal: 5, exo: 9,
  evals: [{ min: 2, filled: 0.3, score: 3 }, { min: c.doc.evaluation.duration_min - 5, filled: 1, score: 16 }] }); }
card = await look();
ok(await card.getAttribute('data-engagement') === 'investissement', `profil « comprend mais s’investit peu » (${await card.getAttribute('data-engagement')})`);
ok((await card.innerText()).includes('2 évaluations rendues trop vite'), 'les copies bâclées sont écartées de la compréhension, et c’est dit');
ok((await card.innerText()).includes('créneau fixe'), 'conseil adapté : cadre et régularité');

console.log('Écran En direct');
await pa.goto(BASE + '/parent/suivi');
ok((await pa.locator('[data-suivi-engagement]').innerText()).includes('Compréhension'), 'résumé investissement / compréhension, lien vers le bilan');

console.log('Téléphone');
const ph = await (await b.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, storageState: await pa.context().storageState() })).newPage();
await ph.goto(BASE + '/parent/bilan');
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'aucun débordement horizontal sur téléphone');

ok(errs.length === 0, `aucune erreur JS (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nSérieux / compréhension : OK');
