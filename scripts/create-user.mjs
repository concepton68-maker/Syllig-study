// Création des comptes (pas d'inscription publique en v1).
// Interactif : node scripts/create-user.mjs admin | family
// Les mots de passe sont demandés sans être affichés (rien dans l'historique du serveur).
// Non interactif (tests) : --login … --name … --password … ou, pour un foyer,
//   --parent-login --parent-name --parent-password --student-first-name --student-login --student-password [--level] [--household]
import readline from 'node:readline';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const [, , kind, ...rest] = process.argv;
const args = {};
for (let i = 0; i < rest.length; i += 2) args[rest[i].replace(/^--/, '')] = rest[i + 1];

function ask(question, { hidden = false } = {}) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = s => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, a => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
  });
}
async function get(key, question, opts = {}) {
  if (args[key]) return args[key];
  for (;;) {
    const v = await ask(question, opts);
    if (!opts.hidden) { if (v) return v; continue; }
    if (v.length < 8) { console.log('  8 caractères minimum.'); continue; }
    const again = await ask('  Confirmer le mot de passe : ', { hidden: true });
    if (again === v) return v;
    console.log('  Les deux saisies diffèrent, recommence.');
  }
}
const hash = p => { if (p.length < 8) { console.error('Mot de passe : 8 caractères minimum'); process.exit(1); } return bcrypt.hashSync(p, 12); };

if (!['admin', 'family', 'add-role'].includes(kind)) { console.error('Usage : node scripts/create-user.mjs admin | family | add-role'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  if (kind === 'add-role') {
    // donne un rôle de plus à un compte existant (ex. le parent devient aussi administrateur du contenu)
    const login = (await get('login', '  E-mail du compte existant : ')).toLowerCase();
    const role = await get('role', '  Rôle à ajouter (admin ou parent) : ');
    if (!['admin', 'parent'].includes(role)) throw new Error('Rôle attendu : admin ou parent');
    const [u] = await sql`select id, role from users where login = ${login}`;
    if (!u) throw new Error('Compte introuvable : ' + login);
    if (u.role === 'student') throw new Error('Un compte élève ne peut pas recevoir d’autre rôle.');
    await sql`insert into user_roles (user_id, role) values (${u.id}, ${role}) on conflict do nothing`;
    console.log(`Rôle « ${role} » ajouté à ${login}. Il peut basculer d’espace depuis la barre du haut.`);
  } else if (kind === 'admin') {
    console.log('Compte administrateur (gestion des cours)');
    const login = (await get('login', '  E-mail : ')).toLowerCase();
    const name = await get('name', '  Prénom : ');
    const pw = await get('password', '  Mot de passe : ', { hidden: true });
    await sql`insert into users (login, password_hash, display_name, role) values (${login}, ${hash(pw)}, ${name}, 'admin')`;
    console.log('Administrateur créé :', login);
  } else {
    console.log('Foyer : un parent et un premier enfant (d’autres enfants s’ajoutent ensuite depuis l’espace parent)');
    const pLogin = (await get('parent-login', '  E-mail du parent : ')).toLowerCase();
    const pName = await get('parent-name', '  Prénom du parent : ');
    const pPw = await get('parent-password', '  Mot de passe du parent : ', { hidden: true });
    const sFirst = await get('student-first-name', '  Prénom de l’élève : ');
    const sLogin = (await get('student-login', '  Identifiant de l’élève (ex. lea) : ')).toLowerCase();
    const sPw = await get('student-password', '  Mot de passe de l’élève : ', { hidden: true });
    const level = args.level ?? 'seconde-generale';
    await sql.begin(async tx => {
      const [h] = await tx`insert into households (name) values (${args.household ?? 'Famille de ' + sFirst}) returning id`;
      const [p] = await tx`insert into users (login, password_hash, display_name, role) values (${pLogin}, ${hash(pPw)}, ${pName}, 'parent') returning id`;
      const [s] = await tx`insert into users (login, password_hash, display_name, role) values (${sLogin}, ${hash(sPw)}, ${sFirst}, 'student') returning id`;
      await tx`insert into household_members values (${h.id}, ${p.id}, 'parent'), (${h.id}, ${s.id}, 'student')`;
      await tx`insert into students (household_id, user_id, first_name, level_code) values (${h.id}, ${s.id}, ${sFirst}, ${level})`;
    });
    console.log(`Foyer créé. Parent : ${pLogin} · Élève : ${sLogin}`);
  }
} catch (e) {
  console.error(e.code === '23505' ? 'Cet identifiant existe déjà.' : e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
