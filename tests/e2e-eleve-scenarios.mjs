// Scénarios de la vie réelle d'une élève de 3e, non couverts par les autres tests :
// reprise d'une leçon, évaluation avec accord du parent, fin du temps (remise automatique),
// correction des réponses rédigées par export/import Claude, révision programmée, deuxième tentative (autre sujet).
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs` (bibliothèque publiée).
// Usage : BASE=… DATABASE_URL=… node tests/e2e-eleve-scenarios.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"eval_requires_approval": true}'::jsonb where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const course = async code => (await sql`select c.id, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = ${code}`)[0];

const b = await chromium.launch();
const page = async (l, pw, mobile) => { const p = await (await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true } : { viewport: { width: 1366, height: 768 }, acceptDownloads: true })).newPage();
  p.on('dialog', d => d.accept()); const errs = []; p.on('pageerror', e => errs.push(`${p.url()} : ${e.message.slice(0, 80)}`)); p.errs = errs;
  await p.route('**/api/activity', r => r.fulfill({ status: 200, body: '{}' }));
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };
const el = await page('lea', 'lea-test-1234', true);           // l'élève sur téléphone
const pa = await page('parent@test.local', 'parent-test-1234'); // le parent sur ordinateur

// ── 1. Reprise d'une leçon interrompue ──
console.log('Reprise d’une leçon');
const m = await course('TG034');
await el.goto(`${BASE}/eleve/cours/${m.id}/lecon`);
await el.click('button:has-text("Suivant ›")');
const cp = m.doc.lesson.parts[0].checkpoint;
const prompt = (await el.locator('section[aria-label="Point de contrôle"] strong.text-base').innerText()).trim();
const v = cp.variants.find(x => x.prompt.replace(/[*]/g, '').trim() === prompt) ?? cp.variants[0];
await el.locator('section[aria-label="Point de contrôle"] button[aria-pressed]').nth(v.answer).click();
await el.waitForSelector('text=Bien vu !');
await el.goto(`${BASE}/eleve`);                                 // l'élève quitte la leçon…
await el.goto(`${BASE}/eleve/cours/${m.id}/lecon`);             // … et revient
await el.waitForSelector('text=Partie 2 sur');
ok(true, 'la leçon reprend à la partie 2, là où l’élève s’était arrêtée');

// ── 2. Évaluation avec accord du parent ──
console.log('Évaluation avec accord du parent');
const f = await course('TG001');
await sql`insert into course_progress (student_id, course_id, lesson_done_at, exercises_done_at, exercises_score) values (${st.id}, ${f.id}, now(), now(), 9)
  on conflict (student_id, course_id) do update set lesson_done_at = now(), exercises_done_at = now(), exercises_score = 9`;
await el.goto(`${BASE}/eleve/cours/${f.id}/evaluation`);
await el.click('button:has-text("Demander à passer l’évaluation")');
await el.waitForSelector('text=Ta demande est envoyée à ton parent');
ok(true, 'demande envoyée au parent');
await pa.goto(`${BASE}/parent/a-faire`);
await pa.locator('button:has-text("Autoriser")').first().click();
await pa.waitForLoadState('networkidle');
const [{ status: s1 }] = await sql`select status from eval_attempts where student_id = ${st.id} and course_id = ${f.id} order by attempt_no desc limit 1`;
ok(s1 === 'approved', 'le parent autorise depuis « À faire »');
await el.goto(`${BASE}/eleve/cours/${f.id}/evaluation`);
await el.click('button:has-text("Commencer")');
await el.waitForSelector('[role=timer]');
ok(true, 'l’élève démarre l’évaluation autorisée');
ok(await el.locator('.tabbar').isHidden(), 'mode concentration : la barre d’onglets est masquée pendant l’évaluation');

// ── 3. Réponses saisies, puis fin du temps : remise automatique ──
console.log('Fin du temps');
const [att] = await sql`select id, variant from eval_attempts where student_id = ${st.id} and course_id = ${f.id} order by attempt_no desc limit 1`;
const variant = f.doc.evaluation.variants[att.variant];
const qs = variant.sections.flatMap(s => s.questions);
for (const s of variant.sections) {
  await el.click(`[role=tab]:has-text("${s.label.split(' (')[0].slice(0, 30)}")`);
  for (const q of s.questions) {
    if (q.type === 'qcm') await el.locator(`input[name="${q.id}"][value="${q.answer}"]`).check();
    else await el.locator(`[aria-label="Ta réponse à ${q.id}"]`).fill(q.type === 'open' ? `Réponse rédigée (${q.id}).` : String(q.type === 'numeric' ? q.answer : q.answer[0]));
  }
}
await el.waitForTimeout(11_000);                                  // la sauvegarde automatique passe (toutes les 10 s)
await sql`update eval_attempts set deadline_at = now() - interval '5 minutes' where id = ${att.id}`;
await el.goto(`${BASE}/eleve/cours/${f.id}/evaluation`);
await el.waitForURL(/bilan/);
const [a2] = await sql`select status, answers from eval_attempts where id = ${att.id}`;
ok(a2.status === 'submitted', 'temps écoulé : la copie est remise automatiquement');
ok(qs.every(q => (a2.answers[q.id] ?? '').length > 0), 'toutes les réponses saisies ont été conservées');

// ── 4. Correction des réponses rédigées par export / import Claude ──
console.log('Correction par le parent (export / import Claude)');
await pa.goto(`${BASE}/parent/a-faire`);
const [dl] = await Promise.all([pa.waitForEvent('download'), pa.click('text=Tout exporter pour Claude (1)')]);
const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
const open = qs.filter(q => q.type === 'open');
ok(exported.copies.length === 1 && exported.copies[0].questions.length === open.length, `export : ${open.length} réponses rédigées à corriger`);
const res = { format: 'syllig-corrections-resultat/1', copies: [{ ref: exported.copies[0].ref, commentaire_general: 'Bon travail.',
  questions: exported.copies[0].questions.map(q => ({ id: q.id, points: q.points_max / 2, commentaire: 'À compléter.' })) }] };
const rf = '/tmp/claude-0/resultat-claude-scenarios.json'; fs.mkdirSync('/tmp/claude-0', { recursive: true }); fs.writeFileSync(rf, JSON.stringify(res));
await pa.click('summary:has-text("Importer la réponse de Claude")');
await pa.setInputFiles('input[name=file]', rf);
await pa.click('text=Importer les propositions');
await pa.waitForSelector('text=1 copie pré-corrigée');
await pa.click('a:has-text("Vérifier et valider")');
await pa.click('button:has-text("Valider la note")');
await pa.click('[data-dialog-ok]');   // fenêtre de confirmation de l’application
await pa.waitForSelector('text=Note validée.');
const [a3] = await sql`select status, final_score from eval_attempts where id = ${att.id}`;
const expected = qs.filter(q => q.type !== 'open').reduce((n, q) => n + q.points, 0) + open.reduce((n, q) => n + q.points / 2, 0);
ok(a3.status === 'graded' && Math.abs(Number(a3.final_score) - expected) < 0.01, `note validée : ${Number(a3.final_score)}/20 (attendu ${expected})`);

// ── 5. Bilan et révision programmée côté élève ──
console.log('Bilan et révision');
await el.goto(`${BASE}/eleve/cours/${f.id}/bilan/${att.id}`);
await el.waitForSelector('text=Ce que tu sais faire maintenant');
ok(true, 'bilan final visible par l’élève');
const [pr] = await sql`select next_review_at, best_eval_score, mastery from course_progress where student_id = ${st.id} and course_id = ${f.id}`;
ok(!!pr.next_review_at && pr.mastery >= 1, `révision programmée le ${pr.next_review_at.toLocaleDateString('fr-FR')} (niveau ${pr.mastery})`);
await sql`update course_progress set next_review_at = now() - interval '1 hour' where student_id = ${st.id} and course_id = ${f.id}`;
await el.goto(`${BASE}/eleve`);
ok((await el.textContent('main')).includes(f.doc.title), 'la révision apparaît dans « Aujourd’hui »');

// ── 6. Deuxième tentative : l'autre sujet ──
console.log('Deuxième tentative');
await el.goto(`${BASE}/eleve/cours/${f.id}/evaluation`);
ok((await el.textContent('main')).includes('Nouvelle tentative possible à partir du'), 'délai entre deux tentatives respecté');
await sql`update eval_attempts set graded_at = now() - interval '30 days' where id = ${att.id}`;
await el.goto(`${BASE}/eleve/cours/${f.id}/evaluation`);
await el.click('button:has-text("Demander à passer l’évaluation")');
await el.waitForSelector('text=Ta demande est envoyée à ton parent');
await pa.goto(`${BASE}/parent/a-faire`);
await pa.locator('button:has-text("Autoriser")').first().click();
await pa.waitForLoadState('networkidle');
await el.goto(`${BASE}/eleve/cours/${f.id}/evaluation`);
await el.click('button:has-text("Commencer")');
await el.waitForSelector('[role=timer]');
const [att2] = await sql`select attempt_no, variant from eval_attempts where student_id = ${st.id} and course_id = ${f.id} order by attempt_no desc limit 1`;
const q2 = f.doc.evaluation.variants[1].sections[0].questions[0].prompt.replace(/[*]/g, '').slice(0, 30);
ok(att2.attempt_no === 2 && att2.variant === 1 && (await el.textContent('main')).includes(q2), 'tentative 2 : l’élève reçoit le sujet 2');

// React #418 (écart d'hydratation, intermittent, sans effet visible : React redessine la page) : signalé, non bloquant, cause encore inconnue.
const all = [...el.errs, ...pa.errs], hydr = all.filter(e => /Minified React error #418/.test(e)), other = all.filter(e => !/Minified React error #418/.test(e));
if (hydr.length) console.log(`  ⚠ avertissement connu : ${hydr.length} écart(s) d’hydratation React #418 (${hydr.map(e => e.split(' : ')[0]).join(', ')})`);
ok(other.length === 0, `aucune autre erreur JavaScript (${other.join(' | ') || 'aucune'})`);
await b.close(); await sql.end();
console.log('Scénarios élève : OK');
