// Message hebdomadaire au parent (maquette validée le 27/11/2026) : faits de la semaine écoulée, un point à regarder, une idée ;
// sur l'Accueil et par e-mail. Faux serveur SMTP local (aucun e-mail réel). Valeurs attendues calculées à la main.
// Prérequis : tests/reset-db.sh puis `node scripts/seed.mjs`. Usage : BASE=… DATABASE_URL=… node tests/e2e-message.mjs
import { createRequire } from 'node:module';
import net from 'node:net';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };

// faux serveur SMTP : garde chaque message reçu
const mails = [];
const smtp = net.createServer(sock => {
  let data = false, buf = '', rcpt = [];
  sock.write('220 test\r\n');
  sock.on('data', chunk => {
    buf += chunk.toString('utf8');
    for (;;) {
      if (data) {
        const end = buf.indexOf('\r\n.\r\n'); if (end < 0) return;
        mails.push({ to: rcpt, raw: buf.slice(0, end) }); buf = buf.slice(end + 5); data = false; rcpt = []; sock.write('250 ok\r\n'); continue;
      }
      const i = buf.indexOf('\r\n'); if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (/^EHLO/i.test(line)) sock.write('250-test\r\n250 8BITMIME\r\n');
      else if (/^RCPT TO/i.test(line)) { rcpt.push(line.replace(/.*<|>.*/g, '')); sock.write('250 ok\r\n'); }
      else if (/^DATA/i.test(line)) { data = true; sock.write('354 go\r\n'); }
      else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
      else sock.write('250 ok\r\n');
    }
  });
});
await new Promise(r => smtp.listen(2525, '127.0.0.1', r));
// corps lisible (quoted-printable et soft breaks)
const body = m => m.raw.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\r\n/g, '\n');
const decode = s => Buffer.from(s, 'latin1').toString('utf8');

