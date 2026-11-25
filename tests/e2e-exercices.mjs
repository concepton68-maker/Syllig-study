// Exercices : l'élève n'est jamais bloqué. Des réponses rédigées non comparées au corrigé comptent « Pas encore »,
// mais n'empêchent ni d'enregistrer le résultat ni de passer à l'évaluation.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-exercices.mjs
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
await sql`insert into course_progress (student_id, course_id, lesson_done_at) values (${st.id}, ${c.id}, now())`;
const open = c.doc.exercises.items.filter(q => q.type === 'open');
ok(open.length > 0, `le cours a ${open.length} réponse(s) rédigée(s) à comparer`);

const b = await chromium.launch();
const el = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = []; el.on('pageerror', e => { if (!/#418/.test(e.message)) errs.push(e.message.slice(0, 80)); });
el.on('dialog', d => { errs.push('fenêtre native'); d.dismiss(); });
await el.route('**/api/activity', r => r.fulfill({ status: 200, body: '{"session":"00000000-0000-0000-0000-000000000000"}' }));
await el.goto(BASE + '/connexion'); await el.fill('input[name=login]', 'lea'); await el.fill('input[name=password]', 'lea-test-1234');
await el.click('button[type=submit]'); await el.waitForURL(u => !u.pathname.startsWith('/connexion'));
await el.goto(`${BASE}/eleve/cours/${c.id}/exercices`);
// une seule réponse rédigée, rien d'autre
const tabOf = q => q.stars ?? 0;
await el.locator('[role=tab]').nth([...new Set(c.doc.exercises.items.map(tabOf))].sort().indexOf(tabOf(open[0]))).click();
await el.locator(`[aria-label="Ta réponse à ${open[0].id}"]`).fill('Une réponse rédigée.');
await el.waitForTimeout(900);
await el.click('button:has-text("Valider mes réponses et voir les corrigés")');
await el.click('button:has-text("Oui, voir les corrigés")');
const save = el.locator('button:has-text("Enregistrer mon résultat")');
await save.waitFor();
ok(await save.isEnabled(), 'le bouton « Enregistrer mon résultat » n’est jamais grisé');
ok(await el.locator('button:has-text("Prochaine à comparer")').count() === 1, 'raccourci vers la prochaine réponse à comparer');
await save.click();
ok(await el.locator('[data-confirm-save]').count() === 1 && (await el.locator('[data-confirm-save]').innerText()).includes('compteront « Pas encore »'), 'avertissement clair, sans blocage');
await el.click('button:has-text("Enregistrer quand même")');
await el.waitForSelector('text=/Score : \\d+\\/10/');
const [p] = await sql`select exercises_done_at from course_progress where student_id = ${st.id} and course_id = ${c.id}`;
ok(!!p.exercises_done_at, 'exercices enregistrés comme faits');
await el.goto(`${BASE}/eleve/cours/${c.id}/evaluation`);
ok(await el.locator('button:has-text("Commencer")').count() === 1, 'l’évaluation est accessible');
ok(errs.length === 0, `aucune erreur JS ni fenêtre native (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nExercices jamais bloquants : OK');
