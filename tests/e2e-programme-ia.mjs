// Préparer le programme d'un niveau (maquette validée le 28/11/2026) : niveau sans programme → carte « pas encore de programme »,
// consigne pour Claude téléchargée, réponse importée (matière hors liste écartée), vérification à cocher, ajout ; puis proposition par l'IA
// (faux Mistral, port 3999, aucune donnée d'élève, envoi consigné), une matière décochée, proposition déjà ajoutée.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs` ; serveur lancé avec AI_MISTRAL_BASE_URL=http://127.0.0.1:3999.
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const calls = [];
const prog = {
  subjects: [
    { name: 'Philosophie', chapters: [
      { name: 'La conscience', courses: [{ title: 'Qu’est-ce que la conscience ?', priority: 'prioritaire' }, { title: 'Conscience et inconscient' }] },
      { name: 'La liberté', courses: [{ title: 'Être libre, est-ce faire ce que l’on veut ?', priority: 'prioritaire' }, { title: 'Liberté et déterminisme' }] }] },
    { name: 'Mathématiques', chapters: [{ name: 'Suites', courses: [{ title: 'Le raisonnement par récurrence', priority: 'prioritaire' }, { title: 'Limites de suites' }] }] },
    { name: 'Cuisine moléculaire', chapters: [{ name: 'X', courses: [{ title: 'Y' }] }] }],
};
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/v1/models') return json(200, { data: [{ id: 'mistral-large-latest', capabilities: { completion_chat: true } }] });
    if (!u.pathname.endsWith('/chat/completions')) return json(404, {});
    const b = JSON.parse(body); const sys = b.messages[0]?.role === 'system' ? b.messages[0].content : '';
    if (sys.startsWith('Réponds par un objet JSON')) return json(200, { choices: [{ message: { content: '{"ok": true, "phrase": "Bonjour."}' }, finish_reason: 'stop' }] });
    if (sys.startsWith('Réponds uniquement par un objet JSON')) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"ok": true}' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`); return res.end();
    }
    if (!b.response_format) return json(200, { choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
    if (sys.includes('inspecteur pédagogique')) { calls.push({ sys, user: b.messages[1].content }); return json(200, { choices: [{ message: { content: JSON.stringify(prog) }, finish_reason: 'stop' }] }); }
    json(500, { error: { message: 'inattendu' } });
  });
}).listen(3999);

for (const [code, name] of [['premiere-generale', 'Première générale'], ['terminale-generale', 'Terminale générale']])
  await sql`insert into levels (code, name, cycle, position) values (${code}, ${name}, 'Lycée', 9) on conflict (code) do update set removed_at = null`;
await sql`delete from subjects where level_code in ('premiere-generale', 'terminale-generale')`;

const b = await chromium.launch();
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const ad = await ctx.newPage();
ad.on('pageerror', e => errs.push(e.message)); ad.on('dialog', d => { errs.push('fenêtre native'); d.dismiss(); });
await ad.goto(BASE + '/connexion'); await ad.fill('input[name=login]', 'admin@test.local'); await ad.fill('input[name=password]', 'admin-test-1234'); await ad.click('button[type=submit]');
await ad.waitForURL(u => !u.pathname.startsWith('/connexion'));

console.log('1. Niveau sans programme : la carte et ses deux chemins');
await ad.goto(BASE + '/contenu');
await ad.selectOption('select[aria-label="Niveau"]', 'premiere-generale');
await ad.waitForSelector('[data-empty-level]');
ok((await ad.locator('[data-empty-level] a:has-text("Préparer le programme")').getAttribute('href')).includes('niveau=premiere-generale'), 'catalogue : niveau vide → « Préparer le programme »');
await ad.goto(BASE + '/contenu/programmes?niveau=premiere-generale');
const card = ad.locator('[data-empty-programme="premiere-generale"]');
ok((await card.innerText()).includes('Première générale n’a pas encore de programme'), 'Programmes : « Première générale n’a pas encore de programme »');
ok((await ad.locator('[data-propose-ai]').innerText()).includes('configurer l’IA'), 'sans IA prête : le bouton IA est remplacé par le lien vers Contenu › IA');
const [dl] = await Promise.all([ad.waitForEvent('download'), ad.click('[data-consigne]')]);
const consigne = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
ok(dl.suggestedFilename() === 'consigne-programme-premiere-generale.txt' && consigne.includes('Première générale') && consigne.includes('- Enseignement scientifique') && consigne.includes('"subjects"'),
  'consigne téléchargée : niveau, matières de la liste officielle, format attendu');

console.log('2. Réponse de Claude importée, vérifiée, ajoutée');
await ad.locator('[data-propose-claude] summary').click();
await ad.fill('[data-import-reply] textarea', 'pas du json');
await ad.click('[data-import-reply] button[type=submit]');
await ad.waitForSelector('[role=alert]:has-text("JSON valide")');
ok(true, 'réponse illisible : message clair, rien de créé');
const reply = { subjects: [{ name: 'Français', chapters: [{ name: 'La poésie', courses: [{ title: 'Les formes poétiques', priority: 'prioritaire' }, { title: 'Le commentaire d’un poème' }, { title: 'Le recueil au programme' }] }] },
  { name: 'Histoire-Géographie', chapters: [{ name: 'L’Europe face aux révolutions', courses: [{ title: 'La Révolution française' }, { title: 'Le Congrès de Vienne' }] }] },
  { name: 'Astrologie', chapters: [{ name: 'Signes', courses: [{ title: 'Bélier' }] }] }] };
