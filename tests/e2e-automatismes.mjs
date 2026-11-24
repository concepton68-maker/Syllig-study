// Automatismes et rédaction de cours par l'IA : correction dès la remise, bilan automatique, test de positionnement proposé seul,
// leçons de rattrapage rédigées (essai refusé par le validateur puis corrigé), publication → en tête du parcours de l'élève,
// bouton « Rédiger avec l'IA » du catalogue, file d'attente.
// Fournisseur simulé (port 3999). Serveur lancé avec AI_MISTRAL_BASE_URL=http://127.0.0.1:3999 et JOBS_TICK_MS=1000.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-automatismes.mjs
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };
const until = async (fn, ms = 30_000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 300)); } return null; };

// ── faux Mistral : corrige, rédige des bilans et des cours
const calls = { correction: 0, bilan: 0, cours: [] };
const sample = JSON.parse(fs.readFileSync(new URL('../content/troisieme-generale/cours/TG034.json', import.meta.url), 'utf8'));
const field = (prompt, k) => prompt.match(new RegExp(`^- ${k} : (.+)$`, 'm'))?.[1]?.trim();
const tries = {};
const course = prompt => {
  const code = field(prompt, 'code');
  tries[code] = (tries[code] ?? 0) + 1;
  if (code === 'RN002' && tries[code] === 1) return '{"format": "syllig-course/1", "code": "RN002"}';   // premier essai incomplet : refusé par le validateur
  return JSON.stringify({ ...sample, code, level: field(prompt, 'level'), subject: field(prompt, 'subject'), chapter: field(prompt, 'chapter'), title: field(prompt, 'title') });
};
const report = {
  synthese: 'Bases de calcul fragiles.', confiance: 'faible', confiance_raison: 'Une seule évaluation.',
  origine: { principale: 'lacunes_anterieures', explication: 'Erreurs de signes.', preuves: ['4 − (−11) = −7'] },
  implication: { niveau: 'serieuse', indices: ['Temps correct'] }, matieres: [],
  lacunes: [{ notion: 'Relatifs', matiere: 'Mathématiques', niveau_origine: '5e', gravite: 'haute', preuve: 'Erreur de signe' }],
  lecons_a_creer: [
    { titre: 'Les nombres relatifs : addition et soustraction', matiere: 'Mathématiques', niveau: '5e', objectif: 'Calculer sans erreur de signe.', priorite: 1 },
    { titre: 'Les fractions : simplifier', matiere: 'Mathématiques', niveau: '5e', objectif: 'Simplifier une fraction.', priorite: 2 }],
  test_positionnement: { consigne_eleve: 'On fait le point.', questions: Array.from({ length: 6 }, (_, i) => (
    { matiere: 'Mathématiques', notion: `Notion ${i + 1}`, niveau_origine: '5e', type: 'numeric', prompt: `Combien font ${i} + 1 ?`, options: [], reponse: String(i + 1), explication: `${i} + 1 = ${i + 1}.` })) },
  conseils_parents: ['Calcul mental chaque jour.'], limites: 'Peu de données.',
};
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/v1/models') return json(200, { data: [{ id: 'mistral-large-latest', capabilities: { completion_chat: true } }, { id: 'mistral-small-latest', capabilities: { completion_chat: true } }] });
    if (u.pathname !== '/v1/chat/completions') return json(404, {});
    const b = JSON.parse(body);
    if (!b.response_format) return json(200, { choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
    const sys = b.messages[0].content, user = b.messages[1].content;
    let out;
    if (sys.includes('auteur de cours')) {
      calls.cours.push({ model: b.model, user, stream: !!b.stream });
      const text = course(user);
      // réponse au fil de l'eau (SSE), en morceaux espacés, comme Mistral
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const parts = text.match(/[\s\S]{1,3000}/g) ?? [];
      let i = 0;
      const next = () => {
        if (i < parts.length) { res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: parts[i++] }, finish_reason: null }] })}\n\n`); setTimeout(next, 500); }
        else { res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: '' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`); res.end(); }
      };
      return next();
    }
    else if (sys.includes('conseiller pédagogique')) { calls.bilan++; out = JSON.stringify(report); }
    else { calls.correction++; const copy = JSON.parse(user.slice(user.indexOf('{')));
      out = JSON.stringify({ commentaire_general: 'Correction automatique.', questions: copy.questions.map(q => ({ id: q.id, points: q.points_max / 2, commentaire: 'Bien.' })) }); }
    json(200, { choices: [{ message: { role: 'assistant', content: out }, finish_reason: 'stop' }] });
  });
}).listen(3999);

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"eval_requires_approval": false}'::jsonb`;
await sql`update student_years set level_code = 'troisieme-generale'`;
const courseOf = async code => (await sql`select c.id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = ${code}`)[0];

