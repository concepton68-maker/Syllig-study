// Ajout d'un enfant par le parent : mois et année de naissance → classe proposée selon l'âge (modifiable),
// fille / garçon (thème par défaut), tiers-temps aux évaluations (durée majorée d'un tiers), modification dans la fiche.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-enfants.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const b = await chromium.launch();
const page = async (l, pw, vp = { width: 1366, height: 900 }) => { const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = []; p.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(`${p.url()} : ${e.message.slice(0, 80)}`); }); p.errs = errs;
  p.on('dialog', d => { errs.push('fenêtre native : ' + d.message()); d.dismiss(); });
  await p.route('**/api/activity', r => r.fulfill({ status: 200, body: '{}' }));
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };
const pa = await page('parent@test.local', 'parent-test-1234');
const year = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const has4e = (await sql`select 1 from levels where code = 'quatrieme'`).length > 0;

console.log('Ajouter une fille née en juillet, 13 ans');
await pa.goto(BASE + '/parent/enfants');
const f = pa.locator('[data-add-child]');
await f.locator('input[name=first_name]').fill('Hajar');
await f.locator('input[name=gender][value=fille]').check();
await f.locator('select[name=birth_month]').selectOption('07');
await f.locator('select[name=birth_year]').selectOption(String(year - 13));
const hint = await f.locator('[data-class-hint]').innerText();
ok(hint.includes('4e'), `classe proposée selon l’âge : 4e (« ${hint.split('\n')[0]} »)`);
if (has4e) ok(await f.locator('select[name=level]').inputValue() === 'quatrieme', 'la 4e est présélectionnée');
else await f.locator('select[name=level]').selectOption('troisieme-generale');
await f.locator('input[name=login]').fill('hajar-test');
await f.locator('input[name=password]').fill('hajar-test-1234');
await f.locator('button[type=submit]').click();
await pa.waitForSelector('text=Compte de Hajar créé');
const [h] = await sql`select s.level_code, s.settings from students s where first_name = 'Hajar'`;
ok(h.settings.birth === `${year - 13}-07` && h.settings.gender === 'fille', 'naissance et fille enregistrées');
ok(h.settings.theme === 'glacier', 'thème par défaut pour une fille : Girly ✦ Ice blue');
const [y] = await sql`select level_code from student_years where student_id = (select id from students where first_name = 'Hajar') and status = 'en_cours'`;
ok(y.level_code === h.level_code, 'année scolaire ouverte dans le dossier');

console.log('Redoublement : classe différente de l’âge');
await pa.goto(BASE + '/parent/enfants');
await f.locator('input[name=first_name]').fill('Haroun');
await f.locator('input[name=gender][value=garcon]').check();
await f.locator('select[name=birth_month]').selectOption('02');
await f.locator('select[name=birth_year]').selectOption(String(year - 14));     // né pour être en 3e
await f.locator('select[name=level]').selectOption(has4e ? 'quatrieme' : 'troisieme-generale');
if (has4e) ok((await f.locator('[data-class-hint]').innerText()).includes('redoublement'), 'écart signalé : redoublement possible');
await f.locator('input[name=extra_time]').check();
await f.locator('input[name=login]').fill('haroun-test');
await f.locator('input[name=password]').fill('haroun-test-1234');
await f.locator('button[type=submit]').click();
await pa.waitForSelector('text=Compte de Haroun créé');
const [g] = await sql`select settings from students where first_name = 'Haroun'`;
ok(g.settings.extra_time === true && g.settings.theme === 'graphite', 'tiers-temps enregistré, thème garçon par défaut');
await pa.reload();
ok((await pa.locator('section:has-text("Haroun")').first().innerText()).includes('tiers-temps'), 'liste des enfants : âge et tiers-temps visibles');

console.log('Fiche : profil modifiable');
const [lea] = await sql`select id from students where first_name <> 'Hajar' and first_name <> 'Haroun' limit 1`;
await sql`update students set level_code = 'troisieme-generale' where id = ${lea.id}`;
await pa.goto(`${BASE}/parent/enfants/${lea.id}?onglet=regles`);
const pf = pa.locator('[data-profile]');
await pf.locator('select[name=birth_month]').selectOption('03');
await pf.locator('select[name=birth_year]').selectOption(String(year - 14));
await pf.locator('input[name=extra_time]').check();
await pa.locator('form:has([data-profile]) button[type=submit]').click();
await pa.waitForSelector('text=Règles enregistrées');
const [l2] = await sql`select settings from students where id = ${lea.id}`;
ok(l2.settings.birth === `${year - 14}-03` && l2.settings.extra_time === true, 'profil enregistré depuis la fiche');

console.log('Tiers-temps pendant l’évaluation');
const [c] = await sql`select c.id, v.document->'evaluation'->>'duration_min' as d from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = 'TG034'`;
await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, exercises_score) values (${lea.id}, ${c.id}, now(), now(), 8)
  on conflict (student_id, course_id) do update set lesson_done_at = now(), exercises_done_at = now()`;
await sql`update students set settings = settings || '{"eval_requires_approval": false}'::jsonb where id = ${lea.id}`;
const el = await page('lea', 'lea-test-1234');
await el.goto(`${BASE}/eleve/cours/${c.id}/evaluation`);
const expect = Math.ceil(Number(c.d) * 4 / 3);
ok((await el.locator('body').innerText()).includes(`Commencer · ${expect} min (tiers-temps)`), `bouton : ${expect} min au lieu de ${c.d}`);
await el.click('button:has-text("Commencer")');
await el.waitForSelector('text=Temps restant');
const [att] = await sql`select extract(epoch from deadline_at - started_at)::int as s from eval_attempts where student_id = ${lea.id} and course_id = ${c.id} and status = 'in_progress'`;
ok(Math.abs(att.s - expect * 60) < 5, `durée accordée par le serveur : ${Math.round(att.s / 60)} min`);

console.log('Téléphone');
const ph = await page('parent@test.local', 'parent-test-1234', { width: 375, height: 667 });
await ph.goto(BASE + '/parent/enfants');
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'formulaire sans débordement sur téléphone');

for (const p of [pa, el, ph]) ok(p.errs.length === 0, `aucune erreur JS ni fenêtre native (${p.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nAjout d’enfants : OK');
