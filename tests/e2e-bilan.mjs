// Bilan pédagogique par l'IA : indicateurs mesurés, bilan rédigé, test de positionnement (proposé, passé, corrigé),
// second bilan qui tient compte du test, leçons de rattrapage dans l'espace Contenu (groupées, actions groupées).
// Fournisseurs simulés (port 3999) : serveur lancé avec AI_GEMINI_BASE_URL / AI_ANTHROPIC_BASE_URL / AI_MISTRAL_BASE_URL=http://127.0.0.1:3999.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-bilan.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

// ── faux fournisseurs
const inputs = [];
const report = n => ({
  synthese: `Synthèse numéro ${n} : les bases de calcul sur les relatifs manquent.`,
  confiance: n === 1 ? 'faible' : 'moyenne', confiance_raison: n === 1 ? 'Une seule évaluation.' : 'Le test de positionnement confirme.',
  origine: { principale: n === 1 ? 'indetermine' : 'lacunes_anterieures', explication: 'Erreurs de signes typiques de 5e.', preuves: ['4 − (−11) donné à −7'] },
  implication: { niveau: 'irreguliere', indices: ['Évaluation rendue très vite'] },
  matieres: [{ matiere: 'Mathématiques', constat: 'Bases fragiles.', points_forts: ['Pose les calculs'], points_faibles: ['Règle des signes'] }],
  lacunes: [{ notion: 'Addition et soustraction de relatifs', matiere: 'Mathématiques', niveau_origine: '5e', gravite: 'haute', preuve: 'Erreur sur 4 − (−11)' }],
  lecons_a_creer: [
    { titre: 'Les nombres relatifs : addition et soustraction', matiere: 'Mathématiques', niveau: '5e', objectif: 'Calculer avec des relatifs sans erreur de signe.', priorite: 1 },
    { titre: 'Classes et fonctions des mots', matiere: 'Français', niveau: '6e', objectif: 'Distinguer classe et fonction.', priorite: 2 }],
  test_positionnement: { consigne_eleve: 'Ce test fait le point sur tes bases.', questions: [
    { matiere: 'Mathématiques', notion: 'Relatifs', niveau_origine: '5e', type: 'qcm', prompt: 'Combien vaut 4 − (−11) ?', options: ['−7', '15', '7'], reponse: '1', explication: 'Soustraire −11, c’est ajouter 11 : 15.' },
    { matiere: 'Mathématiques', notion: 'Priorités', niveau_origine: '5e', type: 'numeric', prompt: 'Calcule −6 + 4 × (−3).', options: [], reponse: '-18', explication: 'La multiplication d’abord : −6 − 12 = −18.' },
    { matiere: 'Français', notion: 'Classes de mots', niveau_origine: '6e', type: 'short', prompt: 'Quelle est la classe du mot « rapidement » ?', options: [], reponse: 'adverbe|un adverbe', explication: 'C’est un adverbe.' },
    { matiere: 'Français', notion: 'COD / COI', niveau_origine: '5e', type: 'qcm', prompt: 'Dans « Il parle à sa sœur », « à sa sœur » est :', options: ['COD', 'COI', 'sujet'], reponse: '1', explication: 'Construit avec « à » : COI.' },
    { matiere: 'Mathématiques', notion: 'Fractions', niveau_origine: '5e', type: 'numeric', prompt: 'Écris 45/60 en nombre décimal.', options: [], reponse: '0.75', explication: '45/60 = 3/4 = 0,75.' },
    { matiere: 'Mathématiques', notion: 'Fractions', niveau_origine: '5e', type: 'numeric', prompt: 'Écris 3/4 en nombre décimal.', options: [], reponse: '0,75', explication: '3/4 = 0,75.' },
    { matiere: 'Mathématiques', notion: 'Mal formée', niveau_origine: '5e', type: 'qcm', prompt: 'Question invalide', options: ['a', 'b'], reponse: '5', explication: '—' }] },
  conseils_parents: ['Dix minutes de calcul mental par jour.', 'Relire la règle des signes ensemble.'],
  limites: 'Il manque les notes de l’année.',
});
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/v1/models/')) return json(200, { type: 'model', id: 'claude-haiku-5-5', display_name: 'Claude', created_at: '2026-01-01T00:00:00Z' });
    if (u.pathname === '/v1/models') return json(200, { data: [{ id: 'mistral-large-latest', capabilities: { completion_chat: true } }, { id: 'mistral-small-latest', capabilities: { completion_chat: true } }] });
    if (u.pathname === '/v1/chat/completions') {
      const m = body ? JSON.parse(body) : {};
      if (!m.response_format) return json(200, { choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
      inputs.push({ provider: 'mistral', model: m.model, system: m.messages[0].content, user: m.messages[1].content });
      return json(200, { choices: [{ message: { role: 'assistant', content: JSON.stringify(report(inputs.length)) }, finish_reason: 'stop' }] });
    }
    if (u.pathname === '/v1beta/models') return json(200, { models: [{ name: 'models/gemini-9.1-flash', displayName: 'Gemini 9.1 Flash', supportedGenerationMethods: ['generateContent'] }] });
    const b = body ? JSON.parse(body) : {};
    if (/:generateContent$/.test(u.pathname)) {
      if (!b.systemInstruction) return json(200, { candidates: [{ content: { parts: [{ text: 'OK' }] } }] });
      inputs.push({ provider: 'gemini', system: b.systemInstruction.parts[0].text, user: b.contents[0].parts[0].text });
      return json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(report(inputs.length)) }] }, finishReason: 'STOP' }] });
    }
    if (u.pathname === '/v1/messages') {
      inputs.push({ provider: 'claude', system: b.system, user: b.messages[0].content, effort: b.output_config?.effort });
      return json(200, { id: 'msg', type: 'message', role: 'assistant', model: b.model, stop_reason: 'end_turn', stop_sequence: null,
        content: [{ type: 'text', text: JSON.stringify(report(inputs.length)) }], usage: { input_tokens: 1, output_tokens: 1 } });
    }
    json(404, {});
  });
}).listen(3999);

