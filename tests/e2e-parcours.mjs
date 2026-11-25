// Scénario complet de l'étape 1 : import → publication → élève (leçon, exercices, évaluation) → parent (export/import, validation)
// Usage : BASE=http://127.0.0.1:3100 SHOTS=dossier node tests/e2e-parcours.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const SHOTS = process.env.SHOTS ?? '/tmp/shots';
const COURSE = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'content/seconde-generale/cours/C001.json');
const doc = JSON.parse(fs.readFileSync(COURSE, 'utf8'));
fs.mkdirSync(SHOTS, { recursive: true });
const ok = (c, m) => { if (!c) throw new Error('ÉCHEC : ' + m); console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = async () => { const c = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true }); const p = await c.newPage(); p.on('dialog', d => d.accept()); return p; };
const login = async (p, l, pw) => { await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw); await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); };
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png` });

try {
  console.log('Administrateur');
  const admin = await ctx();
  await login(admin, 'admin@test.local', 'admin-test-1234');
  await admin.goto(BASE + '/contenu/importer');
  await admin.setInputFiles('input[name=files]', COURSE);
  await admin.click('text=Vérifier et importer en brouillon');
  await admin.waitForURL(/\/contenu\/cours\/\d+/);
  ok(await admin.isVisible('text=Import réussi'), 'import de C001 en brouillon');
  await shot(admin, '01-apercu-contenu');
  await admin.click('text=Publier cette version'); await admin.click('button:has-text("Oui, confirmer")');
  await admin.waitForSelector('text=publiée');
  ok(true, 'publication');
  // fichier invalide refusé
  await admin.goto(BASE + '/contenu/importer');
  const bad = { ...doc, evaluation: { ...doc.evaluation, total_points: 25 } };
  await admin.fill('textarea[name=json]', JSON.stringify(bad));
  await admin.click('text=Vérifier et importer en brouillon');
  await admin.waitForSelector('text=Import refusé');
  ok(await admin.isVisible('text=les évaluations sont notées sur 20'), 'fichier incohérent (barème sur 25) refusé avec un message clair');

  console.log('Élève');
  const st = await ctx();
  await login(st, 'lea', 'lea-test-1234');
  await shot(st, '02-eleve-aujourdhui');
  await st.click('text=Commencer');
  await st.waitForURL(/lecon/);
  // la leçon s'ouvre sur la page d'introduction ; « Suivant » mène à la partie 1
  await st.waitForSelector('text=Avant de commencer');
  ok(true, 'leçon en pages : ouverture sur la page « Objectifs »');
  await shot(st, '03a-lecon-intro');
  await st.click('button:has-text("Suivant ›")');
  let wrongDone = false;
  for (let part = 0; part < doc.lesson.parts.length; part++) {
    const cp = doc.lesson.parts[part].checkpoint;
    await st.waitForSelector(`section[aria-label="Point de contrôle"] >> text=partie ${part + 1} sur`);
    for (;;) {
      const prompt = await st.locator('section[aria-label="Point de contrôle"] strong.text-base').innerText();
      const quote = await st.locator('section[aria-label="Point de contrôle"] p.italic').allInnerTexts();
      const v = cp.variants.find(x => x.prompt === prompt && (!x.quote || quote.join('').includes(x.quote.slice(0, 30))));
      if (!v) throw new Error('variante inconnue : ' + prompt);
      const buttons = st.locator('section[aria-label="Point de contrôle"] button[aria-pressed]');
      if (!wrongDone) {
        ok(await st.locator('button:has-text("Suivant ›")').isDisabled(), 'page suivante verrouillée tant que le point de contrôle n’est pas réussi');
        await buttons.nth((v.answer + 1) % v.options.length).click();
        await st.waitForSelector('text=Presque !');
        if (part === 0) await shot(st, '03-point-de-controle-presque');
        await st.click('text=Réessayer avec une autre question');
        wrongDone = true;
        continue;
      }
      await buttons.nth(v.answer).click();
      await st.waitForSelector('text=Bien vu !');
      break;
    }
    await st.click(part < doc.lesson.parts.length - 1 ? 'button:has-text("Page suivante ›")' : 'button:has-text("Voir la fiche mémo")');
  }
  await st.waitForSelector('text=Leçon terminée, bravo');
  ok(true, 'leçon terminée page par page (5 points de contrôle, dont une erreur sans pénalité)');
  await shot(st, '04-lecon-terminee');

  await st.click('text=② Faire les exercices');
  await st.waitForURL(/exercices/);
  ok(!(await st.content()).includes(doc.exercises.items[0].solution.slice(0, 40)), 'aucun corrigé envoyé avant la remise');
  ok(await st.isVisible('aside[aria-label="Texte support"] >> text=La pluie battait'), 'texte support affiché à côté des questions');
  const LEVELS = ['Exercices', 'Je repère', 'J’analyse', 'Je rédige'];
  const levels = [...new Set(doc.exercises.items.map(q => q.stars ?? 0))].sort();
  for (const l of levels) {
    await st.click(`[role=tab]:has-text("${LEVELS[l]}")`);
    for (const q of doc.exercises.items.filter(x => (x.stars ?? 0) === l)) {
      if (q.type === 'qcm') await st.locator(`input[name=${q.id}][value="${q.answer}"]`).check();
      else await st.fill(`textarea[aria-label="Ta réponse à ${q.id}"]`, 'Réponse de test pour ' + q.id);
    }
  }
  await st.waitForTimeout(1500);
  await st.click('text=Valider mes réponses et voir les corrigés'); if (await st.locator('button:has-text("Oui, voir les corrigés")').isVisible()) await st.click('button:has-text("Oui, voir les corrigés")');
  await st.waitForSelector('text=Compare avec le corrigé');
  for (const [i, l] of levels.entries()) {
    await st.click(`[role=tab]:has-text("${LEVELS[l]}")`);
    const reussi = st.locator('button:text-is("Réussi")');
    const n = await reussi.count();
    for (let k = 0; k < n; k++) await reussi.nth(k).click();
    if (i === levels.length - 1) await st.locator('button:text-is("Pas encore")').last().click();
  }
  ok((await st.content()).includes(doc.exercises.items.at(-1).solution.slice(0, 40)), 'corrigés visibles après la remise');
  await st.click('text=Enregistrer mon résultat');
  await st.waitForSelector('text=Score : 9/10');
  ok(true, 'exercices en onglets : 9/10 (QCM corrigé automatiquement + auto-correction guidée)');
  await shot(st, '05-exercices-corriges');

  await st.click('text=③ Passer à l’évaluation');
  await st.waitForURL(/evaluation/);
  await shot(st, '06-evaluation-consignes');
  await st.click('button:has-text("Commencer")');
  await st.waitForSelector('[role=timer]');
  ok(!(await st.content()).includes(doc.evaluation.variants[0].sections[0].questions[0].solution.slice(0, 40)), 'aucun corrigé envoyé pendant l’évaluation');
  for (const s of doc.evaluation.variants[0].sections) {
    await st.click(`[role=tab]:has-text("${s.label.split(' (')[0]}")`);
    for (const q of s.questions) {
      const sel = q.type === 'short' ? `input[aria-label="Ta réponse à ${q.id}"]` : `textarea[aria-label="Ta réponse à ${q.id}"]`;
      await st.fill(sel, q.type === 'short' ? 'zéro, interne, externe' : 'Ma réponse à la question ' + q.id);
    }
  }
  await st.click(`[role=tab]:has-text("${doc.evaluation.variants[0].sections[1].label.split(' (')[0]}")`);
  // le coller est bloqué et compté
  await st.evaluate(() => { const t = document.querySelector('textarea'); const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }); t.dispatchEvent(e); });
  await st.waitForSelector('text=Le collage est désactivé');
  ok(true, 'collage bloqué pendant l’évaluation');
  ok(await st.locator('[role=timer]').isVisible(), 'chrono toujours visible');
  await st.screenshot({ path: `${SHOTS}/07-evaluation-en-cours.png` });
  await st.click('text=Remettre ma copie'); await st.click('button:has-text("Oui, remettre")');
  await st.waitForURL(/bilan/);
  ok(await st.isVisible('text=Copie remise'), 'copie remise, bilan provisoire (q3 corrigée automatiquement)');
  await shot(st, '08-bilan-provisoire');

  console.log('Parent');
  const pa = await ctx();
  await login(pa, 'parent@test.local', 'parent-test-1234');
  await shot(pa, '09-parent-tableau-de-bord');
  ok(await pa.isVisible('text=1 copie à valider'), 'le parent voit la copie à valider dès l’accueil');
  await pa.click('nav >> text=À faire');
  await pa.waitForURL(/a-faire/);
  const [dl] = await Promise.all([pa.waitForEvent('download'), pa.click('text=Tout exporter pour Claude (1)')]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(exported.copies.length === 1 && exported.copies[0].questions.length === 11, 'export : 1 copie, 11 réponses rédigées (q3 déjà corrigée)');
  ok(!JSON.stringify(exported).includes('Léa'), 'export sans le prénom de l’élève');
  fs.writeFileSync(`${SHOTS}/export-exemple.json`, JSON.stringify(exported, null, 2));
  // simulation de la réponse de Claude
  const result = { format: 'syllig-corrections-resultat/1', copies: [{ ref: exported.copies[0].ref, commentaire_general: 'Beau travail, continue comme ça !',
    questions: exported.copies[0].questions.map(q => ({ id: q.id, points: q.points_max * 0.75, commentaire: `Bonne piste sur ${q.id}. Pense à citer le texte.` })) }] };
  const rf = `${SHOTS}/resultat-claude.json`;
  fs.writeFileSync(rf, JSON.stringify(result));
  await pa.click('summary:has-text("Importer la réponse de Claude")');
  await pa.setInputFiles('input[name=file]', rf);
  await pa.click('text=Importer les propositions');
  await pa.waitForSelector('text=1 copie pré-corrigée');
  ok(true, 'import des propositions de Claude');
  await pa.click('a:has-text("Vérifier et valider")');
  await pa.waitForSelector('button:has-text("Valider la note")');
  await shot(pa, '10-parent-validation-copie');
  await pa.click('button:has-text("Valider la note")');
  await pa.click('[data-dialog-ok]');   // fenêtre de confirmation de l’application
  await pa.waitForSelector('text=Note validée.');
  ok(true, 'note validée par le parent');
  await pa.goto(BASE + '/parent/journal');
  ok((await pa.locator('[data-course-rows]').innerText()).includes('15,25/20'), 'Activité : le cours de la semaine et sa note');
  await pa.click('text=Voir le détail minute par minute');
  await pa.waitForURL(/journal\/detail/);
  ok(await pa.isVisible('text=Journal intact'), 'journal chaîné intact');
  const today = pa.locator('[data-day]').first();
  const blocks = await today.locator('[data-course-block]:not([data-course-block="hors"])').count();
  ok(blocks === 1, `journal regroupé : un seul bloc pour le cours du jour (${blocks})`);
  const blk = await today.locator('[data-course-block]').first().innerText();
  ok(blk.includes('Leçon terminée') && /Évaluation 15,25\/20/.test(blk), 'le bloc résume la journée : leçon terminée, évaluation 15,25/20');
  await today.locator('[data-course-block] summary').first().click();
  ok(await today.locator('[data-course-block] details li').count() > 3, 'le détail minute par minute se déplie');
  await shot(pa, '11-parent-journal');
  await pa.goto(BASE + '/parent');
  await shot(pa, '12-parent-tableau-de-bord-apres');

  await st.goto(BASE + '/eleve/resultats');
  await st.click('text=Bilan');
  await st.waitForSelector('text=Ce que tu as réussi dans cette évaluation');
  const txt = await st.locator('h1').innerText();
  ok(/15,25\/20|15,25/.test(txt), 'bilan final côté élève : ' + txt);
  await shot(st, '13-bilan-final');
  await st.goto(BASE + '/eleve');
  await shot(st, '14-eleve-apres');
  console.log('\nScénario complet : OK');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
