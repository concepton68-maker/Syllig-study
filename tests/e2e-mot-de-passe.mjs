// Mot de passe oublié : élève (→ parent, « À faire »), parent (→ administrateur, lien à usage unique), changement de son propre mot de passe.
// Prérequis : tests/reset-db.sh. Usage : BASE=… DATABASE_URL=… node tests/e2e-mot-de-passe.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const ok = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } console.log('  ✓', m); };
const saved = await sql`select id, password_hash from users`;        // remis en l'état à la fin (pour les autres tests)
await sql`delete from password_requests`; await sql`delete from login_attempts`;

const b = await chromium.launch();
const ctx = async (mobile) => (await b.newContext(mobile ? { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 800 } })).newPage();
const login = async (p, l, pw) => { await p.goto(BASE + '/connexion'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw); await p.click('button[type=submit]');
  await p.waitForURL(u => !u.pathname.startsWith('/connexion'), { timeout: 5000 }).catch(() => null); return !new URL(p.url()).pathname.startsWith('/connexion'); };
const errs = [];
const watch = p => { p.on('pageerror', e => errs.push(`${p.url()} : ${e.message.slice(0, 80)}`)); p.on('dialog', d => { if (p.allowDialog) return d.accept(); errs.push('fenêtre native : ' + d.message()); d.dismiss(); }); return p; };

console.log('Élève');
const el = watch(await ctx(true));
await el.goto(BASE + '/connexion');
await el.click('text=Mot de passe oublié ?');
await el.fill('input[name=login]', 'lea'); await el.click('button:has-text("Demander un nouveau mot de passe")');
await el.waitForSelector('text=Demande envoyée');
ok((await sql`select 1 from password_requests r join users u on u.id = r.user_id where u.login = 'lea' and r.done_at is null`).length === 1, 'l’élève demande un nouveau mot de passe depuis la page de connexion');
await el.goto(BASE + '/connexion/oubli'); await el.fill('input[name=login]', 'personne-inconnue'); await el.click('button:has-text("Demander")');
await el.waitForSelector('text=Demande envoyée');
ok((await sql`select count(*)::int as n from password_requests`)[0].n === 1, 'identifiant inconnu : même réponse, rien n’est enregistré (on ne révèle pas les comptes)');

const pa = watch(await ctx(false));
ok(await login(pa, 'parent@test.local', 'parent-test-1234'), 'le parent se connecte');
ok(/À faire\s*1|À faire1/.test((await pa.textContent('nav')).replace(/\s+/g, ' ')) || (await pa.locator('nav a[href="/parent/a-faire"]').innerText()).includes('1'), 'pastille « À faire » : 1');
await pa.goto(BASE + '/parent/a-faire');
await pa.waitForSelector('text=Léa a oublié son mot de passe');
ok(true, '« À faire » : « Léa a oublié son mot de passe »');
const row = pa.locator('div:has(> span > strong:text("Léa a oublié son mot de passe"))');
await row.locator('input[name=password]').fill('lea-nouveau-5678'); await row.locator('button:has-text("Enregistrer")').click();
await pa.waitForSelector('text=Mot de passe de Léa modifié');
ok((await sql`select count(*)::int as n from password_requests where done_at is null`)[0].n === 0, 'le parent choisit un nouveau mot de passe : la demande est réglée');
ok(await login(el, 'lea', 'lea-nouveau-5678'), 'l’élève se connecte avec son nouveau mot de passe');

console.log('Parent');
const pb = watch(await ctx(true));
await pb.goto(BASE + '/connexion/oubli'); await pb.fill('input[name=login]', 'parent@test.local'); await pb.click('button:has-text("Demander")');
await pb.waitForSelector('text=Demande envoyée');
const ad = watch(await ctx(false));
ok(await login(ad, 'admin@test.local', 'admin-test-1234'), 'l’administrateur se connecte');
await ad.goto(BASE + '/contenu/comptes');
await ad.waitForSelector('h2:text("Mots de passe oubliés")');
const reqs = ad.locator('section:has(h2:text("Mots de passe oubliés"))');
await reqs.locator('button:has-text("Créer un lien de nouveau mot de passe")').click();
const link = (await reqs.locator('code:has-text("/connexion/nouveau")').innerText({ timeout: 5000 })).trim();
ok(link.includes('/connexion/nouveau?jeton='), 'l’administrateur crée un lien à usage unique');
await pb.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
await pb.fill('input[name=password]', 'parent-nouveau-9999'); await pb.fill('input[name=confirm]', 'pas-pareil-9999'); await pb.click('button:has-text("Enregistrer")');
await pb.waitForSelector('text=ne sont pas identiques');
ok(true, 'les deux saisies différentes sont refusées');
await pb.fill('input[name=password]', 'parent-nouveau-9999'); await pb.fill('input[name=confirm]', 'parent-nouveau-9999'); await pb.click('button:has-text("Enregistrer")');
await pb.waitForURL(u => u.pathname.startsWith('/parent'));
ok(true, 'le parent choisit son mot de passe et arrive connecté dans son espace');
await pa.goto(BASE + '/parent'); ok(new URL(pa.url()).pathname.startsWith('/connexion'), 'ses anciennes sessions sont fermées');
await pb.goto(link.replace(/^https?:\/\/[^/]+/, BASE)); await pb.waitForSelector('text=Lien expiré');
ok(true, 'le lien ne sert qu’une fois');
ok(!(await login(pa, 'parent@test.local', 'parent-test-1234')) && await login(pa, 'parent@test.local', 'parent-nouveau-9999'), 'ancien mot de passe refusé, nouveau accepté');
ok((await sql`select count(*)::int as n from password_requests where done_at is null`)[0].n === 0, 'la demande disparaît de la liste de l’administrateur');

