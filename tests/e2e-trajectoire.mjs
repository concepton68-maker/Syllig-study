// Trajectoire (Bilan parent) : 8 semaines fabriquées où l'élève s'investit de plus en plus et comprend de mieux en mieux.
// Le parent doit voir les deux courbes monter, les tendances « en hausse », la progression par matière et le ressenti qui évolue.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-trajectoire.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', created_at = now() - interval '70 days' where id = ${st.id}`;
const cs = await sql`select c.id, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code in ('TG001', 'TG034') order by c.code`;
for (let w = 8; w >= 1; w--) {
  const k = 9 - w;                         // 1 → 8 : de plus en plus investi
  for (let d = 0; d < Math.min(5, Math.ceil(k / 1.6)); d++)
    await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
      values (${st.id}, ${cs[1].id}, 'exercises', now() - make_interval(days => ${w * 7 - d}), now() - make_interval(days => ${w * 7 - d}), now() - make_interval(days => ${w * 7 - d}), ${1800}, ${Math.round(1800 * (0.45 + k * 0.06))})`;
  for (const c of cs) {                     // une série d'exercices par matière et par semaine, de mieux en mieux réussie
    const items = c.doc.exercises.items;
    const good = Math.min(items.length, Math.round(items.length * (0.2 + k * 0.09)));
    const auto = Object.fromEntries(items.map((q, i) => [q.id, i < good]));
    await sql`insert into exercise_submissions (student_id, course_id, version_id, answers, auto_results, self_check, submitted_at, checked_at, created_at)
      values (${st.id}, ${c.id}, ${c.version_id}, '{}'::jsonb, ${sql.json(auto)}, '{}'::jsonb, now() - make_interval(days => ${w * 7 - 2}), now() - make_interval(days => ${w * 7 - 2}), now() - make_interval(days => ${w * 7 - 2}))`;
  }
}
await sql`insert into student_checkins (student_id, created_at, answers, scores) values
  (${st.id}, now() - interval '50 days', '{}', '{"envie": 30, "confiance": 25, "stress": 80, "organisation": 40}'),
  (${st.id}, now() - interval '5 days', '{}', '{"envie": 70, "confiance": 65, "stress": 45, "organisation": 70}')`;

const b = await chromium.launch();
const pa = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errs = []; pa.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(BASE + '/parent/bilan');
const card = pa.locator('[data-trajectory]');
ok(await card.getAttribute('data-trajectory') !== null, 'carte « Où va-t-il ? » dans le Bilan');
ok(await card.locator('[data-trend-serieux="hausse"]').count() === 1, `investissement en hausse (${await card.locator('[data-trend-serieux]').innerText()})`);
ok(await card.locator('[data-trend-comprehension="hausse"]').count() === 1, `compréhension en hausse (${await card.locator('[data-trend-comprehension]').innerText()})`);
ok((await card.locator('[data-reading]').innerText()).includes('l’effort paie'), 'lecture en clair pour le parent');
ok(await card.locator('[data-week]').count() === 12 && await card.locator('[data-point="comprehension"]').count() >= 6, '12 semaines, courbes tracées');
ok(await card.locator('[data-subject-trend]').count() === 2, 'progression par matière (2 matières)');
ok((await card.locator('[data-subject-trend="Mathématiques"]').innerText()).includes('hausse'), 'mathématiques en hausse');
ok((await card.locator('[data-feeling="confiance"]').innerText()).includes('25 % → 65 %'), 'ressenti : confiance 25 % → 65 %');
await card.locator('[data-week]').nth(10).hover();
ok((await card.innerText()).includes('Semaine du'), 'bulle au survol d’une semaine');
await card.locator('details summary').first().click();
ok(await card.locator('table tbody tr').count() === 12, 'tableau des chiffres');
const ph = await (await b.newContext({ viewport: { width: 375, height: 667 }, storageState: await pa.context().storageState() })).newPage();
await ph.goto(BASE + '/parent/bilan');
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'aucun débordement sur téléphone');
ok(errs.length === 0, `aucune erreur JS (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nTrajectoire : OK');
