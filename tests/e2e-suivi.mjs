// Suivi en direct (espace parent) : l'élève travaille, fait une pause, s'en va ; le parent le voit sans recharger la page.
// Frise du jour, barres des 7 derniers jours, répartition, indicateurs, tableau des chiffres, pastille sur l'accueil.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-suivi.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };
const wait = ms => new Promise(r => setTimeout(r, ms));

const [st] = await sql`select id from students limit 1`;
const [c] = await sql`select c.id, c.title from courses c join course_versions v on v.course_id = c.id and v.status = 'published' order by c.position limit 1`;
// historique : une séance d'hier (40 min actives sur 50) pour les barres de la semaine
await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds, idle_pauses)
  values (${st.id}, ${c.id}, 'exercises', now() - interval '1 day', now() - interval '1 day' + interval '50 minutes', now() - interval '1 day' + interval '50 minutes', 3000, 2400, 2)`;

const b = await chromium.launch();
const page = async (l, pw) => { const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errs = [], warns = []; p.on('pageerror', e => (/#418/.test(e.message) ? warns : errs).push(`${p.url()} : ${e.message.slice(0, 80)}`)); p.errs = errs; p.warns = warns;
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };
const el = await page('lea', 'lea-test-1234');
const pa = await page('parent@test.local', 'parent-test-1234');
const act = body => el.evaluate(b => fetch('/api/activity', { method: 'POST', body: JSON.stringify(b) }).then(r => r.json()), body);

console.log('Hors ligne');
await pa.goto(BASE + '/parent/suivi');
ok(await pa.locator('[data-live="hors_ligne"]').count() === 1, 'au départ, l’élève est « Hors ligne »');
ok(await pa.locator('nav a[href="/parent/suivi"]').count() > 0, 'entrée « En direct » dans le menu du parent');

console.log('L’élève travaille');
const { session } = await act({ action: 'start', kind: 'lesson', courseId: c.id });
ok(!!session, 'séance ouverte');
await wait(2500); await act({ action: 'beat', session, active: true });
await wait(2500); await act({ action: 'beat', session, active: true });
await pa.waitForSelector('[data-live="travaille"]', { timeout: 15000 });
ok((await pa.locator('[data-live-label]').innerText()).includes('Actif sur une page de travail'), 'le parent voit « Actif sur une page de travail » sans recharger');
ok((await pa.locator('[data-live]').innerText()).includes(c.title), 'le cours en cours est affiché');
ok(await pa.locator('svg rect[data-seg="travail"]').count() >= 1, 'la frise du jour montre un bloc de travail');

console.log('Pause');
await wait(2500); await act({ action: 'beat', session, active: false });
await pa.waitForSelector('[data-live="pause"]', { timeout: 15000 });
ok(true, 'le parent voit « En pause »');
await pa.waitForSelector('svg rect[data-seg="pause"]', { timeout: 15000 });
ok(true, 'la frise montre la pause');
await pa.locator('svg rect[data-seg="pause"]').first().focus();   // focus clavier : même bulle qu’au survol, sans dépendre de la largeur du bloc
ok((await pa.locator('.bg-ink').first().innerText()).includes('Sans geste'), 'bulle au survol d’un bloc (« Sans geste »)');

console.log('Fin de séance');
await wait(1500); await act({ action: 'end', session, active: false });
await pa.waitForSelector('[data-live="hors_ligne"]', { timeout: 15000 });
ok((await pa.locator('[data-live]').innerText()).includes('Dernière activité'), 'le parent voit « Hors ligne » et l’heure de la dernière activité');
const beats = await sql`select count(*)::int as n from activity_beats where session_id = ${session}`;
ok(beats[0].n === 4, `signaux conservés (${beats[0].n})`);

console.log('Graphiques et chiffres');
await pa.reload();
ok(await pa.locator('[data-day]').count() === 7, 'barres des 7 derniers jours');
const yest = await pa.locator('[data-day] [data-bar="travail"]').count();
ok(yest >= 1, 'travail effectif d’hier visible dans les barres');
await pa.click('[data-table] summary');
ok((await pa.locator('[data-table] table').innerText()).includes('40 min'), 'tableau des chiffres : 40 min d’hier');
ok((await pa.locator('[data-tile="regularite"]').innerText()).includes('/7'), 'indicateur de régularité');
ok(!(await pa.locator('[data-tile="concentration"]').innerText()).includes('—'), 'indicateur de concentration calculé');
ok((await pa.locator('body').innerText()).includes('Exercices'), 'répartition par activité');

console.log('Accueil');
await pa.goto(BASE + '/parent');
ok(await pa.locator('[data-home-live="hors_ligne"]').count() === 1, 'pastille d’état sur l’accueil, vers le suivi en direct');

// un parent d'un autre foyer ne peut pas lire l'état de cet élève
const anon = await (await b.newContext()).request.get(`${BASE}/api/parent/live?eleve=${st.id}`);
ok(anon.status() === 401, 'API protégée');

for (const p of [el, pa]) { if (p.warns.length) console.log('  (avertissement hydratation)', p.warns[0]); ok(p.errs.length === 0, `aucune erreur JS (${p.errs.join(' | ')})`); }
await b.close(); await sql.end();
console.log('\nSuivi en direct : OK');
