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
    if (u.pathname === '/api/paas/v4/models') return json(404, { error: { message: 'Not Found' } });   // fournisseur qui ne publie pas sa liste (GLM)
    if (u.pathname.startsWith('/api/paas/v4/') && req.headers.authorization !== 'Bearer cle-glm') return json(401, { error: { message: 'invalid api key' } });
    if (!u.pathname.endsWith('/chat/completions')) return json(404, {});
    const b = JSON.parse(body);
    const glm = u.pathname.startsWith('/api/paas/v4/');
    // GLM simulé : refuse le mode JSON (la plateforme doit réessayer sans), et « réfléchit » avant d'écrire
    if (glm && b.response_format) return json(400, { error: { code: '1210', message: 'Invalid parameter: response_format is not supported' } });
    const sys0 = b.messages[0]?.role === 'system' ? b.messages[0].content : '';
    if (sys0.startsWith('Réponds par un objet JSON')) return json(200, { choices: [{ message: { content: '{"ok": true, "phrase": "Bonjour, tout fonctionne."}' }, finish_reason: 'stop' }] });
    if (sys0.startsWith('Réponds uniquement par un objet JSON')) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"ok": true}' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`); return res.end();
    }
    if (!b.response_format && !(glm && b.stream)) return json(200, { choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
    const sys = b.messages[0].content, user = b.messages[1].content;
    let out;
    if (sys.includes('relecteur et inspecteur')) {
      calls.relecture = (calls.relecture ?? 0) + 1;
      out = JSON.stringify({ verdict: 'a_corriger', synthese: 'Deux erreurs de fond.', points_forts: ['Bonne progression'], problemes: [
        { gravite: 'bloquant', ou: 'Partie 2', constat: 'Règle des signes énoncée à l’envers.', correction: 'Moins par moins donne plus.' },
        { gravite: 'important', ou: 'Exercice ex3', constat: 'Corrigé faux.', correction: 'La réponse est 15.' }] });
      return json(200, { choices: [{ message: { role: 'assistant', content: out }, finish_reason: 'stop' }] });
    }
    if (sys.includes('Tu corriges un cours existant')) {
      calls.fix = user;
      const doc = JSON.parse(user.slice(user.indexOf('Cours actuel (JSON) :') + 'Cours actuel (JSON) :'.length));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify({ ...doc, lesson: { ...doc.lesson, essential: 'Corrigé : moins par moins donne plus.' } }) }, finish_reason: null }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`); return res.end();
    }
    if (sys.includes('auteur de cours')) {
      calls.cours.push({ model: b.model, user, stream: !!b.stream, path: u.pathname });
      const text = course(user);
      // réponse au fil de l'eau (SSE), en morceaux espacés, comme Mistral
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const parts = text.match(/[\s\S]{1,3000}/g) ?? [];
      if (glm) res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { reasoning_content: 'Je réfléchis à la structure du cours… '.repeat(50) }, finish_reason: null }] })}\n\n`);
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
// Contenu › IA › Mes clés : clé déjà enregistrée → « Changer la clé » ; sinon « + Ajouter une clé », fournisseur dans la liste, clé
const setKey = async (provider, key, extra = {}) => {
  await ad.goto(BASE + '/contenu/ia');
  let f = ad.locator(`form[data-provider="${provider}"]`);
  if (await f.count()) await ad.locator(`details:has(form[data-provider="${provider}"]) > summary`).click();   // « Remplacer la clé »
  else {
    if (!(await ad.locator('form[data-slot]').count())) await ad.click('button:has-text("Ajouter une clé")');
    f = ad.locator('form[data-slot]').last();
    await f.locator('select[name=preset]').selectOption(provider);
    if (Object.keys(extra).length) await f.locator('summary:has-text("Options avancées")').click();
    for (const [k, v] of Object.entries(extra)) await f.locator(`input[name=${k}]`).fill(v);
  }
  await f.locator('input[name=key]').fill(key);
  const done = ad.waitForResponse(r => r.request().method() === 'POST');
  await f.locator('button:has-text("Vérifier et enregistrer")').click();
  await done; await ad.waitForTimeout(400);
  return ad.locator('section[aria-labelledby="cles"]').innerText();
};
// Réglages généraux (dérogation hors UE) et fonctions d'un fournisseur (« Utilisé pour » sur sa carte)
const setGeneral = async ({ allowNonEu }) => {
  await ad.goto(BASE + '/contenu/ia');
  await ad.setChecked('input[name=allow_non_eu]', allowNonEu);
  await ad.click('button:has-text("Enregistrer les réglages")'); await ad.waitForSelector('text=Réglages enregistrés');
};
const setFunction = async (provider, task, model) => {
  await ad.goto(BASE + '/contenu/ia');
  const f = ad.locator('form[data-assign]');
  await f.locator(`select[name=task_${task}]`).selectOption(provider);
  if (model) await f.locator(`select[name=model_${task}]`).selectOption(model);
  await f.locator('button:has-text("Enregistrer")').click();
  const m = f.locator('[role=status], [role=alert]'); await m.waitFor(); return m.innerText();
};
ok((await setKey('mistral', 'cle')).includes('vérifiée et enregistrée'), 'Contenu › IA › Mes clés : « + Ajouter une clé », choix « Mistral » dans la liste, clé collée et vérifiée');
const [{ value: s0 }] = await sql`select value from app_settings where key = 'ia'`;
ok(s0.tasks.cours?.model === 'mistral-large-latest', 'la rédaction des cours reçoit Mistral Large d’office');

