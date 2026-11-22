// Captures de présentation de l'espace élève (thème rose) et des écrans fixes — après e2e-parcours + demo-activity
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.env.OUT, BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const b = await chromium.launch();
const login = async (l, pw) => { const c = await b.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 }); const p = await c.newPage();
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw); await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };
const st = await login('lea', 'lea-test-1234');
await st.waitForLoadState('networkidle'); await st.screenshot({ path: OUT + '/20-eleve-aujourdhui-rose.png' });
await st.goto(BASE + '/eleve/theme'); await st.screenshot({ path: OUT + '/21-eleve-mon-theme.png' });
await st.goto(BASE + '/eleve/cours/1/lecon'); await st.waitForLoadState('networkidle');
await st.locator('nav[aria-label="Plan de la leçon"] button').nth(2).click(); await st.screenshot({ path: OUT + '/22-lecon-page-rose.png' });
await st.goto(BASE + '/eleve/cours/1/exercices'); await st.waitForLoadState('networkidle'); await st.screenshot({ path: OUT + '/23-exercices-onglets-rose.png' });
const pa = await login('parent@test.local', 'parent-test-1234');
await pa.waitForLoadState('networkidle'); await pa.screenshot({ path: OUT + '/24-parent-ecran-fixe.png' });
await pa.goto(BASE + '/parent/journal'); await pa.screenshot({ path: OUT + '/25-parent-journal-colonnes.png' });
await pa.goto(BASE + '/parent/regles'); await pa.screenshot({ path: OUT + '/28-parent-regles-theme.png' });
await b.close();
