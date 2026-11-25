// Actions groupées : publier plusieurs brouillons, réordonner plusieurs cours, réinitialiser plusieurs cours.
// Prérequis : base de test (tests/reset-db.sh) + e2e-parcours.mjs déjà passé (C001 publié et travaillé).
// Usage : BASE=http://127.0.0.1:3100 DATABASE_URL=… node tests/e2e-actions-groupees.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

// deux brouillons de plus (C002, C003), copiés de C001
const [src] = await sql`select v.document, v.imported_by from course_versions v join courses c on c.id = v.course_id where c.code = 'C001' and v.status = 'published'`;
const others = await sql`select c.id, 'C00' || (row_number() over (order by c.position) + 1) as code, c.title from courses c
  join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
  where s.level_code = (select s2.level_code from courses c2 join chapters ch2 on ch2.id = c2.chapter_id join subjects s2 on s2.id = ch2.subject_id where c2.code = 'C001')
    and c.code is distinct from 'C001' order by c.position limit 2`;
for (const c of others) await sql`insert into course_versions (course_id, version, status, document, source_name, imported_by)
  values (${c.id}, 1, 'draft', ${sql.json({ ...src.document, code: c.code, title: c.title })}, 'test', ${src.imported_by})`;

const b = await chromium.launch();
const login = async (l, pw) => { const p = await (await b.newContext()).newPage(); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion')); return p; };

console.log('Contenu · publier la sélection');
const ad = await login('admin@test.local', 'admin-test-1234');
await ad.goto(BASE + '/contenu/a-relire');
await ad.getByLabel('Tout sélectionner').check();
await ad.getByRole('button', { name: /Publier la sélection \(2\)/ }).click();
await ad.click('[data-dialog-ok]');   // fenêtre de confirmation de l’application
await ad.waitForLoadState('networkidle');
const [{ n: pub }] = await sql`select count(*)::int as n from course_versions v join courses c on c.id = v.course_id where c.id in ${sql(others.map(o => o.id))} and v.status = 'published'`;
ok(pub === 2, '2 brouillons publiés d’un coup');

console.log('Parent · ordre du parcours groupé');
const pa = await login('parent@test.local', 'parent-test-1234');
const [st] = await sql`select id from students limit 1`;
await pa.goto(`${BASE}/parent/enfants/${st.id}?onglet=cours`);
for (const t of others) await pa.getByLabel(`Sélectionner ${t.title}`).last().check();
await pa.locator('select[name=forced][form], form#bulk-ordre select[name=forced]').first().selectOption('now');
await pa.getByRole('button', { name: /Appliquer à la sélection \(2\)/ }).click();
await pa.waitForLoadState('networkidle'); await pa.waitForTimeout(500);
const forced = await sql`select count(*)::int as n from course_progress where student_id = ${st.id} and forced = 'now'`;
ok(forced[0].n === 2, '2 cours passés « À faire en premier »');

console.log('Parent · réinitialiser plusieurs cours');
// marquer les 2 cours comme commencés (leçon faite)
await sql`update course_progress set lesson_done_at = now(), mastery = 1 where student_id = ${st.id} and course_id in ${sql(others.map(o => o.id))}`;
await pa.goto(`${BASE}/parent/enfants/${st.id}?onglet=cours`);
await pa.locator('form#bulk-reset').getByLabel('Tout sélectionner').check();
await pa.getByRole('button', { name: /Réinitialiser la sélection \(3\)/ }).click();
await pa.click('[data-dialog-ok]');   // fenêtre de confirmation de l’application
await pa.waitForURL(/groupe=3/);
ok(await pa.getByText("3 cours remis à zéro.").isVisible(), 'message « 3 cours remis à zéro » (C001 + les 2 nouveaux)');
const left = await sql`select count(*)::int as n from eval_attempts where student_id = ${st.id}`;
ok(left[0].n === 0, 'plus aucune tentative d’évaluation comptée');

await b.close(); await sql.end();
console.log('Actions groupées : OK');
