// IA de correction branchée : réglage de la clé (Claude puis Gemini), correction en un clic, validation groupée.
// Les fournisseurs sont simulés par un faux serveur local (port 3999) : le serveur testé doit être lancé avec
//   AI_GEMINI_BASE_URL=http://127.0.0.1:3999 AI_ANTHROPIC_BASE_URL=http://127.0.0.1:3999
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
      else await el.locator(`[aria-label="Ta réponse à ${q.id}"]`).fill(q.type === 'open' ? `Ma réponse rédigée (${q.id}).` : String(q.type === 'numeric' ? q.answer : q.answer[0]));
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

// ── réglage de l'IA : Claude
console.log('Réglage : Claude');
const ad = await page('admin@test.local', 'admin-test-1234');
await ad.goto(BASE + '/contenu/ia');
await ad.fill('input[name=key]', 'sk-ant-mauvaise'); await ad.click('button:has-text("Vérifier et enregistrer")');
await ad.waitForSelector('text=Clé refusée par Anthropic');
ok((await sql`select count(*)::int as n from app_settings`)[0].n === 0, 'clé refusée par le fournisseur : rien n’est enregistré');
await ad.fill('input[name=key]', 'sk-ant-test'); await ad.selectOption('select[name=model]', 'claude-opus-5-5'); await ad.click('button:has-text("Vérifier et enregistrer")');
await ad.waitForSelector('text=La correction par IA est active');
const [{ value: v1 }] = await sql`select value from app_settings where key = 'ia_correction'`;
ok(v1.provider === 'claude' && v1.model === 'claude-opus-5-5' && !JSON.stringify(v1).includes('sk-ant-test') && v1.key_hint === '…test', 'clé vérifiée, enregistrée chiffrée (jamais en clair en base)');

console.log('Correction de la copie 1 (Claude, sélection)');
await pa.goto(BASE + '/parent/a-faire');
await pa.locator(`input[data-bulk="bulk-copies"][value="${ids[0]}"]`).check();
await pa.click('button:has-text("Corriger la sélection avec l’IA")');
await pa.waitForSelector('text=1 copie corrigée par l’IA');
const c1 = calls.find(c => c.provider === 'claude');
ok(c1 && c1.body.model === 'claude-opus-5-5' && c1.body.output_config?.format?.type === 'json_schema' && /server-side-fallback/.test(c1.beta ?? '') && c1.body.fallbacks === 'default', 'appel Claude : modèle choisi, réponse structurée, repli automatique activé');
ok(!JSON.stringify(c1.body).includes('Léa'), 'aucun nom d’élève envoyé au fournisseur');
const [p1] = await sql`select proposal from eval_attempts where id = ${ids[0]}`;
ok(p1.proposal && p1.proposal.general?.comment === 'Bon travail, continue.', 'propositions enregistrées sur la copie 1');

// ── réglage de l'IA : Gemini
console.log('Réglage : Gemini');
await ad.goto(BASE + '/contenu/ia');
await ad.check('input[name=provider][value=gemini]');
await ad.fill('input[name=key]', 'cle-gemini-test'); await ad.click('button:has-text("Vérifier et enregistrer")');
await ad.waitForSelector('text=La correction par IA est active');
const [{ value: v2 }] = await sql`select value from app_settings where key = 'ia_correction'`;
ok(v2.provider === 'gemini' && v2.model === 'gemini-9.1-flash', 'Gemini : le plus récent « Flash » qui répond vraiment est choisi (le modèle retiré, qui répond 404, est écarté)');
ok(await ad.isChecked('input[name=provider][value=gemini]') && !(await ad.isChecked('input[name=provider][value=claude]')), 'après l’enregistrement, le choix « Gemini » reste coché');
ok(await ad.locator('select[name=model] option').count() === 3, 'les modèles non adaptés (embeddings…) sont écartés de la liste');
await ad.selectOption('select[name=model]', 'gemini-1.5-flash'); await ad.click('button:has-text("Vérifier et enregistrer")');
await ad.waitForSelector('text=n’est plus disponible chez Google');
ok((await sql`select value->>'model' as m from app_settings`)[0].m === 'gemini-9.1-flash', 'modèle choisi à la main mais retiré par Google : un modèle qui marche le remplace, avec un message');
await ad.reload(); ok(await ad.isChecked('input[name=provider][value=gemini]'), 'au rechargement de la page, « Gemini » est coché');

await sql`update app_settings set value = jsonb_set(value, '{model}', '"gemini-9.9-flash"') where key = 'ia_correction'`;   // Google retire le modèle entre-temps
console.log('Correction de la copie 2 (Gemini, bouton)');
await pa.goto(BASE + '/parent/a-faire');
await pa.click('button:has-text("Corriger avec l’IA (1)")');
await pa.waitForSelector('text=1 copie corrigée par l’IA');
ok(calls.some(c => c.provider === 'gemini' && c.body.systemInstruction && c.path.includes('gemini-9.1-flash')), 'modèle retiré entre-temps : la correction passe seule sur un modèle qui répond');
ok((await sql`select value->>'model' as m from app_settings`)[0].m === 'gemini-9.1-flash' && await pa.locator('text=passage automatique à gemini-9.1-flash').count() === 1, 'le nouveau modèle est enregistré et le parent en est informé');

console.log('Validation groupée');
await pa.locator('label:has-text("Tout sélectionner") input').first().check();
await pa.click('button:has-text("Valider les notes proposées")');
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
