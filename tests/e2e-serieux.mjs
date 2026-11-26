// « Travail et résultats » (Bilan parent) : uniquement des faits, sur 28 jours, avec des valeurs attendues calculées à la main.
// Couvre aussi les erreurs relevées par l'audit de conformité : jours travaillés comptés par jour (et non par séance),
// tiers-temps pris en compte pour décider qu'une copie est complète, copies incomplètes séparées des complètes.
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
const cs = await sql`select c.id, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code in ('TG001', 'TG034') order by c.code`;
const qids = doc => doc.evaluation.variants[0].sections.flatMap(s => s.questions.map(q => q.id));
const session = (daysAgo, hour, min, openMin, courseId = cs[0].id) => sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
  values (${st.id}, ${courseId}, 'lesson', date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' - make_interval(days => ${daysAgo}) + make_interval(hours => ${hour}),
    now(), now(), ${openMin * 60}, ${min * 60})`;
let n = 1;
const copy = (c, { allowed, used, filled, note, daysAgo = 2 }) => {
  const ids = qids(c.doc);
  const answers = Object.fromEntries(ids.slice(0, Math.round(ids.length * filled)).map(id => [id, 'réponse']));
  return sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, status, started_at, deadline_at, submitted_at, answers, final_score, scores)
    values (${st.id}, ${c.id}, ${c.version_id}, ${n++}, 'graded', now() - make_interval(days => ${daysAgo}), now() - make_interval(days => ${daysAgo}) + make_interval(mins => ${allowed}),
      now() - make_interval(days => ${daysAgo}) + make_interval(mins => ${used}), ${sql.json(answers)}, ${note}, '{}'::jsonb)`;
};

// jour 1 : deux séances de 7 min (14 min au total : 1 jour travaillé) ; jour 3 : trois de 5 min (15 min : 1 jour) ;
// jour 5 : une séance de 8 min (pas un jour travaillé) ; une séance d'il y a 40 jours (hors fenêtre)
await session(1, 9, 7, 10); await session(1, 18, 7, 8);
await session(3, 9, 5, 5); await session(3, 12, 5, 6); await session(3, 20, 5, 9);
await session(5, 10, 8, 16);
await session(40, 10, 60, 60);
// copies : une complète avec tiers-temps (40 min accordées, 13 utilisées ≥ 30 %, tout rempli) → 12/20 ;
// une complète (30/30 min) → 16/20 ; une bâclée (2 min, 30 % rempli) → 3/20 ; une hors fenêtre
await copy(cs[0], { allowed: 40, used: 13, filled: 1, note: 12 });
await copy(cs[1], { allowed: 30, used: 30, filled: 1, note: 16 });
await copy(cs[1], { allowed: 30, used: 2, filled: 0.3, note: 3 });
await copy(cs[0], { allowed: 30, used: 30, filled: 1, note: 20, daysAgo: 45 });
// contrôles : 2 parties réussies du premier coup sur 3 (la 3e réussie seulement au 2e essai)
for (const [p, first] of [[0, true], [1, true], [2, false]]) {
  await sql`insert into checkpoint_answers (student_id, course_id, version_id, part_index, variant, choice, correct, answered_at) values (${st.id}, ${cs[0].id}, ${cs[0].version_id}, ${p}, 0, 0, ${first}, now() - interval '3 days')`;
  if (!first) await sql`insert into checkpoint_answers (student_id, course_id, version_id, part_index, variant, choice, correct, answered_at) values (${st.id}, ${cs[0].id}, ${cs[0].version_id}, ${p}, 0, 1, true, now() - interval '3 days' + interval '1 minute')`;
}
// exercices : 3 questions automatiques réussies sur 4, + 1 réponse rédigée jugée réussie par l'élève
await sql`insert into exercise_submissions (student_id, course_id, version_id, answers, auto_results, self_check, submitted_at, checked_at)
  values (${st.id}, ${cs[1].id}, ${cs[1].version_id}, '{}', '{"a":true,"b":true,"c":true,"d":false}', '{"e":true}', now() - interval '2 days', now() - interval '2 days')`;

const b = await chromium.launch();
const pa = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errs = []; pa.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(BASE + '/parent/bilan');
console.log('Matière par matière (valeurs calculées à la main)');
const subj = async name => (await pa.locator(`[data-subject="${name}"]`).innerText()).replace(/\s+/g, ' ');
const math = await subj('Mathématiques');
ok(math.includes('2 copies notées') && math.includes('9,5 /20 de moyenne'), `maths : copies 3 et 16 → moyenne 9,5 (« ${math.slice(0, 120)} »)`);
// la copie de français d'il y a 45 jours compte seulement si elle est dans l'année scolaire (depuis le 1er septembre)
const now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
const inYear = Date.now() - 45 * 864e5 >= new Date(y0, 8, 1).getTime();
const fra = await subj('Français');
ok(inYear ? fra.includes('2 copies notées') && fra.includes('16 /20 de moyenne') : fra.includes('1 copie notée') && fra.includes('12 /20'), `français : ${inYear ? '20 et 12 → 16' : '12 seulement'} (« ${fra.slice(0, 120)} »)`);
ok(math.includes('rien pour l’instant') && fra.includes('rien pour l’instant'), 'à revoir : rien (dernières copies sans question à 0 point ni vide)');
await pa.click('[data-fold="chiffres"] > summary');
const card = pa.locator('[data-facts]');
const val = async k => (await card.locator(`[data-fact="${k}"] strong`).innerText()).trim();
console.log('Faits mesurés (valeurs calculées à la main)');
ok(await val('jours') === '2 sur 28', `jours travaillés comptés par jour, pas par séance : ${await val('jours')} (attendu 2 sur 28)`);
ok(await val('temps') === '37 min', `temps de travail sur 28 jours : ${await val('temps')} (attendu 14 + 15 + 8 = 37 min)`);
ok(await card.locator('[data-fact="actif"]').count() === 0, 'plus de « part du temps de travail » (le temps sans geste est du travail)');
ok(await val('copies') === '2 sur 3', `copies sans question vide : ${await val('copies')}`);
ok(await val('temps-copies') === '45 min sur 100', `temps utilisé pendant les évaluations : ${await val('temps-copies')} (13 + 30 + 2 sur 40 + 30 + 30, tiers-temps compris)`);
ok(await val('moy-completes') === '14/20', `moyenne des copies sans question vide : ${await val('moy-completes')} (12 et 16)`);
ok(await val('moy-incompletes') === '3/20', `copies avec questions vides à part : ${await val('moy-incompletes')}`);
ok(await val('controles') === '2 sur 3', `contrôles du premier coup : ${await val('controles')}`);
ok(await val('exercices') === '3 sur 4', `exercices corrigés par la plateforme : ${await val('exercices')}`);
ok((await card.locator('[data-fact="exercices"]').innerText()).includes('1 sur 1 réponses rédigées'), 'auto-évaluation de l’élève comptée à part');
console.log('Aucune interprétation');
const txt = await card.innerText();
ok(!/ne veut pas|n’arrive pas|capacités|diagnostic|fiable|investissement \d/i.test(txt), 'pas de profil, pas de note composite, pas de verdict');
ok((await card.innerText()).includes('notées ou non') && (await card.innerText()).includes('tiers-temps compris'), 'chaque chiffre porte sa définition');
const ph = await (await b.newContext({ viewport: { width: 375, height: 667 }, storageState: await pa.context().storageState() })).newPage();
await ph.goto(BASE + '/parent/bilan');
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'aucun débordement sur téléphone');
ok(errs.length === 0, `aucune erreur JS (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nTravail et résultats : OK');