console.log('Changer son mot de passe');
await pa.click('a[aria-label="Mon mot de passe"] >> visible=true');
await pa.waitForURL(/\/compte/);
await pa.fill('input[name=current]', 'mauvais'); await pa.fill('input[name=password]', 'parent-test-1234'); await pa.fill('input[name=confirm]', 'parent-test-1234');
await pa.click('button:has-text("Changer mon mot de passe")'); await pa.waitForSelector('text=Mot de passe actuel incorrect');
ok(true, 'mot de passe actuel exigé');
await pa.fill('input[name=current]', 'parent-nouveau-9999'); await pa.fill('input[name=password]', 'parent-test-1234'); await pa.fill('input[name=confirm]', 'parent-test-1234');
await pa.click('button:has-text("Changer mon mot de passe")'); await pa.waitForSelector('text=Mot de passe modifié');
await pa.goto(BASE + '/parent'); ok(new URL(pa.url()).pathname.startsWith('/parent'), 'mot de passe changé, la session en cours reste ouverte');
const sc = watch(await ctx(true));
ok(await login(sc, 'lea', 'lea-nouveau-5678'), 'téléphone 360 px : connexion');
await sc.waitForSelector('.mobile-bar');
const bar = await sc.evaluate(() => { const h = document.querySelector('.mobile-bar'); return h ? h.scrollWidth <= h.clientWidth + 1 : true; });
ok(bar && await sc.locator('.mobile-bar a[aria-label="Mon mot de passe"]').isVisible(), 'téléphone 360 px : la clé « Mon mot de passe » tient dans la barre du haut');

await sql`insert into user_roles select id, 'admin' from users where login = 'parent@test.local' on conflict do nothing`;   // compte parent + Contenu
const sd = watch(await ctx(true));
ok(await login(sd, 'parent@test.local', 'parent-test-1234'), 'téléphone 360 px : compte à deux espaces');
await sd.waitForSelector('.mobile-bar .space-switch');
const fits = await sd.evaluate(() => { const h = document.querySelector('.mobile-bar'); return `${h.scrollWidth}/${h.clientWidth}`; });
ok(fits.split('/')[0] <= fits.split('/')[1] && await sd.locator('.mobile-bar a[aria-label="Mon mot de passe"]').isVisible(), `téléphone 360 px, deux espaces : la barre du haut ne déborde pas (${fits})`);
await sql`delete from user_roles where role = 'admin' and user_id = (select id from users where login = 'parent@test.local')`;

console.log('Vue administrateur : familles et comptes');
await ad.goto(BASE + '/contenu/comptes');
const fam = await ad.locator('section[aria-labelledby="familles"]').innerText();
ok(fam.includes('Identifiant : parent@test.local') && fam.includes('Identifiant : lea') && /Léa\s*·\s*\S/.test(fam), 'l’administrateur voit les parents et les élèves avec leurs identifiants et le niveau');
const leaRow = ad.locator('section[aria-labelledby="familles"] div.border-soft:has(code:text-is("lea"))');
await leaRow.locator('button:has-text("Lien nouveau mot de passe")').click();
const leaLink = (await leaRow.locator('code:has-text("/connexion/nouveau")').innerText({ timeout: 5000 })).trim();
const sl = watch(await ctx(true)); await sl.goto(leaLink.replace(/^https?:\/\/[^/]+/, BASE));
await sl.fill('input[name=password]', 'lea-lien-2468'); await sl.fill('input[name=confirm]', 'lea-lien-2468'); await sl.click('button:has-text("Enregistrer")');
await sl.waitForURL(u => u.pathname.startsWith('/eleve'));
ok(true, 'lien de nouveau mot de passe créé par l’administrateur pour un compte élève : l’élève arrive connectée');
await ad.goto(BASE + '/contenu/comptes');
await ad.locator('section[aria-labelledby="familles"] input[aria-label="Sélectionner Léa"]').check();
ad.allowDialog = true;   // espace Contenu : confirmation des actions groupées
await ad.click('button:has-text("Déconnecter de tous les appareils")');
await ad.waitForLoadState('networkidle');
await sl.goto(BASE + '/eleve'); ok(new URL(sl.url()).pathname.startsWith('/connexion'), 'action groupée « Déconnecter de tous les appareils » : l’élève doit se reconnecter');

ok(errs.length === 0, `aucune erreur JavaScript ni fenêtre native (${errs.join(' | ') || 'aucune'})`);
for (const u of saved) await sql`update users set password_hash = ${u.password_hash} where id = ${u.id}`;
await sql`delete from login_attempts`;
await b.close(); await sql.end();
console.log('Mot de passe oublié : OK');
