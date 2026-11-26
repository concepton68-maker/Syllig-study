// « Passer cette leçon » : l'élève peut passer un cours pour n'importe quelle raison et aller au suivant, sans aucune sanction
// (ni points en moins, ni niveau changé) ; il y revient quand il veut ; le parent le voit, en fait neutre, dans l'Activité.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-passer.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale' where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const points = async () => (await sql`select coalesce(sum(amount), 0)::int as n from points_ledger where student_id = ${st.id}`)[0].n;

const b = await chromium.launch();
const login = async (user, pass, vp) => {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  p.errs = []; p.on('pageerror', e => { if (!/#418/.test(e.message)) p.errs.push(e.message.slice(0, 80)); });
  p.on('dialog', d => { p.errs.push('fenêtre native'); d.dismiss(); });
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', user); await p.fill('input[name=password]', pass);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
  return p;
};
const el = await login('lea', 'lea-test-1234', { width: 390, height: 844 });
await el.goto(BASE + '/eleve');
const first = (await el.locator('main h2').first().innerText()).trim();
const p0 = await points();

console.log('Depuis l’accueil');
await el.click('[data-skip]');
await el.waitForURL(/passee=/);
ok((await el.locator('[data-skipped]').innerText()).includes(first), `message neutre : « ${first} » t’attend dans Tous mes cours`);
const second = (await el.locator('main h2').first().innerText()).trim();
ok(second !== first, `le cours suivant est proposé (« ${second} »)`);
const [c1] = await sql`select c.id, p.skipped_at, p.mastery from courses c join course_progress p on p.course_id = c.id and p.student_id = ${st.id} where c.title = ${first}`;
ok(!!c1.skipped_at && c1.mastery === 0 && await points() === p0, 'aucune sanction : mêmes points, même niveau');
const [ev] = await sql`select count(*)::int as n from activity_log where student_id = ${st.id} and event = 'lecon_passee' and course_id = ${c1.id}`;
ok(ev.n === 1, 'consigné dans le journal');
await el.goto(BASE + '/eleve/parcours');
ok(await el.locator('[data-skipped-pill]').count() === 1, '« Passée pour l’instant » dans Tous mes cours');

console.log('Depuis la leçon');
const [c2] = await sql`select id from courses where title = ${second}`;
await el.goto(`${BASE}/eleve/cours/${c2.id}/lecon`);
await el.click('[data-skip]');
await el.waitForURL(/\/eleve\?passee=/);
const third = (await el.locator('main h2').first().innerText()).trim();
ok(third !== first && third !== second, `encore le suivant (« ${third} »)`);

console.log('Retour sur un cours passé');
await el.goto(`${BASE}/eleve/cours/${c1.id}/lecon`);
await el.waitForTimeout(2500);
const [back] = await sql`select skipped_at from course_progress where student_id = ${st.id} and course_id = ${c1.id}`;
ok(back.skipped_at === null, 'en rouvrant la leçon, le cours reprend sa place normale');

console.log('Côté parent');
const pa = await login('parent@test.local', 'parent-test-1234', { width: 1366, height: 900 });
await pa.goto(BASE + '/parent/journal');
const tl = (await pa.locator('main').innerText()).replace(/\s+/g, ' ');
ok(tl.includes('passée pour l’instant') && tl.includes(first), 'Activité : « passée pour l’instant », sans jugement');
ok(!/abandon|sanction|refus/i.test(tl), 'aucun mot négatif');
for (const p of [el, pa]) ok(p.errs.length === 0, `aucune erreur JS ni fenêtre native (${p.errs.join(' | ')})`);
await b.close(); await sql.end();
console.log('\nPasser une leçon : OK');