const [st] = await sql`select id from students limit 1`;
await sql`update students set level_code = 'troisieme-generale', created_at = now() - interval '30 days', settings = settings || '{"weekly_goal_minutes": 300}'::jsonb where id = ${st.id}`;
await sql`update student_years set level_code = 'troisieme-generale' where student_id = ${st.id}`;
const cs = await sql`select c.id, c.title, v.id as version_id, v.document as doc from courses c join course_versions v on v.course_id = c.id and v.status = 'published' where c.code in ('TG001', 'TG034') order by c.code`;
const [fr, ma] = cs;
// la semaine écoulée : lundi 0 h (heure de Paris) de la semaine dernière
const lm = sql`((date_trunc('week', now() at time zone 'Europe/Paris') - interval '7 days') at time zone 'Europe/Paris')`;
// lundi 40 min de leçon (finie), mardi 20 min d'exercices : 1 h, 2 jours
await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds) values
  (${st.id}, ${fr.id}, 'lesson', ${lm} + interval '10 hours', now(), now(), 2400, 2400),
  (${st.id}, ${ma.id}, 'exercises', ${lm} + interval '1 day 10 hours', now(), now(), 1200, 1200)`;
await sql`insert into course_progress (student_id, course_id, lesson_done_at) values (${st.id}, ${fr.id}, ${lm} + interval '10 hours 40 minutes')`;
// copie de maths notée 12/20 : la première question fausse, les autres sans réponse
const qs = ma.doc.evaluation.variants[0].sections.flatMap(s => s.questions);
const q1 = qs[0];
const wrong = q1.type === 'qcm' ? String((Number(Array.isArray(q1.answer) ? q1.answer[0] : q1.answer) + 1) % q1.options.length) : '999';
await sql`insert into eval_attempts (student_id, course_id, version_id, attempt_no, variant, status, started_at, deadline_at, submitted_at, answers, scores, final_score)
  values (${st.id}, ${ma.id}, ${ma.version_id}, 1, 0, 'graded', ${lm} + interval '2 days 18 hours', ${lm} + interval '2 days 18 hours 30 minutes', ${lm} + interval '2 days 18 hours 20 minutes',
    ${sql.json({ [q1.id]: wrong })}, ${sql.json({ [q1.id]: 0 })}, 12)`;
// révisions : 4 justes sur 5
const [rs] = await sql`insert into review_sessions (student_id, questions, created_at, finished_at) values (${st.id}, '[]', ${lm} + interval '3 days', ${lm} + interval '3 days') returning id`;
await sql`insert into review_results (student_id, course_id, session_id, at, ok, total, gap_days, passed, next_days) values (${st.id}, ${fr.id}, ${rs.id}, ${lm} + interval '3 days', 4, 5, 1, true, 3)`;

const b = await chromium.launch();
const login = async (user, pass) => {
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  p.errs = []; p.on('pageerror', e => { if (!/#418/.test(e.message)) p.errs.push(e.message.slice(0, 80)); });
  await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', user); await p.fill('input[name=password]', pass);
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/connexion'));
  return p;
};

console.log('Administrateur : service d’envoi');
const ad = await login('admin@test.local', 'admin-test-1234');
await ad.goto(BASE + '/contenu/emails');
await ad.fill('input[name=host]', '127.0.0.1'); await ad.fill('input[name=port]', '2525'); await ad.fill('input[name=user]', '');
await ad.fill('input[name=from]', 'Syllig Study <test@syllig.local>');
await ad.click('button:has-text("Enregistrer")'); await ad.waitForSelector('text=Réglages enregistrés');
await ad.reload();
await ad.fill('input[name=to]', 'admin@exemple.fr'); await ad.click('button:has-text("Envoyer")'); await ad.waitForSelector('text=E-mail d’essai envoyé');
ok(mails.some(m => m.to.includes('admin@exemple.fr')), 'e-mail d’essai reçu');

console.log('Parent : adresse et message d’essai');
const pa = await login('parent@test.local', 'parent-test-1234');
await pa.goto(BASE + '/compte');
await pa.fill('[data-weekly-form] input[name=email]', 'parent@exemple.fr');
await pa.click('[data-weekly-form] button:has-text("M’envoyer un message d’essai")');
await pa.waitForSelector('[data-weekly-form] [role=status]');
const toParent = () => mails.filter(m => m.to.includes('parent@exemple.fr'));
ok(toParent().length >= 1, 'message du lundi reçu par le parent');
const raw = body(toParent()[0]);
const txt = raw;
const subjRaw = (toParent()[0].raw.match(/^Subject: ([\s\S]*?)\r\n(?=\S)/m) || [])[1] || '';
const subject = subjRaw.replace(/\r\n\s+/g, '').replace(/=\?UTF-8\?Q\?(.*?)\?=\s*/gi, (_, x) => Buffer.from(x.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (__, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8'));
ok(subject === 'La semaine de Léa : 1 h de travail, 2 jours sur 7', `objet : « ${subject} »`);
const t = decode(txt);
ok(t.includes('Temps de travail : 1 h / objectif 5 h') && t.includes('Jours travaillés (10 min ou plus) : 2 sur 7') && t.includes('Leçons finies : 1'), 'faits : 1 h sur 5 h, 2 jours, 1 leçon finie');
ok(t.includes(`Évaluation notée : 12/20 · ${ma.title}`) && t.includes('Révisions : 4 justes sur 5'), 'évaluation 12/20 et révisions 4 sur 5');
ok(t.includes(`${qs.length - 1} questions sans réponse et 1 fausse`) && /\/parent\/revoir\/copie\//.test(t), `point à regarder : ${qs.length - 1} sans réponse et 1 fausse, avec le lien « Revoir la copie »`);
ok(t.includes('Une idée : Demandez-lui de vous expliquer comment répondre'), 'une idée liée à la question fausse');
ok(!/bâcl|paresse|motivation|sérieux|concentration/i.test(t), 'aucune interprétation');
const unsub = (t.match(/https?:\/\/\S*\/desabonnement\?u=[^\s&]+&t=[\w-]+/) || [])[0];
ok(!!unsub && /List-Unsubscribe:/i.test(raw), 'lien de désabonnement (et en-tête List-Unsubscribe)');

console.log('Pas d’envoi en double');
const n = toParent().length;
await new Promise(r => setTimeout(r, 4000));
ok(toParent().length === n, 'la file de tâches ne renvoie pas un message déjà envoyé');

console.log('Accueil');
await pa.goto(BASE + '/parent');
const card = (await pa.locator('[data-weekly]').innerText()).replace(/\s+/g, ' ');
ok(card.includes('2 sur 7') && card.includes('12/20') && card.includes('4 justes sur 5'), 'le même message en haut de l’Accueil');
ok(await pa.locator('[data-weekly-point] a[href^="/parent/revoir/copie/"]').count() === 1, '« Revoir la copie » depuis l’Accueil');
await pa.click('text=Messages précédents'); await pa.waitForURL(/\/parent\/messages/);
ok(await pa.locator('[data-weekly]').count() === 1, 'page des messages précédents');

console.log('Désabonnement');
const local = unsub.replace(/^https?:\/\/[^/]+/, BASE);
await pa.goto(local);
ok(await pa.locator('[data-unsubscribed="oui"]').count() === 1, 'lien signé : désabonné sans se connecter');
const [u] = await sql`select weekly_email from users where login = 'parent@test.local'`;
ok(u.weekly_email === false, 'plus d’e-mail le lundi');
await pa.goto(BASE + '/desabonnement?u=' + '00000000-0000-0000-0000-000000000000' + '&t=faux');
ok(await pa.locator('[data-unsubscribed="non"]').count() === 1, 'un lien falsifié est refusé');
for (const p of [ad, pa]) ok(p.errs.length === 0, `aucune erreur JS (${p.errs.join(' | ')})`);
await b.close(); await sql.end(); smtp.close();
console.log('\nMessage hebdomadaire : OK');
