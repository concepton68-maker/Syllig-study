// Parcours complet d'un ou plusieurs cours de la bibliothèque, réponses justes lues dans le corrigé :
// leçon (tous les points de contrôle) → exercices → évaluation → correction du parent → 20/20 attendu.
// Prérequis : base de test (tests/reset-db.sh), puis `node scripts/seed.mjs` (bibliothèque publiée).
// Usage : BASE=… DATABASE_URL=… COURS=TG034,TG145 node tests/e2e-cours-complet.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const CODES = (process.env.COURS ?? 'TG034').split(',');
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select s.id, s.level_code from students s limit 1`;
await sql`update students set level_code = 'troisieme-generale', settings = settings || '{"eval_requires_approval": false}'::jsonb where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id} and status = 'en_cours'`;

const b = await chromium.launch();
const page = async (l, pw) => { const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };
const el = await page('lea', 'lea-test-1234');
const pa = await page('parent@test.local', 'parent-test-1234');
const goodShort = q => (q.type === 'numeric' ? String(q.answer).replace('.', ',') : q.answer[0]);
const fillAnswer = async (p, q) => {
  if (q.type === 'qcm') { await p.locator(`input[name="${q.id}"][value="${Array.isArray(q.answer) ? q.answer[0] : q.answer}"]`).check(); return; }
  await p.locator(`[aria-label="Ta réponse à ${q.id}"]`).fill(q.type === 'open' ? `Réponse rédigée de test (${q.id}).` : goodShort(q));
};

for (const code of CODES) {
  const [c] = await sql`select c.id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code = ${code}`;
  if (!c) { console.error('Cours introuvable ou non publié :', code); process.exit(1); }
  const doc = c.doc;
  console.log(`${code} · ${doc.title}`);

  // ── Leçon ──
  await el.goto(`${BASE}/eleve/cours/${c.id}/lecon`);
  await el.waitForSelector('text=Avant de commencer');
  await el.click('button:has-text("Suivant ›")');
  for (let part = 0; part < doc.lesson.parts.length; part++) {
    const cp = doc.lesson.parts[part].checkpoint;
    if (!cp) { await el.click('button:has-text("Suivant ›")'); continue; }
    await el.waitForSelector(`section[aria-label="Point de contrôle"] >> text=partie ${part + 1} sur`);
    const prompt = await el.locator('section[aria-label="Point de contrôle"] strong.text-base').innerText();
    const quote = (await el.locator('section[aria-label="Point de contrôle"] p.italic').allInnerTexts()).join('');
    const v = cp.variants.find(x => x.prompt.replace(/\*\*/g, '').replace(/\*/g, '').trim() === prompt.trim() && (!x.quote || quote.includes(x.quote.slice(0, 20))))
      ?? cp.variants.find(x => prompt.includes(x.prompt.replace(/[*]/g, '').slice(0, 25)));
    if (!v) throw new Error(`${code} partie ${part + 1} : variante introuvable « ${prompt} »`);
    await el.locator('section[aria-label="Point de contrôle"] button[aria-pressed]').nth(v.answer).click();
    await el.waitForSelector('text=Bien vu !');
    await el.click(part < doc.lesson.parts.length - 1 ? 'button:has-text("Page suivante ›")' : 'button:has-text("Voir la fiche mémo")');
  }
  await el.waitForSelector('text=Leçon terminée, bravo');
  ok(true, `leçon : ${doc.lesson.parts.length} points de contrôle réussis`);

  // ── Exercices ──
  await el.click('text=② Faire les exercices');
  await el.waitForURL(/exercices/);
  for (const tab of await el.locator('[role=tab]').all()) {
    await tab.click();
    for (const q of doc.exercises.items) if (await el.locator(`[aria-label="Ta réponse à ${q.id}"], input[name="${q.id}"]`).first().isVisible().catch(() => false)) await fillAnswer(el, q);
  }
  await el.waitForTimeout(1200);
  await el.click('text=Valider mes réponses et voir les corrigés'); if (await el.locator('button:has-text("Oui, voir les corrigés")').isVisible()) await el.click('button:has-text("Oui, voir les corrigés")');
  await el.waitForSelector('text=/Compare avec le corrigé|Score :/');
  for (const tab of await el.locator('[role=tab]').all()) {
    await tab.click();
    const r = el.locator('button:text-is("Réussi")');
    for (let k = 0; k < await r.count(); k++) await r.nth(k).click();
  }
  if (await el.locator('text=Enregistrer mon résultat').isVisible()) await el.click('text=Enregistrer mon résultat');
  await el.waitForSelector('text=+50 points de progrès');
  ok(await el.locator('text=Score : 10/10').isVisible(), 'score 10/10 affiché');
  ok(true, 'exercices : 10/10 avec les réponses du corrigé (correction automatique acceptée)');

  // ── Évaluation ──
  await el.goto(`${BASE}/eleve/cours/${c.id}/evaluation`);
  await el.click('button:has-text("Commencer")');
  await el.waitForSelector('[role=timer]');
  const [att] = await sql`select id, variant from eval_attempts where student_id = ${st.id} and course_id = ${c.id} order by attempt_no desc limit 1`;
  const variant = doc.evaluation.variants[att.variant % doc.evaluation.variants.length];
  for (const s of variant.sections) {
    await el.click(`[role=tab]:has-text("${s.label.split(' (')[0].slice(0, 30)}")`);
    for (const q of s.questions) await fillAnswer(el, q);
  }
  await el.click('text=Remettre ma copie'); await el.click('button:has-text("Oui, remettre")');
  await el.waitForURL(/bilan/);
  ok(true, `évaluation remise (sujet ${att.variant + 1})`);

  // ── Correction par le parent (points maximum aux questions rédigées) ──
  const [a] = await sql`select status, auto_scores from eval_attempts where id = ${att.id}`;
  const autoMissed = variant.sections.flatMap(s => s.questions).filter(q => q.type !== 'open' && a.auto_scores && a.auto_scores[q.id] !== q.points);
  ok(autoMissed.length === 0, `correction automatique : toutes les bonnes réponses acceptées${autoMissed.length ? ' — refusées : ' + autoMissed.map(q => q.id).join(', ') : ''}`);
  if (a.status === 'submitted') {
    await pa.goto(`${BASE}/parent/copies/${att.id}`);
    for (const q of variant.sections.flatMap(s => s.questions).filter(q => q.type === 'open')) await pa.fill(`input[name="p_${q.id}"]`, String(q.points).replace('.', ','));
    await pa.click('button:has-text("Valider la note")');
    await pa.waitForSelector('text=Note validée.');
  }
  const [fin] = await sql`select final_score, status from eval_attempts where id = ${att.id}`;
  ok(fin.status === 'graded' && Number(fin.final_score) === 20, `note finale ${fin.final_score}/20`);
}

await sql`update students set level_code = ${st.level_code} where id = ${st.id}`;
await b.close(); await sql.end();
console.log('Cours complets : OK');
