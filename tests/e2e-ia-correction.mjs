// IA de correction : clés par fournisseur, une IA par tâche, règle « données d'élèves en Europe », consentement du parent,
// nettoyage des réponses (ni nom ni coordonnées), journal des envois, correction en un clic, validation groupée.
// Les fournisseurs sont simulés par un faux serveur local (port 3999) : le serveur testé doit être lancé avec
//   AI_GEMINI_BASE_URL=http://127.0.0.1:3999 AI_ANTHROPIC_BASE_URL=http://127.0.0.1:3999 AI_MISTRAL_BASE_URL=http://127.0.0.1:3999
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-ia-correction.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

// ── faux fournisseurs : chaque question rédigée reçoit la moitié des points
const calls = [];
const grade = text => { const copy = JSON.parse(text.slice(text.indexOf('{'))); return { commentaire_general: 'Bon travail, continue.', questions: copy.questions.map(q => ({ id: q.id, points: q.points_max / 2, commentaire: `Commentaire ${q.id}.` })) }; };
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/v1/models/')) {                       // Anthropic : vérification de la clé
      if ((req.headers['x-api-key'] ?? (req.headers.authorization ?? '').replace(/^Bearer /, '')) !== 'sk-ant-test') return json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      return json(200, { type: 'model', id: u.pathname.split('/').pop(), display_name: 'Claude', created_at: '2026-01-01T00:00:00Z' });
    }
    if (u.pathname === '/v1/messages') {                               // Anthropic : correction
      const b = JSON.parse(body); calls.push({ provider: 'claude', body: b, beta: req.headers['anthropic-beta'] });
      return json(200, { id: 'msg_test', type: 'message', role: 'assistant', model: b.model, stop_reason: 'end_turn', stop_sequence: null,
        content: [{ type: 'text', text: JSON.stringify(grade(b.messages[0].content)) }], usage: { input_tokens: 10, output_tokens: 10 } });
    }
    if (u.pathname === '/v1/models') {                                 // Mistral : liste des modèles
      if (req.headers.authorization !== 'Bearer cle-mistral') return json(401, { message: 'Unauthorized' });
      return json(200, { object: 'list', data: [
        { id: 'mistral-large-latest', capabilities: { completion_chat: true } }, { id: 'mistral-large-2411', capabilities: { completion_chat: true } },
        { id: 'mistral-small-latest', capabilities: { completion_chat: true } }, { id: 'mistral-embed', capabilities: { completion_chat: false } },
        { id: 'mistral-old', capabilities: { completion_chat: true }, deprecation: '2025-01-01T00:00:00Z' }] });
    }
    if (u.pathname === '/v1/chat/completions') {                       // Mistral : correction (ou essai du modèle)
      const b = JSON.parse(body);
      if (!b.response_format) return json(200, { choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }] });
      calls.push({ provider: 'mistral', body: b });
      return json(200, { id: 'x', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(grade(b.messages[1].content)) }, finish_reason: 'stop' }] });
    }
    if (u.pathname === '/v1beta/models' && req.method === 'GET') {     // Gemini : liste des modèles
      if (req.headers['x-goog-api-key'] !== 'cle-gemini-test') return json(400, { error: { message: 'API key not valid' } });
      return json(200, { models: [{ name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-9.9-flash', displayName: 'Gemini 9.9 Flash (retiré)', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-9.1-flash', displayName: 'Gemini 9.1 Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-test', supportedGenerationMethods: ['embedContent'] }] });
    }
    if (/^\/v1beta\/models\/.+:generateContent$/.test(u.pathname)) {    // Gemini : correction
      if (/gemini-9\.9-flash|gemini-1\.5-flash/.test(u.pathname)) return json(404, { error: { message: 'models/x is not found for API version v1beta' } });
      const b = JSON.parse(body);
      if (!b.systemInstruction) return json(200, { candidates: [{ content: { parts: [{ text: 'OK' }] } }] });   // essai du modèle
      calls.push({ provider: 'gemini', body: b, path: u.pathname });
      return json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(grade(b.contents[0].parts[0].text)) }] }, finishReason: 'STOP' }] });
    }
    json(404, { error: 'inconnu' });
  });
}).listen(3999);

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"eval_requires_approval": false}'::jsonb`;
await sql`update student_years set level_code = 'troisieme-generale'`;
const course = async code => (await sql`select c.id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = ${code}`)[0];

