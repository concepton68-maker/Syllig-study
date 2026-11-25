// Évolution sur 12 semaines (Bilan parent) : 8 semaines fabriquées où l'élève travaille de plus en plus et réussit de mieux en mieux.
// Vérifie des valeurs exactes : comparaison 4 semaines / 4 semaines, total des minutes = somme des séances (aucune heure perdue
// aux changements d'heure), résultats par matière, réponses du questionnaire qui ont changé.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-trajectoire.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale' where id = ${st.id}`;
const cs = await sql`select c.id, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code in ('TG001', 'TG034') order by c.code`;
// semaine k (k = 1 il y a 8 semaines … k = 8 la semaine dernière) : k séances de 20 min ; exercices : k réussies sur 10
for (let k = 1; k <= 8; k++) {
  const w = 9 - k;
  for (let d = 0; d < k; d++)
    await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds)
      values (${st.id}, ${cs[1].id}, 'exercises', date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' - make_interval(weeks => ${w}) + make_interval(hours => ${10 + d * 12}),
        now(), now(), 1500, 1200)`;
  for (const c of cs) {
    const auto = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`x${i}`, i < k + 2]));
    await sql`insert into exercise_submissions (student_id, course_id, version_id, answers, auto_results, submitted_at, checked_at)
      values (${st.id}, ${c.id}, ${c.version_id}, '{}', ${sql.json(auto)}, date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' - make_interval(weeks => ${w}) + interval '2 days',
        date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' - make_interval(weeks => ${w}) + interval '2 days')`;
  }
}
await sql`insert into student_checkins (student_id, created_at, answers, scores) values
  (${st.id}, now() - interval '50 days', '{"q6": 1, "q8": 3, "q1": 2}', '{}'), (${st.id}, now() - interval '5 days', '{"q6": 3, "q8": 1, "q1": 2}', '{}')`;
// valeurs attendues, calculées à la main
const minutesBefore = (1 + 2 + 3 + 4) * 20, minutesAfter = (5 + 6 + 7 + 8) * 20;     // 200 → 520
const exBefore = Math.round(((3 + 4 + 5 + 6) * 2) / 80 * 100), exAfter = Math.round(((7 + 8 + 9 + 10) * 2) / 80 * 100);   // 45 % → 85 %
const [tot] = await sql`select (sum(active_seconds) / 60)::int as m from work_sessions where student_id = ${st.id}`;

const b = await chromium.launch();
const pa = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errs = []; pa.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(BASE + '/parent/bilan');
const card = pa.locator('[data-trajectory]');
const row = async label => (await card.locator(`[data-compare-row="${label}"]`).innerText()).replace(/\s+/g, ' ');
ok((await row('Temps de travail effectif')).includes(`${minutesBefore} min → ${minutesAfter} min`), `temps : ${await row('Temps de travail effectif')} (attendu ${minutesBefore} → ${minutesAfter})`);
ok((await row('Exercices réussis (corrigés par la plateforme)')).includes(`${exBefore} % (36 sur 80) → ${exAfter} % (68 sur 80)`), `exercices : ${await row('Exercices réussis (corrigés par la plateforme)')} (attendu ${exBefore} % → ${exAfter} %)`);
ok((await row('Moyenne des copies sans question vide')).includes('— → —'), 'pas de copie : « — », pas de valeur inventée');
await card.locator('details summary').first().click();
const mins = (await card.locator('table tbody tr td:nth-child(2)').allInnerTexts()).map(t => t.trim() === '—' ? 0 : parseInt(t, 10));   // « — » : avant la première activité
ok(mins.length === 12 && mins.reduce((a, x) => a + x, 0) === tot.m, `12 semaines ; total ${mins.reduce((a, x) => a + x, 0)} min = somme des séances ${tot.m} min (aucune heure perdue)`);
ok(await card.locator('[data-bar-week]').count() === 12 && await card.locator('[data-point="ex"]').count() === 8, 'barres et points tracés (8 semaines mesurées)');
ok(await card.locator('[data-subject-trend]').count() === 2, 'résultats par matière');
const mt = (await card.locator('[data-subject-trend="Mathématiques"]').innerText()).replace(/\s+/g, ' ');
ok(mt.includes('Exercices (8)') && mt.includes('3/10') && mt.includes('10/10') && !mt.includes('→'), `maths : chaque série telle quelle, sans moyenne ni comparaison (${mt})`);
ok((await card.locator('[data-feeling="q6"]').innerText()).includes('Plutôt pas → Tout à fait') && await card.locator('[data-feeling="q1"]').count() === 0, 'questionnaire : seulement les réponses qui ont changé, en toutes lettres');
ok(!/hausse|baisse|lassitude|effort paie|découragement/i.test(await card.innerText()), 'aucune tendance extrapolée ni cause supposée');
await card.locator('[data-bar-week]').nth(10).hover();
ok((await card.innerText()).includes('min de travail effectif'), 'bulle au survol');
const ph = await (await b.newContext({ viewport: { width: 375, height: 667 }, storageState: await pa.context().storageState() })).newPage();
await ph.goto(BASE + '/parent/bilan');
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'aucun débordement sur téléphone');
ok(errs.length === 0, `aucune erreur JS (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nÉvolution sur 12 semaines : OK');
