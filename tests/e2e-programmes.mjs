// Niveaux, matières, chapitres et cours gérés par l'administrateur (maquette validée le 28/11/2026) : ajouter, renommer,
// désactiver (invisible pour les élèves), supprimer (ce qui a servi est seulement désactivé), importer un programme ;
// rien ne revient au rechargement des programmes (scripts/seed.mjs). Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };
const seed = () => execFileSync('node', ['scripts/seed.mjs'], { env: { ...process.env, SEED_SANS_BIBLIOTHEQUE: '1' }, stdio: 'ignore' });

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale' where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const [tg1] = await sql`select c.id, c.title from courses c where c.code = 'TG001'`;

const b = await chromium.launch();
const login = async (user, pass) => {
  const p = await (await b.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
  p.errs = []; p.on('pageerror', e => { if (!/#418/.test(e.message)) p.errs.push(e.message.slice(0, 80)); }); p.on('dialog', d => { p.errs.push('fenêtre native'); d.dismiss(); });
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', user); await p.fill('input[name=password]', pass);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
  return p;
};
const ad = await login('admin@test.local', 'admin-test-1234');
const el = await login('lea', 'lea-test-1234');
const P = BASE + '/contenu/programmes?niveau=troisieme-generale';
const done = async () => (await ad.locator('[data-done]').innerText()).replace(/\s+/g, ' ');
// attend le message de l'action qui vient d'être lancée (pas celui de la précédente)
const prevDone = async () => (await ad.locator('[data-done]').count()) ? await ad.locator('[data-done]').innerText() : null;
const waitDone = async prev => ad.waitForFunction(p => { const e = document.querySelector('[data-done]'); return e && e.textContent !== p && !location.search.includes('__'); }, prev);
const bulk = async (formId, values, label) => {
  const prev = await prevDone();
  await ad.goto(ad.url().replace(/[?&](fait|erreur)=[^&]*/g, ''));
  for (const v of values) await ad.check(`input[data-bulk="${formId}"][value="${v}"]`);
  await ad.click(`form#${formId} button:has-text("${label}")`);
  await ad.waitForTimeout(200);
  if (await ad.locator('[data-dialog-ok]').count()) await ad.click('[data-dialog-ok]');
  await ad.waitForSelector('[data-done]');
};

console.log('1. Ajouter une matière, un chapitre, un cours');
await ad.goto(P);
ok(await ad.locator('[data-level]').count() >= 3, 'les niveaux sont listés');
const subjOpts = await ad.locator('select[aria-label="Matière à ajouter"] option').allInnerTexts();
ok(subjOpts.includes('Latin') && !subjOpts.includes('Français'), 'liste des matières du niveau, sans celles déjà présentes');
await ad.selectOption('select[aria-label="Matière à ajouter"]', 'Latin'); await ad.click('[data-add-subject] button');
await ad.waitForSelector('[data-done]');
const [latin] = await sql`select id from subjects where level_code = 'troisieme-generale' and name = 'Latin'`;
ok(!!latin && await ad.locator('[data-subject="Latin"]').count() === 1, 'matière « Latin » ajoutée');
await ad.locator('[data-subject="Latin"] [data-subject-details] > summary').click();
await ad.fill(`input[aria-label="Nouveau chapitre en Latin"]`, 'Déclinaisons'); await ad.locator(`input[aria-label="Nouveau chapitre en Latin"] + button`).click();
await ad.waitForSelector('[data-chapter="Déclinaisons"]', { state: 'attached' });
await ad.locator('[data-subject="Latin"] [data-subject-details] > summary').click();
await ad.fill(`input[aria-label="Nouveau cours dans Déclinaisons"]`, 'La première déclinaison'); await ad.locator(`input[aria-label="Nouveau cours dans Déclinaisons"] + button`).click();
await ad.waitForSelector('[data-done]:has-text("La première déclinaison")');
ok((await sql`select 1 from courses where title = 'La première déclinaison'`).length === 1, 'chapitre et cours ajoutés');
await ad.goto(BASE + '/contenu'); await ad.fill('input[type=search]', 'première déclinaison');
ok(await ad.locator('[data-cat-row][data-title="La première déclinaison"]').count() === 1, 'le nouveau cours apparaît dans le catalogue, à rédiger');

console.log('2. Renommer : rien ne revient au rechargement des programmes');
const [hg] = await sql`select id, name from subjects where level_code = 'troisieme-generale' and name like 'Histoire%' limit 1`;
await ad.goto(P);
const row = ad.locator(`[data-subject="${hg.name}"] > div`).first();
await row.locator('summary:text-is("Renommer")').click();
await row.locator('select[aria-label="Nouveau nom"]').selectOption('Grec');
await row.locator('form button:has-text("OK")').click();
await ad.waitForSelector('[data-subject="Grec"]');
seed();
const hs = await sql`select name from subjects where level_code = 'troisieme-generale' and removed_at is null and (name = 'Grec' or name = ${hg.name})`;
ok(hs.length === 1 && hs[0].name === 'Grec', `matière du programme renommée « Grec » (choisie dans la liste) : gardée après rechargement, pas de doublon « ${hg.name} »`);

console.log('3. Désactiver le français : invisible pour l’élève, rien d’effacé');
const [fr] = await sql`select id from subjects where level_code = 'troisieme-generale' and name = 'Français'`;
await el.goto(BASE + '/eleve/parcours?onglet=tous'); const before = await el.locator('main').innerText();
await ad.goto(P);
await bulk('bulk-subjects', [fr.id], 'Désactiver');
ok((await done()).includes('1 matière désactivée'), `message : « ${await done()} »`);
await el.goto(BASE + '/eleve/parcours?onglet=tous');
ok(before.includes(tg1.title) && !(await el.locator('main').innerText()).includes(tg1.title), 'l’élève ne voit plus les cours de français');
const r = await el.goto(`${BASE}/eleve/cours/${tg1.id}`);
ok(r.status() === 404, 'adresse directe d’un cours désactivé : introuvable pour l’élève');
await ad.goto(BASE + '/contenu'); await ad.fill('input[type=search]', 'TG001');
ok((await ad.locator('[data-cat-row]').first().innerText()).includes('Désactivé'), 'catalogue : le cours reste visible pour l’administrateur, marqué « Désactivé »');
seed();
ok((await sql`select active from subjects where id = ${fr.id}`)[0].active === false, 'toujours désactivée après rechargement des programmes');
await ad.goto(P);
await bulk('bulk-subjects', [fr.id], 'Activer');
await el.goto(BASE + '/eleve/parcours?onglet=tous');
ok((await el.locator('main').innerText()).includes(tg1.title), 'réactivée : l’élève revoit ses cours');

console.log('4. Supprimer : ce qui n’a jamais servi disparaît, le reste est seulement désactivé');
const [ma] = await sql`select id from subjects where level_code = 'troisieme-generale' and name = 'Mathématiques'`;
await ad.goto(P);
await bulk('bulk-subjects', [latin.id, ma.id], 'Supprimer');
const msg = await done();
ok(msg.includes('Latin : supprimée') && msg.includes('Mathématiques : désactivée'), `message ligne par ligne : « ${msg} »`);
ok(await ad.locator('[data-subject="Latin"]').count() === 0 && await ad.locator('[data-subject="Mathématiques"]').count() === 1, 'Latin disparaît de la liste ; Mathématiques reste, désactivée');
seed();
ok((await sql`select count(*)::int as n from subjects where level_code = 'troisieme-generale' and name = 'Mathématiques' and active`)[0].n === 0, 'Mathématiques ne revient pas active au rechargement');
await bulk('bulk-subjects', [ma.id], 'Activer');

console.log('5. Niveaux : ajouter, désactiver, supprimer');
await ad.locator('[data-levels] summary:has-text("+ Ajouter")').click();
const opts = await ad.locator('select[aria-label="Niveau à ajouter"] option').allInnerTexts();
ok(opts.includes('Première générale') && opts.includes('CM2') && !opts.includes('3e générale'), 'liste des niveaux scolaires, sans ceux déjà présents');
await ad.selectOption('select[aria-label="Niveau à ajouter"]', 'premiere-generale'); await ad.click('button:has-text("Ajouter le niveau")');
await ad.waitForSelector('[data-level="premiere-generale"]');
const pa = await login('parent@test.local', 'parent-test-1234');
await pa.goto(BASE + '/parent/enfants');
ok((await pa.locator('select[name=level] option').allInnerTexts()).includes('Première générale'), 'le nouveau niveau est proposé aux parents');
await ad.goto(BASE + '/contenu/programmes?niveau=premiere-generale');
await bulk('bulk-levels', ['premiere-generale'], 'Désactiver');
await pa.goto(BASE + '/parent/enfants');
ok(!(await pa.locator('select[name=level] option').allInnerTexts()).includes('Première générale'), 'désactivé : plus proposé aux parents');
await bulk('bulk-levels', ['premiere-generale'], 'Supprimer');
ok((await done()).includes('Première générale : supprimé') && await ad.locator('[data-level="premiere-generale"]').count() === 0, 'niveau jamais utilisé : supprimé');
await ad.goto(P);
await bulk('bulk-levels', ['troisieme-generale'], 'Supprimer');
ok((await done()).includes('désactivé') && (await done()).includes('inscrit'), `niveau avec un élève : seulement désactivé (« ${await done()} »)`);
await bulk('bulk-levels', ['troisieme-generale'], 'Activer');

console.log('6. Importer un programme');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prog-'));
fs.writeFileSync(path.join(dir, 'programme.json'), JSON.stringify({ level: { code: 'terminale-generale', name: 'Terminale générale' }, subjects: [
  { name: 'Mathématiques', chapters: [{ name: 'Nombres entiers', courses: [{ title: 'Écrire les grands nombres', priority: 'prioritaire' }, { title: 'Comparer des nombres' }] }] },
  { name: 'Philosophie', chapters: [{ name: 'La conscience', courses: [{ title: 'Conscience et inconscient' }] }] }] }));
await ad.goto(P);
await ad.locator('summary:has-text("Importer un programme")').click();
await ad.setInputFiles('[data-import-programme] input[type=file]', path.join(dir, 'programme.json'));
await ad.click('[data-import-programme] button');
await ad.waitForSelector('[data-done]:has-text("importé")');
ok((await done()).includes('2 matière(s), 2 chapitre(s) et 3 cours ajoutés') && await ad.locator('[data-level="terminale-generale"]').count() === 1, `programme importé (« ${await done()} »)`);
await ad.goto(P.replace('troisieme-generale', 'terminale-generale')); await ad.locator('summary:has-text("Importer un programme")').click();
await ad.setInputFiles('[data-import-programme] input[type=file]', path.join(dir, 'programme.json'));
await ad.click('[data-import-programme] button'); await ad.waitForSelector('[data-done]:has-text("0 matière")');
ok((await done()).includes('0 matière(s), 0 chapitre(s) et 0 cours ajoutés'), 'réimporter le même fichier ne crée aucun doublon');
fs.writeFileSync(path.join(dir, 'inconnu.json'), JSON.stringify({ level: { code: 'niveau-invente', name: 'Inventé' }, subjects: [] }));
await ad.locator('summary:has-text("Importer un programme")').click();
await ad.setInputFiles('[data-import-programme] input[type=file]', path.join(dir, 'inconnu.json'));
await ad.click('[data-import-programme] button'); await ad.waitForSelector('[role=alert]:has-text("pas dans la liste")');
ok((await sql`select 1 from levels where code = 'niveau-invente'`).length === 0, 'un niveau hors de la liste est refusé, rien n’est créé');
fs.writeFileSync(path.join(dir, 'matiere.json'), JSON.stringify({ level: { code: 'terminale-generale', name: 'Terminale générale' }, subjects: [{ name: 'Cuisine', chapters: [] }] }));
await ad.goto(P.replace('troisieme-generale', 'terminale-generale')); await ad.locator('summary:has-text("Importer un programme")').click();
await ad.setInputFiles('[data-import-programme] input[type=file]', path.join(dir, 'matiere.json'));
await ad.click('[data-import-programme] button'); await ad.waitForSelector('[role=alert]:has-text("hors de la liste")');
ok((await sql`select 1 from subjects where name = 'Cuisine'`).length === 0, 'une matière hors de la liste est refusée, rien n’est créé');

for (const p of [ad, el, pa]) ok(p.errs.length === 0, `aucune erreur JS (${p.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nProgrammes : OK');
