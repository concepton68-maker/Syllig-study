// Relecture groupée des cours par Claude (demande du propriétaire, 27/11/2026) : exporter les cours cochés en un seul fichier
// (consigne comprise), simuler la correction par Claude, réimporter. Vérifie : tout ou rien si un cours est refusé, cours
// identiques ignorés, brouillon « À relire » par défaut, publication aussitôt sur demande (l'ancienne version archivée).
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-cours-lot.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lot-'));

const cs = await sql`select c.id, c.code from courses c where c.code in ('TG001', 'TG002', 'TG034') order by c.code`;
ok(cs.length === 3, 'trois cours publiés de 3e');
const ver = async code => (await sql`select v.version, v.status from course_versions v join courses c on c.id = v.course_id where c.code = ${code} order by v.version`).map(v => `${v.version}:${v.status}`).join(' ');
const before = Object.fromEntries(await Promise.all(cs.map(async c => [c.code, await ver(c.code)])));

const b = await chromium.launch();
const ad = await (await b.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true })).newPage();
const errs = []; ad.on('pageerror', e => errs.push(e.message.slice(0, 80))); ad.on('dialog', d => { errs.push('fenêtre native'); d.dismiss(); });
await ad.goto(BASE + '/connexion'); await ad.fill('input[name=login]', 'admin@test.local'); await ad.fill('input[name=password]', 'admin-test-1234'); await ad.click('button[type=submit]');
await ad.waitForURL(u => !u.pathname.startsWith('/connexion'));

console.log('1. Export des cours cochés');
await ad.goto(BASE + '/contenu');
for (const c of cs) await ad.check(`input[data-bulk="bulk-catalogue"][value="${c.id}"]`);
const [dl] = await Promise.all([ad.waitForEvent('download'), ad.click('button:has-text("Exporter pour relecture (1 fichier) (3)")')]);
const file = path.join(dir, dl.suggestedFilename()); await dl.saveAs(file);
const lot = JSON.parse(fs.readFileSync(file, 'utf8'));
ok(/^cours-a-relire-\d{4}-\d{2}-\d{2}-3\.json$/.test(dl.suggestedFilename()), `un seul fichier : ${dl.suggestedFilename()}`);
ok(lot.format === 'syllig-cours-lot/1' && lot.cours.length === 3 && lot.cours.map(c => c.code).join(',') === 'TG001,TG002,TG034', 'le lot contient les 3 cours, dans l’ordre des codes');
ok(lot.consigne.includes('SEULEMENT les cours que tu as corrigés') && lot.consigne.includes('même code'), 'la consigne pour Claude est dans le fichier (ne renvoyer que les cours corrigés)');
ok(!/lea|Léa|parent@|students/i.test(JSON.stringify(lot)), 'aucune donnée d’élève dans le fichier');
const all = await ad.request.get(BASE + '/api/contenu/lot');
const [{ n }] = await sql`select count(distinct course_id)::int as n from course_versions where status in ('draft', 'published')`;
ok(all.ok() && (await all.json()).cours.length === n, `« Tout exporter » : les ${n} cours qui ont un contenu`);

// « Claude » corrige : TG001 modifié, TG002 renvoyé tel quel, TG034 modifié
const fixed = structuredClone(lot);
fixed.cours[0].lesson.parts[0].title = fixed.cours[0].lesson.parts[0].title + ' (corrigé)';
fixed.cours[2].lesson.parts[0].title = fixed.cours[2].lesson.parts[0].title + ' (corrigé)';

console.log('2. Un cours refusé : rien n’est enregistré');
const bad = structuredClone(fixed); delete bad.cours[2].title;
fs.writeFileSync(path.join(dir, 'mauvais.json'), JSON.stringify(bad));
await ad.goto(BASE + '/contenu/importer');
await ad.setInputFiles('input[name=files]', path.join(dir, 'mauvais.json'));
await ad.click('button:has-text("Vérifier et importer")');
await ad.waitForSelector('text=Import refusé, rien n’a été enregistré');
ok((await ad.locator('[role=alert]').innerText()).includes('TG034'), 'l’erreur nomme le cours fautif (TG034)');
ok((await ver('TG001')) === before.TG001 && (await ver('TG034')) === before.TG034, 'aucune nouvelle version, même pour le cours correct (TG001)');