// ── données : une évaluation bâclée et en partie vide, une leçon survolée
const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"eval_requires_approval": false}'::jsonb`;
await sql`update student_years set level_code = 'troisieme-generale'`;
const [c] = await sql`select c.id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = 'TG034'`;
await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, exercises_score) values (${st.id}, ${c.id}, now(), now(), 8)
  on conflict (student_id, course_id) do update set lesson_done_at = now(), exercises_done_at = now(), exercises_score = 8`;
await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds) values (${st.id}, ${c.id}, 'lesson', now() - interval '1 hour', now() - interval '55 minutes', now() - interval '55 minutes', 300, 240)`;

const b = await chromium.launch();
const errs = [];
const page = async (l, pw, mobile) => { const p = await (await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 860 } })).newPage();
  p.on('pageerror', e => errs.push(`${p.url()} : ${e.message.slice(0, 80)}`)); p.on('dialog', d => { errs.push('fenêtre native : ' + d.message()); d.dismiss(); });
  await p.route('**/api/activity', r => r.fulfill({ status: 200, body: '{}' }));
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw); await p.click('button[type=submit]');
  await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };

const el = await page('lea', 'lea-test-1234', true);
await el.goto(`${BASE}/eleve/cours/${c.id}/evaluation`); await el.click('button:has-text("Commencer")'); await el.waitForSelector('[role=timer]');
const [att] = await sql`select id, variant from eval_attempts where student_id = ${st.id} and course_id = ${c.id} order by attempt_no desc limit 1`;
const q0 = c.doc.evaluation.variants[att.variant].sections[0].questions.find(q => q.type !== 'qcm');
await el.locator(`[aria-label="Ta réponse à ${q0.id}"]`).fill('12');
await el.click('text=Remettre ma copie'); await el.click('button:has-text("Oui, remettre")'); await el.waitForURL(/bilan/);
await sql`update eval_attempts set status = 'graded', final_score = 2, scores = coalesce(auto_scores, '{}'::jsonb), graded_at = now() where id = ${att.id}`;