const b = await chromium.launch();
const errs = [];
const page = async (l, pw, mobile) => { const p = await (await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 860 } })).newPage();
  p.on('pageerror', e => errs.push(`${p.url()} : ${e.message.slice(0, 80)}`)); p.on('dialog', d => { errs.push('fenêtre native : ' + d.message()); d.dismiss(); });
  await p.route('**/api/activity', r => r.fulfill({ status: 200, body: '{}' }));
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw); await p.click('button[type=submit]');
  await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };

console.log('Réglages');
const ad = await page('admin@test.local', 'admin-test-1234');
await ad.goto(BASE + '/contenu/ia');
const f = ad.locator('form[data-provider="mistral"]');
await f.locator('input[name=key]').fill('cle'); await f.locator('button:has-text("Vérifier et enregistrer")').click(); await f.locator('[role=status]').waitFor();
const [{ value: s0 }] = await sql`select value from app_settings where key = 'ia'`;
ok(s0.tasks.cours?.model === 'mistral-large-latest', 'la rédaction des cours reçoit Mistral Large d’office');

const pa = await page('parent@test.local', 'parent-test-1234');
await pa.goto(BASE + '/parent/bilan#confidentialite');
await pa.check('input[name=ai_correction]'); await pa.check('input[name=auto_correction]');
await pa.check('input[name=ai_bilan]'); await pa.selectOption('select[name=auto_bilan]', 'hebdo'); await pa.check('input[name=auto_test]');
await pa.click('button:has-text("Enregistrer mes choix")'); await pa.waitForSelector('text=Choix enregistrés');
const [{ settings: ss }] = await sql`select settings from students where id = ${st.id}`;
ok(ss.auto_correction && ss.auto_bilan === 'hebdo' && ss.auto_test, 'le parent active la correction automatique, le bilan hebdomadaire et le test automatique');