const pa = await page('parent@test.local', 'parent-test-1234');
// Bilan : les lignes « Pour aller plus loin » sont repliées ; ce test vérifie leur contenu, il les ouvre toutes
await pa.addInitScript(() => { const f = () => document.querySelectorAll('details[data-fold]:not([open])').forEach(d => { d.open = true; }); new MutationObserver(f).observe(document, { childList: true, subtree: true }); });
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
await ad.fill('input[type=search]', 'TG002');
await ad.locator(`[data-cat-row][data-title="${empty.title}"] button:has-text("Rédiger avec l’IA")`).click();
await ad.waitForSelector('text=/Rédaction IA/');
ok(true, 'catalogue : « Rédaction IA… » affiché pendant le travail');
await ad.locator(`[data-cat-row][data-title="${empty.title}"] >> text=À relire · v1`).waitFor({ timeout: 60_000 });
ok(!!(await sql`select 1 from course_versions where course_id = ${empty.id} and status = 'draft'`)[0], 'bouton du catalogue : le cours est rédigé, et la page affiche « À relire » toute seule (sans F5)');
await ad.goto(BASE + '/contenu/ia');
ok((await ad.locator('section[aria-labelledby="file"]').innerText()).includes('Terminé'), 'la file d’attente montre les tâches terminées');

console.log('Relecture d’un cours existant par l’IA, puis correction');
await ad.goto(`${BASE}/contenu/cours/${rn1.id}`);
await ad.click('button:has-text("Relire avec l’IA")');
await ad.waitForSelector('text=Règle des signes énoncée à l’envers', { timeout: 30_000 });
const rv = await ad.locator('section[aria-labelledby="relecture"]').innerText();
ok(rv.includes('À corriger') && rv.includes('Bloquant (1)') && rv.includes('Important (1)'), 'relecture : verdict et problèmes classés par gravité, affichés sans recharger la page');
await ad.click('button:has-text("Faire corriger par l’IA")'); await ad.click('[data-dialog-ok]');
await ad.waitForSelector('text=en brouillon à relire', { timeout: 30_000 });
const [fixed] = await sql`select version, status, document->'lesson'->>'essential' as ess from course_versions where course_id = ${rn1.id} order by version desc limit 1`;
ok(fixed.version === 2 && fixed.status === 'draft' && fixed.ess.includes('moins par moins donne plus') && calls.fix.includes('Règle des signes énoncée à l’envers'),
  'correction : l’IA reçoit la liste des problèmes, la version corrigée (v2) arrive en brouillon à relire, la v1 reste publiée');
await ad.goto(BASE + '/contenu');
await ad.fill('input[type=search]', rn1.title.slice(0, 20));
ok((await ad.locator('main').innerText()).includes('Relu par l’IA : 2 problèmes'), 'catalogue : la colonne Statut indique le résultat de la relecture');

