// Schémas dans les cours (demande du propriétaire, 28/11/2026) : bloc « figure » en SVG, affiché comme une image dans la leçon
// et dans l'aperçu administrateur ; un SVG piégé (script, attribut on…, ressource extérieure) est refusé à l'import.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [c] = await sql`select c.id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = 'TG135'`;
const figs = c.doc.lesson.parts.flatMap(p => p.blocks).filter(b => b.type === 'figure');
ok(figs.length === 2, 'TG135 publié avec 2 schémas (bête à cornes, diagramme pieuvre)');

const b = await chromium.launch();
const login = async (user, pass) => {
  const p = await (await b.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
  p.errs = []; p.on('pageerror', e => { if (!/#418/.test(e.message)) p.errs.push(e.message.slice(0, 80)); }); p.on('dialog', d => { p.errs.push('fenêtre native'); d.dismiss(); });
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', user); await p.fill('input[name=password]', pass);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
  return p;
};
const ad = await login('admin@test.local', 'admin-test-1234');
console.log('Aperçu administrateur');
await ad.goto(`${BASE}/contenu/cours/${c.id}`);
const imgs = ad.locator('[data-figure] img');
ok(await imgs.count() === 2, 'les 2 schémas sont affichés dans l’aperçu du cours');
const nat = await imgs.first().evaluate(i => ({ w: i.naturalWidth, src: i.getAttribute('src').slice(0, 26), alt: i.alt }));
ok(nat.w > 0 && nat.src === 'data:image/svg+xml;charset' && nat.alt.includes('Bête à cornes'), 'affiché comme une image (data:image/svg+xml), avec sa description');

console.log('Import : un schéma piégé est refusé');
const bad = structuredClone(c.doc);
bad.lesson.parts[0].blocks.push({ type: 'figure', svg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="5"/></svg>', alt: 'piège' });
const ext = structuredClone(c.doc);
ext.lesson.parts[0].blocks.push({ type: 'figure', svg: '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://exemple.com/x.png"/></svg>', alt: 'extérieur' });
for (const [doc, what] of [[bad, 'attribut on…'], [ext, 'ressource extérieure']]) {
  await ad.goto(BASE + '/contenu/importer');
  await ad.fill('textarea[name=json]', JSON.stringify(doc));
  await ad.click('button:has-text("Vérifier et importer")');
  await ad.waitForSelector('[role=alert]:has-text("Import refusé")');
  ok((await ad.locator('div.bg-warm-soft[role=alert]').innerText()).includes('schéma'), `refusé : ${what}`);
}
ok((await sql`select count(*)::int as n from course_versions where course_id = ${c.id}`)[0].n === 1, 'aucune version enregistrée');
ok(ad.errs.length === 0, `aucune erreur JS (${ad.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nSchémas : OK');