console.log('3. Import en brouillon « À relire »');
fs.writeFileSync(path.join(dir, 'corrige.json'), JSON.stringify(fixed));
await ad.goto(BASE + '/contenu/importer');
await ad.setInputFiles('input[name=files]', path.join(dir, 'corrige.json'));
await ad.click('button:has-text("Vérifier et importer")');
await ad.waitForSelector('[data-batch-summary]');
const sum = await ad.locator('[data-batch-summary]').innerText();
ok(sum.includes('2 cours enregistrés en brouillon') && sum.includes('TG001') && sum.includes('TG034') && sum.includes('1 cours renvoyé sans changement, ignoré : TG002'), `résumé : 2 brouillons, TG002 ignoré (« ${sum.replace(/\s+/g, ' ')} »)`);
ok((await ver('TG002')) === before.TG002, 'TG002 identique : aucune nouvelle version');
const [d1] = await sql`select v.status, v.document->'lesson'->'parts'->0->>'title' as t from course_versions v join courses c on c.id = v.course_id where c.code = 'TG001' order by v.version desc limit 1`;
ok(d1.status === 'draft' && d1.t.endsWith('(corrigé)'), 'TG001 : nouvelle version en brouillon avec la correction');
const [p1] = await sql`select count(*)::int as n from course_versions v join courses c on c.id = v.course_id where c.code = 'TG001' and v.status = 'published'`;
ok(p1.n === 1, 'la version publiée reste visible par les élèves en attendant la relecture');

console.log('4. Réimport avec « publier aussitôt » : Claude ne renvoie que le cours corrigé, entouré de balises de code');
const again = { format: fixed.format, cours: [structuredClone(fixed.cours[0])] }; again.cours[0].lesson.parts[0].title += ' bis';
fs.writeFileSync(path.join(dir, 'corrige2.json'), '```json\n' + JSON.stringify(again) + '\n```');
await ad.goto(BASE + '/contenu/importer');
await ad.setInputFiles('input[name=files]', path.join(dir, 'corrige2.json'));
await ad.check('[data-batch-publish]');
await ad.click('button:has-text("Vérifier et importer")');
await ad.waitForSelector('[data-batch-summary]');
const sum2 = (await ad.locator('[data-batch-summary]').innerText()).replace(/\s+/g, ' ');
ok(sum2.includes('1 cours corrigé et publié') && sum2.includes('TG001') && !sum2.includes('TG034'), `résumé : TG001 publié, les cours absents du fichier ne sont pas touchés (« ${sum2} »)`);
ok((await ver('TG002')) === before.TG002, 'TG002, absent du fichier : inchangé');
const vs = await sql`select v.status, v.document->'lesson'->'parts'->0->>'title' as t from course_versions v join courses c on c.id = v.course_id where c.code = 'TG001' order by v.version`;
ok(vs.filter(v => v.status === 'published').length === 1 && vs.find(v => v.status === 'published').t.endsWith('(corrigé) bis') && vs.some(v => v.status === 'archived'), 'TG001 : la version corrigée est publiée, l’ancienne archivée dans l’historique');

console.log('5. Rien à corriger');
fs.writeFileSync(path.join(dir, 'vide.json'), JSON.stringify({ format: 'syllig-cours-lot/1', cours: [] }));
await ad.goto(BASE + '/contenu/importer');
await ad.setInputFiles('input[name=files]', path.join(dir, 'vide.json'));
await ad.click('button:has-text("Vérifier et importer")');
await ad.waitForSelector('[data-batch-summary]');
ok((await ad.locator('[data-batch-summary]').innerText()).includes('Aucun cours à corriger'), 'lot vide : « Aucun cours à corriger »');
ok(errs.length === 0, `aucune erreur JS ni fenêtre native (${errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nRelecture groupée des cours : OK');