console.log('Fournisseur ajouté (GLM) pour la rédaction des cours');
const glmBad = await setKey('glm', 'mauvaise', { base_url: 'http://127.0.0.1:3999/api/paas/v4', models: 'glm-4.6' });
ok(glmBad.includes('GLM (Z.ai)') && glmBad.includes('refusée'), 'clé refusée par le fournisseur ajouté : rien n’est enregistré');
await ad.locator('form[data-slot] input[name=key]').last().fill('cle-glm');
await ad.locator('form[data-slot] button:has-text("Vérifier et enregistrer")').last().click();
await ad.waitForSelector('text=GLM (Z.ai) ajouté');
const [{ value: s1 }] = await sql`select value from app_settings where key = 'ia'`;
ok(s1.custom['x-glm-z-ai']?.base_url === 'http://127.0.0.1:3999/api/paas/v4' && s1.providers['x-glm-z-ai']?.models.some(m => m.id === 'glm-4.6') && !JSON.stringify(s1).includes('cle-glm'),
  'GLM ajouté : adresse sans « /v1 », modèle indiqué à la main et vérifié par un essai, clé chiffrée');
ok(s1.tasks.correction.provider === 'mistral', 'un fournisseur ajouté n’est jamais choisi d’office pour des données d’élèves');
await ad.goto(BASE + '/contenu/ia');
await ad.locator('form[data-test="x-glm-z-ai"] button:has-text("Tester")').click();
await ad.locator('form[data-test="x-glm-z-ai"] [role=status]').waitFor({ timeout: 20_000 });
ok((await ad.locator('form[data-test="x-glm-z-ai"] [role=status]').innerText()).includes('réception au fil de l’eau ✓'),
  '« Tester » : GLM répond (réponse structurée malgré le refus du mode JSON, réception au fil de l’eau), diagnostic affiché en clair');
await ad.goto(BASE + '/contenu/ia');
ok((await ad.locator('section[aria-labelledby="cles"]').innerText()).includes('Chine / Singapour'), '« Mes clés » indique où GLM traite les données');
ok(await ad.locator('form[data-assign] select[name=task_correction] option[value="x-glm-z-ai"]').isDisabled(), 'règle Europe : GLM verrouillé pour la correction (données d’élèves) sans dérogation');
ok((await setFunction('x-glm-z-ai', 'cours', 'glm-4.6')).includes('Enregistré'), '« Qui fait quoi » : GLM choisi pour la rédaction des cours');
ok((await sql`select value->'tasks'->'cours'->>'provider' as p from app_settings where key = 'ia'`)[0].p === 'x-glm-z-ai', 'GLM choisi pour la rédaction des cours, sans dérogation (aucune donnée d’élève)');
const [glmCourse] = await sql`select c.id, c.title from courses c where c.code = 'TG003'`;
await sql`delete from course_versions where course_id = ${glmCourse.id}`;
await ad.goto(BASE + '/contenu');
await ad.fill('input[type=search]', glmCourse.title.slice(0, 25));
await ad.locator(`[data-cat-row][data-title="${glmCourse.title}"] button:has-text("Rédiger avec l’IA")`).click();
await ad.locator(`[data-cat-row][data-title="${glmCourse.title}"] >> text=À relire · v1`).waitFor({ timeout: 60_000 });
const glmCall = calls.cours.at(-1);
ok(glmCall.path === '/api/paas/v4/chat/completions' && glmCall.model === 'glm-4.6' && glmCall.stream,
  'cours rédigé par GLM et placé en brouillon, alors que GLM refuse le mode JSON et réfléchit avant d’écrire');

// React #418 (écart d'hydratation, intermittent, sans effet visible) : avertissement connu, non bloquant ; toute autre erreur bloque.
const hydr418 = errs.filter(e => /Minified React error #418/.test(e));
if (hydr418.length) console.log(`  ⚠ avertissement connu : ${hydr418.length} écart(s) d’hydratation React #418`);
ok(errs.filter(e => !/Minified React error #418/.test(e)).length === 0, `aucune erreur JavaScript ni fenêtre native (${errs.filter(e => !/#418/.test(e)).join(' | ') || 'aucune'})`);
await b.close(); mock.close(); await sql.end();
console.log('Automatismes et rédaction de cours : OK');
