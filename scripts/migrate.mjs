// Applique les migrations SQL de db/migrations dans l'ordre, une seule fois chacune.
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL manquant'); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations');

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map(r => r.name));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const body = fs.readFileSync(path.join(dir, f), 'utf8');
    await sql.begin(async tx => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${f})`;
    });
    console.log('Migration appliquée :', f);
  }
  console.log('Base à jour.');
} finally {
  await sql.end();
}