const b = await chromium.launch();
const errs = [];
const page = async (l, pw, mobile) => { const p = await (await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 800 } })).newPage();
  p.on('pageerror', e => errs.push(`${p.url()} : ${e.message.slice(0, 80)}`)); p.on('dialog', d => d.accept());
  await p.route('**/api/activity', r => r.fulfill({ status: 200, body: '{}' }));
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw); await p.click('button[type=submit]');
  await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };

// ── l'élève remet deux copies (réponses rédigées comprises)
console.log('Deux copies remises');
const el = await page('lea', 'lea-test-1234', true);
const expected = {};
for (const code of ['TG001', 'TG034']) {
  const c = await course(code);
  await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, exercises_score) values (${st.id}, ${c.id}, now(), now(), 9)
    on conflict (student_id, course_id) do update set lesson_done_at = now(), exercises_done_at = now(), exercises_score = 9`;
  await el.goto(`${BASE}/eleve/cours/${c.id}/evaluation`); await el.click('button:has-text("Commencer")'); await el.waitForSelector('[role=timer]');
  const [att] = await sql`select id, variant from eval_attempts where student_id = ${st.id} and course_id = ${c.id} order by attempt_no desc limit 1`;
  const variant = c.doc.evaluation.variants[att.variant];
  for (const s of variant.sections) {
    await el.click(`[role=tab]:has-text("${s.label.split(' (')[0].slice(0, 30)}")`);
    for (const q of s.questions) {
      if (q.type === 'qcm') await el.locator(`input[name="${q.id}"][value="${q.answer}"]`).check();
      else await el.locator(`[aria-label="Ta réponse à ${q.id}"]`).fill(q.type === 'open' ? `Ma réponse rédigée (${q.id}). Signé Léa, lea.dupont@exemple.fr, 06 12 34 56 78, 12 rue des Lilas.` : String(q.type === 'numeric' ? q.answer : q.answer[0]));
    }
  }
  await el.click('text=Remettre ma copie'); await el.click('button:has-text("Oui, remettre")'); await el.waitForURL(/bilan/);
  const qs = variant.sections.flatMap(s => s.questions);
  expected[att.id] = qs.filter(q => q.type !== 'open').reduce((n, q) => n + q.points, 0) + qs.filter(q => q.type === 'open').reduce((n, q) => n + q.points / 2, 0);
}
const ids = Object.keys(expected);
ok((await sql`select count(*)::int as n from eval_attempts where status = 'submitted'`)[0].n === 2, 'deux copies en attente de correction');

const pa = await page('parent@test.local', 'parent-test-1234');
await pa.goto(BASE + '/parent/a-faire');
ok(await pa.locator('button:has-text("Corriger avec l’IA")').count() === 0, 'sans IA configurée : pas de bouton « Corriger avec l’IA »');

// ── réglages de l'IA (espace Contenu)
const ad = await page('admin@test.local', 'admin-test-1234');
const setKey = async (provider, key) => {
  await ad.goto(BASE + '/contenu/ia');
  const f = ad.locator(`form[data-provider="${provider}"]`);
  await f.locator('input[name=key]').fill(key); await f.locator('button:has-text("Vérifier et enregistrer")').click();
  await f.locator('[role=status], [role=alert]').waitFor(); return f.locator('[role=status], [role=alert]').innerText();
};
const setTasks = async (o) => {
  await ad.goto(BASE + '/contenu/ia');
  for (const [t, v] of Object.entries(o.tasks ?? {})) await ad.selectOption(`select[name=task_${t}]`, v);
  if (o.allowNonEu !== undefined) await ad.setChecked('input[name=allow_non_eu]', o.allowNonEu);
  await ad.click('button:has-text("Enregistrer les réglages")');
  const m = ad.locator('section[aria-labelledby="taches"] [role=status], section[aria-labelledby="taches"] [role=alert]');
  await m.waitFor(); return m.innerText();
};
const settings = async () => (await sql`select value from app_settings where key = 'ia'`)[0]?.value;

console.log('Reprise de l’ancien réglage (une seule IA, Gemini)');
await sql`insert into app_settings (key, value) values ('ia_correction', ${sql.json({ provider: 'gemini', model: 'gemini-9.1-flash', key_sealed: 'x.y.z', key_hint: '…old', enabled: true })})`;
await ad.goto(BASE + '/contenu/ia');
ok((await ad.locator('section[aria-label="État"]').innerText()).includes('(bloqué)'), 'ancien réglage Gemini repris, mais bloqué par la règle Europe (pas de dérogation implicite)');

console.log('Clés et règle « Europe »');
ok((await setKey('claude', 'sk-ant-mauvaise')).includes('Clé refusée par Anthropic') && !(await settings())?.providers?.claude, 'clé refusée par le fournisseur : rien n’est enregistré');
ok((await setKey('claude', 'sk-ant-test')).includes('vérifiée et enregistrée'), 'clé Claude vérifiée et enregistrée');
let v = await settings();
ok(!JSON.stringify(v).includes('sk-ant-test') && v.providers.claude.key_hint === '…test', 'clé enregistrée chiffrée (jamais en clair en base)');
ok(v.tasks.correction?.provider === 'gemini', 'Claude (hors UE) n’est pas choisi d’office pour des données d’élèves');
ok((await setTasks({ tasks: { correction: 'claude::claude-opus-5-5' } })).includes('traite les données aux États-Unis'), 'règle Europe : Claude refusé pour la correction sans dérogation');
ok((await setKey('mistral', 'cle-mistral')).includes('2 modèles'), 'clé Mistral vérifiée : modèles de conversation seulement (ni embeddings, ni modèles retirés, un par famille)');
v = await settings();
ok(v.tasks.correction?.provider === 'mistral' && v.tasks.correction.model === 'mistral-small-latest' && v.tasks.bilan?.model === 'mistral-large-latest',
  'Mistral (Europe) remplace d’office l’ancien Gemini bloqué : « small » pour les corrections, « large » pour les bilans');
await sql`delete from app_settings where key = 'ia_correction'`;

console.log('Consentement du parent');
await pa.goto(BASE + '/parent/a-faire');
await pa.click('button:has-text("Corriger avec l’IA (2)")');
await pa.waitForSelector('text=correction par l’IA non autorisée');
ok(calls.length === 0 && (await sql`select count(*)::int as n from ai_requests`)[0].n === 0, 'sans l’accord du parent : rien n’est envoyé à l’IA');
await pa.goto(BASE + '/parent/bilan#confidentialite');
await pa.check('input[name=ai_correction]'); await pa.click('button:has-text("Enregistrer mes choix")');
await pa.waitForSelector('text=Choix enregistrés pour Léa');
ok((await sql`select settings->>'ai_correction' as c from students where id = ${st.id}`)[0].c === 'true', 'le parent autorise la correction par l’IA pour Léa');

console.log('Correction de la copie 1 (Mistral, sélection)');
await pa.goto(BASE + '/parent/a-faire');
await pa.locator(`input[data-bulk="bulk-copies"][value="${ids[0]}"]`).check();
await pa.click('button:has-text("Corriger la sélection avec l’IA")');
await pa.waitForSelector('text=1 copie corrigée par l’IA');
const c1 = calls.find(c => c.provider === 'mistral');
ok(c1 && c1.body.model === 'mistral-small-latest' && c1.body.response_format?.type === 'json_object' && c1.body.messages[0].role === 'system', 'appel Mistral : modèle choisi, réponse JSON demandée');
const sentText = JSON.stringify(c1.body);
ok(!/Léa|lea\.dupont|06 12 34 56 78|rue des Lilas/i.test(sentText) && sentText.includes('[prénom]') && sentText.includes('[e-mail]') && sentText.includes('[téléphone]') && sentText.includes('[adresse]'),
  'réponses nettoyées avant l’envoi : prénom, e-mail, téléphone et adresse masqués');
const [p1] = await sql`select proposal from eval_attempts where id = ${ids[0]}`;
ok(p1.proposal && p1.proposal.general?.comment === 'Bon travail, continue.', 'propositions enregistrées sur la copie 1');
const [log] = await sql`select provider, eu, payload, student_id from ai_requests order by id limit 1`;
ok(log.provider === 'mistral' && log.eu === true && log.student_id === st.id && log.payload.includes('[prénom]'), 'envoi consigné dans le journal (fournisseur, Europe, contenu exact)');
await pa.goto(BASE + '/parent/bilan');
const journal = await pa.locator('section[aria-labelledby="rgpd"]').innerText();
ok(journal.includes('Correction') && journal.includes('Mistral') && journal.includes('(UE)'), 'le parent voit ce qui a été envoyé, chez qui');

console.log('Dérogation hors UE : Gemini');
ok((await setKey('gemini', 'cle-gemini-test')).includes('vérifiée'), 'clé Gemini vérifiée');
ok((await settings()).tasks.correction.provider === 'mistral', 'une clé hors UE ne remplace pas l’IA européenne déjà choisie');
const msg = await setTasks({ tasks: { correction: 'gemini::gemini-1.5-flash' }, allowNonEu: true });
v = await settings();
ok(v.allow_non_eu && v.tasks.correction.provider === 'gemini' && v.tasks.correction.model === 'gemini-9.1-flash' && msg.includes('n’est plus disponible'),
  'dérogation accordée : Gemini choisi ; modèle retiré par Google (404) remplacé par un modèle qui répond, avec un message');
ok(await ad.locator('select[name=task_correction]').inputValue() === 'gemini::gemini-9.1-flash' && await ad.isChecked('input[name=allow_non_eu]'), 'après l’enregistrement, les choix restent affichés');
await sql`update app_settings set value = jsonb_set(value, '{tasks,correction,model}', '"gemini-9.9-flash"') where key = 'ia'`;   // Google retire le modèle entre-temps

console.log('Correction de la copie 2 (Gemini, bouton)');
await pa.goto(BASE + '/parent/a-faire');
await pa.click('button:has-text("Corriger avec l’IA (1)")');
await pa.waitForSelector('text=1 copie corrigée par l’IA');
ok(calls.some(c => c.provider === 'gemini' && c.body.systemInstruction && c.path.includes('gemini-9.1-flash')), 'modèle retiré entre-temps : la correction passe seule sur un modèle qui répond');
ok((await settings()).tasks.correction.model === 'gemini-9.1-flash' && await pa.locator('text=passage automatique à gemini-9.1-flash').count() === 1, 'le nouveau modèle est enregistré et le parent en est informé');
ok((await sql`select eu from ai_requests order by id desc limit 1`)[0].eu === false, 'l’envoi hors UE est consigné comme tel');

console.log('Validation groupée');
await pa.locator('label:has-text("Tout sélectionner") input').first().check();
await pa.click('button:has-text("Valider les notes proposées")');
await pa.click('[data-dialog-ok]');   // fenêtre de confirmation de l’application
await pa.waitForSelector('text=2 notes validées');
const graded = await sql`select id, status, final_score, feedback from eval_attempts where id in ${sql(ids)}`;
ok(graded.every(g => g.status === 'graded' && Math.abs(Number(g.final_score) - expected[g.id]) < 0.01 && g.feedback.general === 'Bon travail, continue.'),
  `notes validées : ${graded.map(g => `${Number(g.final_score)}/20`).join(', ')} (attendu ${ids.map(i => `${expected[i]}/20`).join(', ')})`);
await el.goto(`${BASE}/eleve/cours/${(await course('TG001')).id}/bilan/${ids[0]}`);
await el.waitForSelector('text=Ce que tu sais faire maintenant');
ok((await el.textContent('main')).includes('Bon travail, continue.'), 'l’élève voit sa note et le commentaire');

ok(errs.length === 0, `aucune erreur JavaScript (${errs.join(' | ') || 'aucune'})`);
await b.close(); mock.close(); await sql.end();
console.log('IA de correction : OK');