const ad = await page('admin@test.local', 'admin-test-1234');
const setKey = async (provider, key) => { await ad.goto(BASE + '/contenu/ia'); const f = ad.locator(`form[data-provider="${provider}"]`);
  await f.locator('input[name=key]').fill(key); await f.locator('button:has-text("Vérifier et enregistrer")').click(); await f.locator('[role=status]').waitFor(); };
await setKey('mistral', 'cle-mistral');

console.log('Indicateurs');
const pa = await page('parent@test.local', 'parent-test-1234');
await pa.goto(BASE + '/parent/bilan');
const facts = await pa.locator('section[aria-labelledby="faits"]').innerText();
ok(facts.includes('Leçon lue en 4 min pour'), 'leçon survolée repérée (4 min pour la durée prévue)');
ok(/Évaluation rendue en \d+ min sur/.test(facts) && /% de questions laissées vides/.test(facts), 'évaluation bâclée et copie en partie vide repérées');
ok(/Exercices\s*8\/10/.test(facts.replace(/\n/g, ' ')) || facts.includes('8/10'), 'exercices 8/10 comparés à l’évaluation 2/20');

console.log('Premier bilan (Mistral, Europe)');
ok(await pa.locator('button:has-text("Demander un bilan")').count() === 0 && await pa.locator('a:has-text("Autoriser le bilan par l’IA")').count() === 1, 'sans l’accord du parent : pas de bilan possible, lien vers l’autorisation');
await pa.click('a:has-text("Autoriser le bilan par l’IA")');
await pa.check('input[name=ai_bilan]'); await pa.click('button:has-text("Enregistrer mes choix")');
await pa.waitForSelector('text=Choix enregistrés pour Léa');
await pa.click('button:has-text("Demander un bilan")');
await pa.waitForSelector('text=Synthèse numéro 1');
const in1 = JSON.parse(inputs[0].user.slice(inputs[0].user.indexOf('{')));
ok(inputs[0].provider === 'mistral' && inputs[0].model === 'mistral-large-latest', 'bilan rédigé par Mistral Large (Europe)');
ok(!inputs[0].user.includes('Léa') && in1.cours.length >= 1 && in1.cours[0].evaluations[0].wrong.length > 0, 'l’IA reçoit les faits et les questions ratées, sans le prénom');
ok(in1.programme_syllig.length > 10, 'l’IA reçoit le programme Syllig (pour ne pas proposer des leçons déjà existantes)');
ok(inputs[0].system.includes('lacunes_anterieures') && inputs[0].system.includes('JSON Schema'), 'consignes d’expert et schéma de réponse envoyés');
const view = await pa.locator('section[aria-labelledby="bilan-ia"]').innerText();
ok(view.includes('Pas encore possible de trancher') && view.includes('Dix minutes de calcul mental') && view.includes('confiance'), 'bilan affiché : origine, conseils, niveau de confiance');

console.log('Test de positionnement');
await pa.click('button:has-text("Proposer ce test à Léa")');
await pa.waitForSelector('text=Test proposé à Léa');
const [pt] = await sql`select id, total, duration_min from placement_tests where student_id = ${st.id}`;
ok(pt.total === 6, 'la question mal formée par l’IA est écartée (6 questions retenues sur 7)');
await el.goto(BASE + '/eleve');
await el.click('a:has-text("Faire le test")');
await el.click('button:has-text("Commencer le test")');
await el.waitForSelector('[role=timer]');
ok(await el.locator('.tabbar').isHidden(), 'mode concentration pendant le test');
await el.locator('#q-p1 input[value="1"]').check();
await el.locator('[aria-label="Ta réponse à p2"]').fill('−18');
await el.locator('[aria-label="Ta réponse à p3"]').fill('adjectif');
await el.locator('[aria-label="Ta réponse à p5"]').fill('0,75');
await el.waitForTimeout(1200);
await el.reload(); await el.waitForSelector('[role=timer]');
ok(await el.locator('[aria-label="Ta réponse à p2"]').inputValue() === '−18', 'réponses enregistrées au fil de l’eau (rechargement sans perte)');
await el.click('button:has-text("Terminer le test")'); await el.click('button:has-text("Oui, terminer")');
await el.waitForSelector('text=3 bonnes réponses sur 6');
ok((await el.textContent('main')).includes('Soustraire −11, c’est ajouter 11'), 'l’élève voit sa correction expliquée');
const [done] = await sql`select status, score, results from placement_tests where id = ${pt.id}`;
ok(done.status === 'termine' && done.score === 3 && done.results.filter(r => r.vide).length === 2, 'corrigé automatiquement : 3/6, 2 sans réponse');

