// Temps de travail (décision du propriétaire, 26/11/2026) : brouillon et réflexion comptent. Le temps compte tant que la page
// est au premier plan ; il s'arrête après 10 min sans rien toucher (réglable : 5, 10 ou 15 min).
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-pause.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id, settings from students limit 1`;
const [c] = await sql`select c.id from courses c join course_versions v on v.course_id = c.id and v.status = 'published' join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join students t on t.level_code = s.level_code and t.id = ${st.id} limit 1`;

const b = await chromium.launch();
const el = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const beats = [];
await el.route('**/api/activity', async r => {
  const body = JSON.parse(r.request().postData() || '{}');
  if (body.action === 'beat') beats.push(body.active);
  await r.fulfill({ status: 200, contentType: 'application/json', body: '{"session":"00000000-0000-0000-0000-000000000000"}' });
});
await el.goto(BASE + '/connexion'); await el.fill('input[name=login]', 'lea'); await el.fill('input[name=password]', 'lea-test-1234');
await el.click('button[type=submit]'); await el.waitForURL(u => !u.pathname.startsWith('/connexion'));
await el.clock.install();
await el.goto(`${BASE}/eleve/cours/${c.id}/lecon`);
await el.mouse.move(200, 200);
ok(await el.locator('text=Temps de travail compté').count() === 1, `leçon ouverte, temps compté (${el.url().replace(BASE, '')})`);
await el.clock.runFor(1000);   // réponse de « start » reçue : la séance est ouverte

console.log('Brouillon : aucun geste pendant 5 min, page au premier plan');
await el.clock.runFor(5 * 60_000);
ok(beats.length >= 15 && beats.every(x => x === true), `les 5 minutes sont comptées (${beats.filter(Boolean).length} signaux « actif » sur ${beats.length})`);
ok(await el.locator('text=Temps de travail compté').count() === 1 && await el.locator('#away-title').count() === 0, 'aucune interruption de l’élève');

console.log('Rien touché pendant plus de 10 min');
beats.length = 0;
await el.clock.runFor(5 * 60_000 + 20_000);   // 10 min 20 s sans geste : la fenêtre est ouverte, le compte à rebours n'est pas fini
ok(beats.at(-1) === false, 'au-delà de 10 min sans geste : le temps n’est plus compté');
ok(await el.locator('text=Temps de travail en pause').count() === 1 && await el.locator('#away-title').isVisible(), '« Tu es là ? » seulement à ce moment-là');
await el.keyboard.press('Enter');   // tout geste reprend (le bouton « Je reprends » a le focus)
ok(await el.locator('text=Temps de travail compté').count() === 1 && await el.locator('#away-title').count() === 0, 'reprise au premier geste');

console.log('Personne ne répond : compte à rebours puis séance fermée');
ok(await el.locator('[data-countdown]').count() === 0, 'pas de fenêtre tant qu’on touche');
await el.clock.runFor(10 * 60_000 + 20_000);
ok((await el.locator('[data-countdown]').innerText()).includes('s'), `« Tu es là ? » avec compte à rebours (${await el.locator('[data-countdown]').innerText()})`);
await el.clock.runFor(61_000);
await el.clock.resume();
for (let i = 0; i < 40 && !/\/eleve\?ferme=1/.test(el.url()); i++) await new Promise(r => setTimeout(r, 250));
ok(/\/eleve\?ferme=1/.test(el.url()), `retour à l’accueil (${el.url().replace(BASE, '')})`);
await el.waitForSelector('[data-closed]');
ok(await el.locator('[data-closed]').count() === 1, 'séance fermée, l’élève revient à son accueil avec un message neutre');

console.log('Côté serveur : le temps s’arrête au dernier geste (valeurs calculées à la main)');
const real = await (await b.newContext()).newPage();
await real.goto(BASE + '/connexion'); await real.fill('input[name=login]', 'lea'); await real.fill('input[name=password]', 'lea-test-1234');
await real.click('button[type=submit]'); await real.waitForURL(u => !u.pathname.startsWith('/connexion'));
const api = body => real.evaluate(b => fetch('/api/activity', { method: 'POST', body: JSON.stringify(b) }).then(r => r.json()), body);   // comme l'application
const { session } = await api({ action: 'start', kind: 'lesson', courseId: c.id });
ok(!!session, 'séance ouverte');
// 20 signaux de 30 s : les 8 premiers il y a plus de 10 min (4 min avec gestes), les 12 suivants dans les 10 dernières minutes (sans geste)
for (let i = 0; i < 20; i++) await sql`insert into activity_beats (session_id, student_id, active, seconds, gesture, at) values (${session}, ${st.id}, true, 30, ${i < 8}, now() - make_interval(secs => ${(20 - i) * 30 - 5}))`;
await sql`update work_sessions set active_seconds = 600, open_seconds = 600, gesture_seconds = 240, last_beat_at = now() where id = ${session}`;
await api({ action: 'end', session, active: false, abandoned: 360 });
const [ws] = await sql`select active_seconds, ended_at from work_sessions where id = ${session}`;
// signaux des 360 dernières secondes (12 à 30 s, dont le dernier à 25 s) retirés : il reste 8 × 30 = 240 s (+ le signal de fin, inactif)
ok(ws.active_seconds === 240 && ws.ended_at, `temps compté jusqu’au dernier geste : ${ws.active_seconds} s (attendu 240 s)`);
const [ev] = await sql`select data from activity_log where student_id = ${st.id} and event = 'seance_fermee_sans_reponse' order by id desc limit 1`;
ok(ev && ev.data.retire_s === 360, `consigné : ${ev?.data.retire_s} s sans geste non comptées`);

console.log('Réglage du parent');
const pa = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await pa.goto(BASE + '/connexion'); await pa.fill('input[name=login]', 'parent@test.local'); await pa.fill('input[name=password]', 'parent-test-1234');
await pa.click('button[type=submit]'); await pa.waitForURL(u => !u.pathname.startsWith('/connexion'));
await pa.goto(`${BASE}/parent/enfants/${st.id}?onglet=regles`);
const opts = await pa.locator('select[name=idle] option').allInnerTexts();
ok(opts.join('|') === '5 min sans rien toucher|10 min sans rien toucher|15 min sans rien toucher' && await pa.locator('select[name=idle]').inputValue() === '600', `choix 5, 10 ou 15 min, 10 min sélectionné (${opts.join(', ')})`);
console.log('Le texte suit le réglage choisi (15 min)');
await pa.selectOption('select[name=idle]', '900'); await pa.click('form:has(select[name=idle]) button[type=submit]');
for (let i = 0; i < 40 && (await sql`select settings->>'idle_seconds' as v from students where id = ${st.id}`)[0].v !== '900'; i++) await pa.waitForTimeout(250);
const [s15] = await sql`select settings->>'idle_seconds' as v from students where id = ${st.id}`;
ok(s15.v === '900', 'réglage enregistré : 15 min');
await pa.goto(BASE + '/parent/suivi');
ok((await pa.locator('[data-live]').innerText()).includes('rien touché depuis 15 min'), 'En direct : la définition dit 15 min');
ok((await pa.locator('[data-rythm]').innerText()).includes('100 %'), 'En direct : rythme du jour 100 % (240 s avec geste sur 240 s de travail)');
await el.clock.resume(); await el.goto(BASE + '/eleve');
ok((await el.locator('main').innerText()).includes('tu as 15 min sans rien toucher'), 'élève : « tu as 15 min sans rien toucher »');
ok(await pa.goto(BASE + '/parent/bilan').then(() => pa.locator('[data-rule-note]').count()) >= 1, 'Bilan : note sur le changement de mesure (minutes d’avant non comparables)');
await b.close(); await sql.end();
console.log('\nTemps de travail, brouillon compris : OK');