await ad.locator('[data-propose-claude] summary').click();
await ad.fill('[data-import-reply] textarea', '```json\n' + JSON.stringify(reply, null, 1) + '\n```');
await ad.click('[data-import-reply] button[type=submit]');
await ad.waitForURL(/\/contenu\/programmes\/proposition\//);
const head = await ad.locator('main').innerText();
ok(head.includes('Programme proposé · Première générale') && head.includes('2 matières · 2 chapitres · 5 cours') && head.includes('préparé par Claude'), 'page de vérification : 2 matières, 2 chapitres, 5 cours');
ok((await ad.locator('[data-prop-ignored]').innerText()).includes('Astrologie'), 'matière hors liste écartée et signalée');
ok(await ad.locator('[data-prop-apply]').innerText() === 'Ajouter les 2 matières cochées', 'tout est coché : « Ajouter les 2 matières cochées »');
await ad.locator('[data-prop-course="Le recueil au programme"] input').uncheck();
await ad.locator('[data-prop-subject="Histoire-Géographie"] > div input[type=checkbox]').uncheck();
ok(await ad.locator('[data-prop-apply]').innerText() === 'Ajouter la matière cochée', 'une matière et un cours décochés : « Ajouter la matière cochée »');
await ad.locator('[data-prop-subject="Histoire-Géographie"] button').click();
await ad.locator('[data-prop-course="Le Congrès de Vienne"] input').check();
ok(await ad.locator('[data-prop-apply]').innerText() === 'Ajouter les 2 matières cochées', 'recocher un cours recoche sa matière et son chapitre');
await ad.locator('[data-prop-course="La Révolution française"] input').uncheck();
await ad.click('[data-prop-apply]');
await ad.waitForSelector('[data-done]');
ok((await ad.locator('[data-done]').innerText()).includes('2 matière(s), 2 chapitre(s) et 3 cours'), 'ajouté : 2 matières, 2 chapitres, 3 cours (seulement ce qui est coché)');
const got = await sql`select s.name as s, ch.name as ch, c.title, c.priority from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
  where s.level_code = 'premiere-generale' order by c.id`;
ok(JSON.stringify(got.map(g => g.title)) === JSON.stringify(['Les formes poétiques', 'Le commentaire d’un poème', 'Le Congrès de Vienne']) && got[0].priority === 'prioritaire' && got[1].priority === 'ensuite',
  'en base : les 3 cours cochés, avec leur priorité');
ok(!(await ad.locator('[data-empty-programme]').count()), 'le niveau a un programme : la carte disparaît');
await ad.goBack(); await ad.reload();
ok((await ad.locator('[data-proposal-applied]').count()) === 1, 'revenir sur la proposition : « déjà été ajouté », pas de double ajout');
await ad.goto(BASE + '/contenu');
await ad.selectOption('select[aria-label="Niveau"]', 'premiere-generale');
ok((await ad.locator('main').innerText()).includes('Les formes poétiques'), 'les cours sont dans le catalogue, à rédiger');

console.log('3. Proposition par l’IA');
await ad.goto(BASE + '/contenu/ia');
if (!(await ad.locator('form[data-slot]').count())) await ad.click('button:has-text("Ajouter une clé")');
const f = ad.locator('form[data-slot]').last();
await f.locator('select[name=preset]').selectOption('mistral'); await f.locator('input[name=key]').fill('cle');
await f.locator('button:has-text("Vérifier et enregistrer")').click(); await ad.waitForSelector('text=vérifiée et enregistrée');
await ad.goto(BASE + '/contenu/programmes?niveau=terminale-generale');
await ad.click('[data-propose-ai] button[type=submit]');
await ad.waitForURL(/\/contenu\/programmes\/proposition\//, { timeout: 30_000 });
ok(calls.length === 1 && calls[0].sys.includes('Terminale générale') && calls[0].sys.includes('- Philosophie') && !/lea|Léa|élève :/i.test(calls[0].sys + calls[0].user), 'l’IA reçoit le niveau et la liste des matières, aucune donnée d’élève');
const [log] = await sql`select task, student_id from ai_requests where task = 'programme' order by created_at desc limit 1`;
ok(log && log.student_id === null, 'envoi consigné (tâche « programme », sans élève)');
ok((await ad.locator('main').innerText()).includes('2 matières · 3 chapitres · 6 cours · proposé par l’IA'), 'proposition de l’IA : 2 matières, 3 chapitres, 6 cours');
ok((await ad.locator('[data-prop-ignored]').innerText()).includes('Cuisine moléculaire'), 'matière inventée écartée');
await ad.locator('[data-prop-subject="Mathématiques"] > div input[type=checkbox]').uncheck();
await ad.click('[data-prop-apply]'); await ad.waitForSelector('[data-done]');
const [{ n, m }] = await sql`select count(*)::int as n, count(*) filter (where s.name = 'Mathématiques')::int as m from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id where s.level_code = 'terminale-generale'`;
ok(n === 4 && m === 0, 'Mathématiques décochée : seuls les 4 cours de Philosophie sont ajoutés');
ok(errs.length === 0, 'aucune erreur de page ni fenêtre native' + (errs.length ? ' : ' + errs.join(' | ') : ''));
await b.close(); mock.close(); await sql.end();
console.log('OK');