console.log('Correction dès la remise');
const el = await page('lea', 'lea-test-1234', true);
const c1 = await courseOf('TG001');
await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, exercises_score) values (${st.id}, ${c1.id}, now(), now(), 9)
  on conflict (student_id, course_id) do update set lesson_done_at = now(), exercises_done_at = now()`;
await el.goto(`${BASE}/eleve/cours/${c1.id}/evaluation`); await el.click('button:has-text("Commencer")'); await el.waitForSelector('[role=timer]');
const [att] = await sql`select id, variant from eval_attempts where student_id = ${st.id} and course_id = ${c1.id} order by attempt_no desc limit 1`;
for (const s of c1.doc.evaluation.variants[att.variant].sections) {
  await el.click(`[role=tab]:has-text("${s.label.split(' (')[0].slice(0, 30)}")`);
  for (const q of s.questions) if (q.type === 'open') await el.locator(`[aria-label="Ta réponse à ${q.id}"]`).fill('Ma réponse.');
}
await el.click('text=Remettre ma copie'); await el.click('button:has-text("Oui, remettre")'); await el.waitForURL(/bilan/);
const prop = await until(async () => (await sql`select proposal from eval_attempts where id = ${att.id}`)[0].proposal);
ok(prop && prop.general?.comment === 'Correction automatique.' && calls.correction >= 1, 'la copie est corrigée par l’IA toute seule, juste après la remise');
await pa.goto(BASE + '/parent/a-faire');
ok((await pa.locator('main').innerText()).includes('Pré-corrigée'), '« À faire » : la copie est déjà pré-corrigée');
await pa.locator('label:has-text("Tout sélectionner") input').first().check();
await pa.click('button:has-text("Valider les notes proposées")'); await pa.click('[data-dialog-ok]');
await pa.waitForSelector('text=1 note validée');

console.log('Bilan automatique et test proposé seul');
await ad.goto(BASE + '/contenu/ia'); await ad.click('button:has-text("Vérifier les automatismes maintenant")');
await ad.waitForSelector('text=1 bilan');
const rep = await until(async () => (await sql`select id from student_reports where student_id = ${st.id}`)[0]);
ok(rep && calls.bilan === 1, 'le bilan hebdomadaire est rédigé automatiquement');
const test = await until(async () => (await sql`select total from placement_tests where student_id = ${st.id}`)[0]);
ok(test?.total === 6, 'le test de positionnement est proposé automatiquement à l’élève');
await el.goto(BASE + '/eleve'); ok(await el.locator('a:has-text("Faire le test")').count() === 1, 'l’élève voit le test dans « Aujourd’hui »');
await ad.goto(BASE + '/contenu/ia'); await ad.click('button:has-text("Vérifier les automatismes maintenant")');
await ad.waitForSelector('text=0 bilan');
ok(true, 'pas de second bilan tant que la semaine n’est pas écoulée');

console.log('Leçons de rattrapage rédigées par l’IA');
await ad.goto(BASE + '/contenu/a-creer');
await ad.locator('label:has-text("Tout sélectionner") input').first().check();
await ad.click('button:has-text("Rédiger avec l’IA (2)")'); await ad.click('[data-dialog-ok]');
await ad.waitForSelector('text=2 leçons en cours de rédaction');
let seenProgress = false;
const watcher = setInterval(async () => { const [r] = await sql`select 1 from jobs where kind = 'cours' and progress like '%rédigé%'`; if (r) seenProgress = true; }, 200);
const drafts = await until(async () => { const r = await sql`select c.code, c.title, ch.name as chapter from course_versions v join courses c on c.id = v.course_id join chapters ch on ch.id = c.chapter_id where c.code like 'RN%' and v.status = 'draft'`; return r.length === 2 ? r : null; }, 45_000);
clearInterval(watcher);
ok(drafts && drafts.every(d => d.chapter === 'Remise à niveau'), 'deux cours « Remise à niveau » rédigés et placés en brouillon (À relire)');
const rn2 = calls.cours.filter(c => field(c.user, 'code') === 'RN002');
ok(rn2.length === 2 && rn2[1].user.includes('refusée par le validateur') && calls.cours.every(c => c.model === 'mistral-large-latest'), 'un premier essai refusé par le validateur est corrigé au second essai');
ok(calls.cours.every(c => c.stream), 'la rédaction est reçue au fil de l’eau (pas de coupure au bout de 5 minutes)');
ok(seenProgress, 'l’avancement de la rédaction est visible pendant le travail (« … % rédigé »)');
// (« Léa » existe comme personnage fictif dans les cours d'exemple : on vérifie l'absence de ce qui identifie l'élève réel)
ok(!calls.cours.some(c => c.user.includes(st.id) || c.user.includes('parent@test.local') || c.user.includes('Erreur de signe') || c.user.includes('4 − (−11) = −7')),
  'aucune donnée d’élève dans la demande de rédaction (ni identifiant, ni contenu du bilan)');
await ad.goto(BASE + '/contenu/a-creer');
ok(await ad.locator('a:has-text("Brouillon prêt : à relire")').count() === 2, '« Leçons à créer » : lien vers chaque brouillon prêt');

console.log('Publication : la leçon passe en tête du parcours de l’élève');
const [rn1] = await sql`select c.id, c.title from courses c where c.code = 'RN001'`;
await ad.goto(`${BASE}/contenu/cours/${rn1.id}`);
await ad.click('text=Publier cette version'); await ad.click('[data-dialog-ok]');
await ad.waitForURL(/publie=1/);
const [pr] = await sql`select forced from course_progress where student_id = ${st.id} and course_id = ${rn1.id}`;
ok(pr?.forced === 'now', 'à la publication, la leçon est mise en tête du parcours de l’élève concerné');
await sql`delete from placement_tests where student_id = ${st.id}`;
await el.goto(BASE + '/eleve');
ok((await el.locator('main').innerText()).includes(rn1.title), `l’élève voit « ${rn1.title} » comme prochaine étape`);

console.log('Catalogue : « Rédiger avec l’IA »');
const [empty] = await sql`select c.id, c.title from courses c where c.code = 'TG002'`;
await sql`delete from course_versions where course_id = ${empty.id}`;
await ad.goto(BASE + '/contenu');
await ad.fill('input[type=search]', empty.title.slice(0, 25));
await ad.locator(`div:has(> span > span:text-is("${empty.title}")) button:has-text("Rédiger avec l’IA")`).click();
await ad.waitForSelector('text=/Rédaction IA/');
ok(true, 'catalogue : « Rédaction IA… » affiché pendant le travail');
await ad.locator(`div:has(> span > span:text-is("${empty.title}")) >> text=À relire · v1`).waitFor({ timeout: 60_000 });
ok(!!(await sql`select 1 from course_versions where course_id = ${empty.id} and status = 'draft'`)[0], 'bouton du catalogue : le cours est rédigé, et la page affiche « À relire » toute seule (sans F5)');
await ad.goto(BASE + '/contenu/ia');
ok((await ad.locator('section[aria-labelledby="file"]').innerText()).includes('Terminé'), 'la file d’attente montre les tâches terminées');

ok(errs.length === 0, `aucune erreur JavaScript ni fenêtre native (${errs.join(' | ') || 'aucune'})`);
await b.close(); mock.close(); await sql.end();
console.log('Automatismes et rédaction de cours : OK');
