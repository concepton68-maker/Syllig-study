// À lancer après e2e-parcours.mjs : le parent réinitialise le cours C001, puis tout le parcours.
import { createRequire } from 'node:module';
import postgres from 'postgres';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) throw new Error('ÉCHEC : ' + m); console.log('  ✓', m); };
const count = async (t) => (await sql.unsafe(`select count(*)::int as n from ${t}`))[0].n;
const b = await chromium.launch();
try {
  const p = await (await b.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
  p.on('dialog', d => d.accept());
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', 'parent@test.local'); await p.fill('input[name=password]', 'parent-test-1234');
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
  ok(await count('eval_attempts') > 0, 'avant : des tentatives d’évaluation existent');
  // révisions espacées sur ce cours : elles doivent disparaître avec la réinitialisation
  const [cp] = await sql`select student_id, course_id from course_progress limit 1`;
  const [rs] = await sql`insert into review_sessions (student_id, questions, finished_at) values (${cp.student_id}, '[]', now()) returning id`;
  await sql`insert into review_items (session_id, idx, student_id, course_id, key, correct) values (${rs.id}, 0, ${cp.student_id}, ${cp.course_id}, 'ex:a', true)`;
  await sql`insert into review_results (student_id, course_id, session_id, ok, total, gap_days, passed, next_days) values (${cp.student_id}, ${cp.course_id}, ${rs.id}, 1, 1, 1, true, 3)`;
  await sql`insert into review_schedule (student_id, course_id, step, due_at) values (${cp.student_id}, ${cp.course_id}, 1, now() + interval '3 days') on conflict do nothing`;
  await p.goto(BASE + '/parent/enfants'); await p.click('text=Ouvrir la fiche');
  await p.waitForSelector('text=Cours commencés');
  await p.click('button:has-text("Réinitialiser…")');
  await p.click('button:has-text("Oui, réinitialiser ce cours")');
  await p.waitForSelector('text=est remis à zéro');
  ok(await count('eval_attempts') === 0 && await count('course_progress') === 0 && await count('points_ledger') === 0, 'cours réinitialisé : tentatives, progression et points effacés');
  ok(await count('review_results') === 0 && await count('review_items') === 0 && await count('review_schedule') === 0 && await count('review_sessions') === 0, 'révisions du cours effacées aussi (résultats, réponses, calendrier)');
  const [{ n }] = await sql`select count(*)::int as n from activity_log where event = 'cours_reinitialise'`;
  ok(n === 1, 'la réinitialisation est tracée dans le journal');
  const [chk] = await sql`select broken_ids from verify_activity_chain((select id from students limit 1))`;
  ok(chk.broken_ids.length === 0, 'journal toujours intact');
  // confirmation par le prénom obligatoire
  await p.click('nav >> text=Repartir de zéro');
  await p.fill('input[name=confirm]', 'mauvais');
  await p.click('button:has-text("Réinitialiser tout le parcours")');
  await p.waitForSelector('text=Pour confirmer, tapez exactement');
  ok(true, 'réinitialisation complète refusée sans le bon prénom');
  await p.fill('input[name=confirm]', 'Léa'); await p.check('label:has-text("Effacer aussi le journal") input[type=checkbox]');
  await p.fill('input[name=password]', 'mauvais-mot-de-passe');
  await p.click('button:has-text("Réinitialiser tout le parcours")');
  await p.waitForSelector('text=saisissez votre mot de passe');
  ok(true, 'effacement du journal refusé sans le mot de passe du parent');
  await p.fill('input[name=password]', 'parent-test-1234');
  await p.click('button:has-text("Réinitialiser tout le parcours")');
  await p.waitForSelector('text=est revenu à zéro');
  const [{ m }] = await sql`select count(*)::int as m from activity_log`;
  ok(await count('work_sessions') === 0 && m === 1, 'parcours réinitialisé, journal effacé à la demande (une seule trace de réinitialisation)');
  console.log('\nRéinitialisations : OK');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await b.close(); await sql.end(); }
