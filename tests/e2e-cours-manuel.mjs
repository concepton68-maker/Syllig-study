// Création d'un cours SANS IA branchée, par export / import avec Claude (claude.ai) :
// leçon de rattrapage → « Ajouter au catalogue » → « Préparer la consigne » → copier → (Claude) → Importer → À relire → Publier
// → en tête du parcours de l'élève. Vérifie aussi que la consigne demande bien leçon + exercices + évaluation (2 sujets).
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-cours-manuel.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

// un bilan a proposé une leçon de rattrapage (aucune IA branchée pour les cours)
const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale'`; await sql`update student_years set level_code = 'troisieme-generale'`;
const [rep] = await sql`insert into student_reports (student_id, provider, model, indicators, data) values (${st.id}, 'mistral', 'test', '{}'::jsonb, '{}'::jsonb) returning id`;
await sql`insert into lesson_suggestions (report_id, title, subject, level, objective, priority)
  values (${rep.id}, 'Les fractions : simplifier et comparer', 'Mathématiques', '5e', 'Simplifier une fraction et comparer deux fractions.', 1)`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
const ad = await ctx.newPage();
const errs = []; ad.on('pageerror', e => errs.push(e.message.slice(0, 80))); ad.on('dialog', d => { errs.push('fenêtre native'); d.dismiss(); });
await ad.goto(BASE + '/connexion'); await ad.fill('input[name=login]', 'admin@test.local'); await ad.fill('input[name=password]', 'admin-test-1234'); await ad.click('button[type=submit]');
await ad.waitForURL(u => !u.pathname.startsWith('/connexion'));
let clicks = 0; const click = async sel => { clicks++; await ad.click(sel); };

console.log('1. Leçons à créer → catalogue');
await ad.goto(BASE + '/contenu/a-creer');
await ad.locator('label:has-text("Tout sélectionner") input').first().check(); clicks++;
await click('button:has-text("Ajouter au catalogue (1)")');
await ad.waitForSelector('text=1 leçon ajoutée au catalogue');
const [c] = await sql`select c.id, c.code, ch.name as chapter from courses c join chapters ch on ch.id = c.chapter_id where c.title = 'Les fractions : simplifier et comparer'`;
ok(c?.code === 'RN001' && c.chapter === 'Remise à niveau', 'leçon rangée au catalogue (Mathématiques 3e › Remise à niveau, code RN001)');

console.log('2. Consigne pour Claude');
await click('a:has-text("Préparer la consigne")');
await ad.waitForURL(/\/contenu\/generer\//);
const prompt = await ad.locator('textarea[aria-label="Consigne générée"]').inputValue();
ok(prompt.includes('- code : RN001') && prompt.includes('- chapter : Remise à niveau'), 'la consigne reprend la fiche du cours');
ok(/Exercices : environ 8/.test(prompt) && /Évaluation de 20 min, total \*\*exactement 20 points\*\*/.test(prompt) && prompt.includes('2 sujets'), 'la consigne demande la leçon, les exercices corrigés et l’évaluation (2 sujets, 20 points, barèmes)');
const reglages = await ad.locator('text=Proposés automatiquement').locator('..').innerText();
ok(reglages.includes('remise à niveau') && reglages.includes('3e générale') && await ad.locator('input[type=number]').first().inputValue() === '20',
  'réglages proposés automatiquement (niveau 3e, remise à niveau : leçon 20 min, 8 exercices, évaluation 20 min), avec l’explication');
ok(prompt.includes('notion de 5e'), 'la consigne précise qu’il s’agit d’une remise à niveau (notion de 5e)');
await click('button:has-text("Copier la consigne")');
await ad.waitForSelector('text=Copiée ✓');
ok((await ad.evaluate(() => navigator.clipboard.readText())) === prompt, 'un clic copie toute la consigne (à coller dans claude.ai)');

console.log('3. Import de la réponse de Claude');
// ce que Claude renverrait : un cours complet au format attendu (ici, un cours de la bibliothèque adapté à la fiche)
const sample = JSON.parse(fs.readFileSync(new URL('../content/troisieme-generale/cours/TG034.json', import.meta.url), 'utf8'));
const f = k => prompt.match(new RegExp(`^- ${k} : (.+)$`, 'm'))[1].trim();
const claudeJson = JSON.stringify({ ...sample, code: f('code'), level: f('level'), subject: f('subject'), chapter: f('chapter'), title: f('title') });
await click('a:has-text("Importer")');
await ad.waitForURL(/\/contenu\/importer/);
await ad.fill('textarea[name=json]', claudeJson);
await click('button:has-text("Vérifier et importer en brouillon")');
await ad.waitForURL(/importe=1/);
const [v] = await sql`select id, status from course_versions where course_id = ${c.id}`;
ok(v?.status === 'draft', 'le cours collé est vérifié et importé en brouillon');
// le cours d'exemple a une évaluation de 30 min (20 demandées : le chrono de l'élève change → signalé) et une leçon de 40 min (le double : signalé)
const params = await ad.locator('section[aria-labelledby="parametres"]').innerText();
ok(params.includes('c’est le chrono de l’élève') && params.includes('à vérifier avant de publier') && !params.includes('trop peu d’entraînement'),
  'page de relecture : paramètres du cours affichés, seuls les écarts qui comptent pour l’élève sont signalés');

console.log('4. Relecture et publication');
await ad.goto(BASE + '/contenu/a-creer');
await click('a:has-text("Brouillon importé : à relire")');
await ad.waitForURL(new RegExp(`/contenu/cours/${c.id}`));
await click('text=Publier cette version'); await click('[data-dialog-ok]');
await ad.waitForURL(/publie=1/);
const [pr] = await sql`select forced from course_progress where student_id = ${st.id} and course_id = ${c.id}`;
const [sg] = await sql`select status from lesson_suggestions`;
ok(pr?.forced === 'now' && sg.status === 'creee', 'publié : la leçon passe en tête du parcours de l’élève, la suggestion est marquée créée');
ok(clicks <= 10, `circuit complet en ${clicks} clics (plus le copier-coller dans claude.ai)`);

ok(errs.length === 0, `aucune erreur JavaScript ni fenêtre native (${errs.join(' | ') || 'aucune'})`);
await b.close(); await sql.end();
console.log('Cours par export / import Claude : OK');