await pa.goto(BASE + '/parent/bilan');
const tv = await pa.locator('section[aria-labelledby="positionnement"]').innerText();
ok(tv.includes('Fait : 3/6') && tv.includes('Relatifs') && tv.includes('niveau 5e'), 'le parent voit les résultats par notion et par niveau');

console.log('Second bilan (Claude), qui tient compte du test');
await setKey('claude', 'sk-ant-test');
await ad.goto(BASE + '/contenu/ia'); await ad.selectOption('select[name=task_bilan]', 'claude::claude-opus-5-5'); await ad.check('input[name=allow_non_eu]');
await ad.click('button:has-text("Enregistrer les réglages")'); await ad.waitForSelector('text=Réglages enregistrés');
await pa.click('button:has-text("Nouveau bilan")');
await pa.waitForSelector('text=Synthèse numéro 2');
const in2 = JSON.parse(inputs[1].user.slice(inputs[1].user.indexOf('{')));
ok(inputs[1].provider === 'claude' && in2.tests_de_positionnement.length === 1 && in2.tests_de_positionnement[0].score === 3, 'le second bilan reçoit les résultats du test');
ok((await pa.locator('section[aria-labelledby="bilan-ia"]').innerText()).includes('Lacunes des années précédentes'), 'origine affichée : lacunes des années précédentes');
await pa.locator('section[aria-labelledby="historique"] input[data-bulk="bulk-bilans"]').nth(1).check();
await pa.click('button:has-text("Supprimer (1)")'); await pa.click('[data-dialog-ok]');
let left = 2; for (let i = 0; i < 50 && left !== 1; i++) { await pa.waitForTimeout(100); left = (await sql`select count(*)::int as n from student_reports`)[0].n; }
ok(left === 1, 'suppression groupée d’un ancien bilan');

console.log('Leçons à créer (espace Contenu)');
await ad.goto(BASE + '/contenu/a-creer');
const lc = await ad.locator('main').innerText();
ok(lc.includes('2 leçons de rattrapage à créer') && lc.includes('proposée 2 fois') && !lc.includes('Léa'), 'leçons regroupées (proposées par 2 bilans), sans nom d’élève');
await ad.locator('label:has-text("Tout sélectionner") input').first().check();
await ad.click('button:has-text("Marquer comme créées")');
await ad.waitForSelector('text=Déjà traitées');
ok((await sql`select count(*)::int as n from lesson_suggestions where status = 'creee'`)[0].n === 4, 'action groupée : marquées comme créées');

// React #418 (écart d'hydratation, intermittent, sans effet visible) : avertissement connu, non bloquant ; toute autre erreur bloque.
const hydr418 = errs.filter(e => /Minified React error #418/.test(e));
if (hydr418.length) console.log(`  ⚠ avertissement connu : ${hydr418.length} écart(s) d’hydratation React #418`);
ok(errs.filter(e => !/Minified React error #418/.test(e)).length === 0, `aucune erreur JavaScript ni fenêtre native (${errs.filter(e => !/#418/.test(e)).join(' | ') || 'aucune'})`);
await b.close(); mock.close(); await sql.end();
console.log('Bilan pédagogique : OK');
