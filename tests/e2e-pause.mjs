// Temps de travail (décision du propriétaire, 26/11/2026) : brouillon et réflexion comptent. Le temps compte tant que la page
// est au premier plan ; il s'arrête après 10 min sans rien toucher (réglable : 5, 10 ou 15 min).
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-pause.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id, settings from students limit 1`;
const [c] = await sql`select c.id from courses c join course_versions v on v.course_id = c.id and v.status = 'published' join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join students t on t.level_code = s.level_code and t.id = ${st.id} limit 1`;

const b = await chromium.launch();
const el = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const beats = [];
await el.route('**/api/activity', async r => {
  const body = JSON.parse(r.request().postData() || '{}');
  if (body.action === 'beat') beats.push(body.active);
  await r.fulfill({ status: 200, contentType: 'application/json', body: '{"session":"00000000-0000-0000-0000-000000000000"}' });
});
await el.goto(BASE + '/connexion'); await el.fill('input[name=login]', 'lea'); await el.fill('input[name=password]', 'lea-test-1234');
await el.click('button[type=submit]'); await el.waitForURL(u => !u.pathname.startsWith('/connexion'));
await el.clock.install();
await el.goto(`${BASE}/eleve/cours/${c.id}/lecon`);
await el.mouse.move(200, 200);
ok(await el.locator('text=Temps de travail compté').count() === 1, `leçon ouverte, temps compté (${el.url().replace(BASE, '')})`);
await el.clock.runFor(1000);   // réponse de « start » reçue : la séance est ouverte

console.log('Brouillon : aucun geste pendant 5 min, page au premier plan');
await el.clock.runFor(5 * 60_000);
ok(beats.length >= 15 && beats.every(x => x === true), `les 5 minutes sont comptées (${beats.filter(Boolean).length} signaux « actif » sur ${beats.length})`);
ok(await el.locator('text=Temps de travail compté').count() === 1 && await el.locator('#away-title').count() === 0, 'aucune interruption de l’élève');

console.log('Rien touché pendant plus de 10 min');
beats.length = 0;
await el.clock.runFor(6 * 60_000);
ok(beats.at(-1) === false, 'au-delà de 10 min sans geste : le temps n’est plus compté');
ok(await el.locator('text=Temps de travail en pause').count() === 1 && await el.locator('#away-title').isVisible(), '« Tu es là ? » seulement à ce moment-là');
await el.keyboard.press('Enter');   // tout geste reprend (le bouton « Je reprends » a le focus)
ok(await el.locator('text=Temps de travail compté').count() === 1 && await el.locator('#away-title').count() === 0, 'reprise au premier geste');

console.log('Réglage du parent');
const pa = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(`${BASE}/parent/enfants/${st.id}?onglet=regles`);
const opts = await pa.locator('select[name=idle] option').allInnerTexts();
ok(opts.join('|') === '5 min sans rien toucher|10 min sans rien toucher|15 min sans rien toucher' && await pa.locator('select[name=idle]').inputValue() === '600', `choix 5, 10 ou 15 min, 10 min sélectionné (${opts.join(', ')})`);
await b.close(); await sql.end();
console.log('\nTemps de travail, brouillon compris : OK');
