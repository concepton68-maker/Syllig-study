// Dossier scolaire : correction du niveau, matières suivies, passage dans une nouvelle année.
// Prérequis : base de test (tests/reset-db.sh), Léa en Seconde générale.
// Usage : BASE=http://127.0.0.1:3100 DATABASE_URL=… node tests/e2e-dossier.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const b = await chromium.launch();
const login = async (l, pw) => { const p = await (await b.newContext()).newPage(); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };
const [st] = await sql`select id from students limit 1`;
const fiche = `${BASE}/parent/enfants/${st.id}?onglet=dossier`;

console.log('Parent · dossier scolaire');
const pa = await login('parent@test.local', 'parent-test-1234');
await pa.goto(fiche);
ok(await pa.getByRole('heading', { name: 'Seconde générale' }).isVisible(), 'année en cours affichée : Seconde générale');

console.log('Correction du niveau → 3e générale');
await pa.getByText('Changer de niveau ou passer dans l’année suivante').click();
await pa.getByText('Corriger le niveau de cette année').click();
await pa.locator('select[name=level]').selectOption('troisieme-generale');
await pa.getByRole('button', { name: 'Corriger le niveau' }).click();
await pa.waitForURL(/niveau=correction/);
await pa.getByRole('status').filter({ hasText: 'Niveau corrigé.' }).waitFor({ timeout: 10000 }); ok(true, 'message « Niveau corrigé »');
const [y1] = await sql`select level_code, status from student_years where student_id = ${st.id} and status = 'en_cours'`;
ok(y1.level_code === 'troisieme-generale', 'année en cours passée en 3e générale, sans clôture');
const [{ n: years1 }] = await sql`select count(*)::int as n from student_years where student_id = ${st.id}`;
ok(years1 === 1, 'toujours une seule année dans le dossier');

console.log('Matières suivies : sans Allemand');
await pa.locator('details', { hasText: 'Matières suivies cette année' }).evaluate(d => { d.open = true; });
await pa.getByLabel('Allemand (LV2)').uncheck();
await pa.getByRole('button', { name: 'Enregistrer les matières' }).click();
await pa.getByText('Matières enregistrées').waitFor();
const [{ ex }] = await sql`select settings->'excluded_subjects' as ex from students where id = ${st.id}`;
ok(Array.isArray(ex) && ex.length === 1, 'une matière exclue');

console.log('Élève · son parcours suit la 3e, sans Allemand');
const el = await login('lea', 'lea-test-1234');
await el.goto(BASE + '/eleve/parcours');
const body = await el.textContent('main');
ok(body.includes('3e générale'), 'Mes cours affiche « 3e générale »');
ok(!body.includes('Allemand'), 'aucun cours d’allemand dans le parcours');
await el.goto(BASE + '/eleve/dossier');
await el.getByRole('heading', { name: '3e générale' }).waitFor({ timeout: 10000 }); ok(true, 'Mon dossier scolaire : 3e générale');

console.log('Passage dans une nouvelle année → Seconde générale');
await pa.goto(fiche);
await pa.getByText('Changer de niveau ou passer dans l’année suivante').click();
await pa.locator('select[name=level]').selectOption('seconde-generale');
await pa.fill('input[name=note]', 'Passage en Seconde');
await pa.getByRole('button', { name: 'Commencer la nouvelle année' }).click();
await pa.waitForURL(/niveau=annee/);
const ys = await sql`select level_code, status, school_year, summary is not null as has_summary from student_years where student_id = ${st.id} order by started_at`;
ok(ys.length === 2, 'deux années dans le dossier');
ok(ys[0].status === 'terminee' && ys[0].has_summary && ys[0].level_code === 'troisieme-generale', 'la 3e est clôturée avec son bilan');
ok(ys[1].status === 'en_cours' && ys[1].level_code === 'seconde-generale', 'la Seconde est l’année en cours');
await pa.getByText('Années précédentes').waitFor({ timeout: 10000 }); ok(true, 'les années précédentes sont listées');
const [{ ex2 }] = await sql`select settings->'excluded_subjects' as ex2 from students where id = ${st.id}`;
ok(ex2 === null, 'les matières exclues repartent de zéro avec le nouveau niveau');

await b.close(); await sql.end();
console.log('Dossier scolaire : OK');
