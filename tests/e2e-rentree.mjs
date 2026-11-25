// Arrivée d'un enfant : test de rentrée proposé d'emblée (sans IA), puis questionnaire « Comment je travaille »,
// ressenti vu par le parent (points d'attention, ce qui aide), re-proposition, effort valorisé et « Mes progrès ».
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-rentree.mjs
import fs from 'node:fs';
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

// tous les tests de rentrée existants sont utilisables (format, réponses dans les bornes)
for (const lv of fs.readdirSync('content').filter(d => fs.existsSync(`content/${d}/positionnement.json`))) {
  const t = JSON.parse(fs.readFileSync(`content/${lv}/positionnement.json`, 'utf8'));
  const bad = t.questions.filter(q => !['qcm', 'numeric', 'short'].includes(q.type) || (q.type === 'qcm' && !(Number(q.reponse) >= 0 && Number(q.reponse) < q.options.length)) || (q.type === 'numeric' && !Number.isFinite(Number(q.reponse))));
  ok(t.questions.length >= 20 && bad.length === 0, `test de rentrée ${lv} : ${t.questions.length} questions valides`);
}

console.log('Nouvel enfant : test de rentrée proposé d’emblée');
const pa = await page('parent@test.local', 'parent-test-1234');
await pa.goto(BASE + '/parent/enfants');
const f = pa.locator('[data-add-child]');
await f.locator('input[name=first_name]').fill('Nora');
await f.locator('input[name=gender][value=fille]').check();
await f.locator('select[name=birth_month]').selectOption('05');
const year = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
await f.locator('select[name=birth_year]').selectOption(String(year - 14));
await f.locator('select[name=level]').selectOption('troisieme-generale');
ok(await f.locator('input[name=entry_test]').isChecked(), '« Commencer par le test de rentrée » coché par défaut');
await f.locator('input[name=login]').fill('nora-test'); await f.locator('input[name=password]').fill('nora-test-1234');
await f.locator('button[type=submit]').click();
await pa.waitForSelector('text=/test de rentrée \\(24 questions\\)/');
const [nora] = await sql`select id from students where first_name = 'Nora'`;
const [pt] = await sql`select id, total, questions->>'entree' as entree from placement_tests where student_id = ${nora.id}`;
ok(pt.total === 24 && pt.entree === 'true', 'test de rentrée de 3e créé (24 questions, sans IA)');
ok((await sql`select count(*)::int as n from ai_requests where student_id = ${nora.id}`)[0].n === 0, 'aucune donnée envoyée à une IA');

console.log('L’élève fait le test, puis le questionnaire');
const el = await page('nora-test', 'nora-test-1234', { width: 390, height: 844 });
ok(await el.locator('[data-checkin-due]').count() === 0, 'le questionnaire attend la fin du test (une chose à la fois)');
await el.click('a:has-text("Faire le test")');
await el.click('button:has-text("Commencer le test")');
await el.waitForSelector('[role=timer]');
await el.locator('#q-p1 input').first().check().catch(() => {});
await el.click('button:has-text("Terminer le test")'); await el.click('button:has-text("Oui, terminer")');
await el.waitForSelector('text=/bonnes? réponses? sur 24/');
ok(true, 'test corrigé automatiquement');
await el.goto(BASE + '/eleve');
ok(await el.locator('[data-checkin-due]').count() === 1, 'carte « Comment tu travailles ? » ensuite');
await el.click('[data-checkin-due] a');
const form = el.locator('[data-checkin]');
const pick = { q1: 1, q2: 2, q3: 1, q4: 2, q5: 3, q6: 1, q7: 2, q8: 3, q9: 3, q10: 1, q11: 2, q12: 2, q13: 3, q14: 2 };
await form.locator('button[type=submit]').click();
ok(await el.locator('[data-checkin]').count() === 1 && el.url().includes('/questionnaire'), 'réponses obligatoires : rien n’est envoyé à moitié');
for (const [q, v] of Object.entries(pick)) await form.locator('label', { has: el.locator(`input[name=${q}][value="${v}"]`) }).click();   // comme l'élève : on touche la réponse
await form.locator('textarea[name=bloque]').fill('Mon téléphone et la peur de rater.');
ok(await el.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'questionnaire sans débordement sur téléphone');
await form.locator('button[type=submit]').click();
await el.waitForURL(/questionnaire=merci/);
ok(await el.locator('[data-checkin-due]').count() === 0, 'merci, et plus de carte avant 6 semaines');
const [ck] = await sql`select answers from student_checkins where student_id = ${nora.id}`;
ok(ck.answers.q8 === 3 && ck.answers.q13 === 3, 'réponses exactes enregistrées');
ok(true, 'réponses enregistrées');

console.log('Le parent voit son ressenti');
await pa.goto(`${BASE}/parent/bilan?eleve=${nora.id}`);
const card = pa.locator('[data-checkin-card]');
ok((await card.locator('[data-item="q8"]').innerText()).includes('Tout à fait'), 'le parent lit la réponse exacte (« Les contrôles me stressent beaucoup » : Tout à fait)');
ok(!/\d+ %/.test(await card.innerText()), 'aucun pourcentage tiré du questionnaire');
ok((await card.innerText()).includes('Mon téléphone et la peur de rater'), 'ses propres mots');
ok(/ce qui la bloque/i.test(await card.innerText()), 'accordé au féminin');
await card.locator('button:has-text("reproposer")').click();
await pa.waitForSelector('text=Proposé à Nora');
await el.goto(BASE + '/eleve');
ok(await el.locator('[data-checkin-due]').count() === 1, 'reproposé à la demande du parent');

console.log('Effort valorisé et « Mes progrès »');
await el.goto(BASE + '/eleve/resultats');
ok(await el.locator('[data-my-progress]').count() === 1 && (await el.locator('[data-my-progress]').innerText()).includes('Toi par rapport à toi'), '« Mes progrès » : comparaison avec soi-même uniquement');
await el.goto(BASE + '/eleve');
ok((await el.locator('main').innerText()).includes('Ou choisis toi-même'), 'l’élève peut choisir son prochain cours');

for (const p of [pa, el]) ok(p.errs.length === 0, `aucune erreur JS ni fenêtre native (${p.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nRentrée, questionnaire et progrès : OK');
