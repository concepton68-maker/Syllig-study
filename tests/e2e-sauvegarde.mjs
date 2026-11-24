// Aucune réponse perdue : rechargement, départ immédiat, « Refaire les exercices » (régressions de la recette QA).
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`.
// Usage : BASE=… DATABASE_URL=… node tests/e2e-sauvegarde.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"eval_requires_approval": false}'::jsonb where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const [c] = await sql`select c.id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = 'TG001'`;
await sql`insert into course_progress (student_id, course_id, lesson_done_at) values (${st.id}, ${c.id}, now()) on conflict (student_id, course_id) do update set lesson_done_at = now()`;
const items = c.doc.exercises.items;
const typed = q => q.type === 'qcm' ? null : `réponse ${q.id}`;

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })).newPage();
p.on('dialog', d => d.accept());
await p.route('**/api/activity', r => r.fulfill({ status: 200, body: '{}' }));
await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', 'lea'); await p.fill('input[name=password]', 'lea-test-1234');
await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
const exUrl = `${BASE}/eleve/cours/${c.id}/exercices`;
const fill = async q => { if (q.type === 'qcm') await p.locator(`input[name="${q.id}"][value="0"]`).check(); else await p.locator(`[aria-label="Ta réponse à ${q.id}"]`).fill(typed(q)); };
const visibleItems = async () => { const out = []; for (const q of items) if (await p.locator(`[aria-label="Ta réponse à ${q.id}"], input[name="${q.id}"]`).first().isVisible().catch(() => false)) out.push(q); return out; };
const dbEx = async () => (await sql`select answers from exercise_submissions where student_id = ${st.id} and course_id = ${c.id} order by created_at desc limit 1`)[0]?.answers ?? {};

console.log('Exercices');
await p.goto(exUrl);
let vis = await visibleItems();
const txt = vis.find(q => q.type !== 'qcm');
await p.locator(`[aria-label="Ta réponse à ${txt.id}"]`).fill(typed(txt));
await p.click('a:has-text("Quitter")');                       // départ immédiat (avant la fin de l'attente de frappe)
await p.waitForURL(/\/eleve\/cours\/\d+$/);
await p.waitForTimeout(800);
ok((await dbEx())[txt.id] === typed(txt), 'réponse tapée puis « Quitter » aussitôt : enregistrée');
await p.goto(exUrl);
ok(await p.locator(`[aria-label="Ta réponse à ${txt.id}"]`).inputValue() === typed(txt), 'au retour, la réponse est affichée');

for (const tab of await p.locator('[role=tab]').all()) { await tab.click(); for (const q of await visibleItems()) await fill(q); }
await p.reload();                                             // rechargement juste après la saisie rapide de tout
await p.waitForTimeout(1500);
const db = await dbEx();
ok(items.every(q => (db[q.id] ?? '') !== ''), `saisie rapide puis rechargement : ${items.filter(q => db[q.id]).length}/${items.length} réponses enregistrées`);
await p.waitForSelector('text=10 / 10', { state: 'attached' });
ok(true, 'après rechargement, la page affiche 10 / 10');

console.log('Refaire les exercices');
await p.click('text=Valider mes réponses et voir les corrigés');
await p.waitForSelector('text=/Compare|Score :/', { state: 'attached' });
for (const tab of await p.locator('[role=tab]').all()) { await tab.click(); const r = p.locator('button:text-is("Réussi"):not([disabled])'); for (let k = 0; k < await r.count(); k++) await r.nth(k).click(); }
if (await p.locator('text=Enregistrer mon résultat').isVisible()) await p.click('text=Enregistrer mon résultat');
await p.waitForSelector('text=Refaire les exercices', { state: 'attached' });
await p.click('text=Refaire les exercices'); await p.click('button:has-text("Oui, confirmer")');
await p.waitForSelector('text=0 / 10', { state: 'attached' });
ok(true, '« Refaire les exercices » : questionnaire vide (0 / 10), plus d’anciennes réponses affichées');

console.log('Évaluation');
await sql`update course_progress set exercises_done_at = now(), exercises_score = 9 where student_id = ${st.id} and course_id = ${c.id}`;
await p.goto(`${BASE}/eleve/cours/${c.id}/evaluation`);
await p.click('button:has-text("Commencer")');
await p.waitForSelector('[role=timer]');
const [att] = await sql`select id, variant from eval_attempts where student_id = ${st.id} and course_id = ${c.id} order by attempt_no desc limit 1`;
const secs = c.doc.evaluation.variants[att.variant].sections;
const fillE = async q => { if (q.type === 'qcm') await p.locator(`input[name="${q.id}"][value="0"]`).check(); else await p.locator(`[aria-label="Ta réponse à ${q.id}"]`).fill(typed(q)); };
for (const q of secs[0].questions) await fillE(q);
await p.reload();                                             // rechargement aussitôt après la saisie
await p.waitForSelector('[role=timer]'); await p.waitForTimeout(1500);
const shownA = await Promise.all(secs[0].questions.filter(q => q.type !== 'qcm').map(async q => (await p.locator(`[aria-label="Ta réponse à ${q.id}"]`).inputValue()) === typed(q)));
ok(shownA.every(Boolean), 'rechargement aussitôt après la saisie : les réponses de la section A sont réaffichées');
await p.click(`[role=tab]:has-text("${secs[1].label.split(' (')[0].slice(0, 30)}")`);
await fillE(secs[1].questions[0]);
await p.goto(`${BASE}/eleve`);                                // départ de la page
await p.waitForTimeout(1000);
const [a] = await sql`select answers from eval_attempts where id = ${att.id}`;
const expected = [...secs[0].questions, secs[1].questions[0]];
ok(expected.every(q => (a.answers[q.id] ?? '') !== ''), `rien n’est écrasé : ${expected.filter(q => a.answers[q.id]).length}/${expected.length} réponses en base`);

await b.close(); await sql.end();
console.log('Sauvegarde des réponses : OK');
