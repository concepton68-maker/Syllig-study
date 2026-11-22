// Charge (ou met à jour) le catalogue d'un niveau depuis content/<niveau>/programme.json.
// Idempotent : peut être relancé après modification du programme.
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const EXCLUDED_SUBJECTS = new Set(['EPS']); // décision de cadrage : EPS hors programme suivi
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL manquant'); process.exit(1); }
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'content');
const levels = fs.readdirSync(root).filter(d => fs.existsSync(path.join(root, d, 'programme.json')));
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  for (const dir of levels) {
    const prog = JSON.parse(fs.readFileSync(path.join(root, dir, 'programme.json'), 'utf8'));
    const { code, name } = prog.level;
    let count = 0;
    await sql.begin(async tx => {
      await tx`insert into levels (code, name, general_sources) values (${code}, ${name}, ${tx.json(prog.general_sources ?? [])})
        on conflict (code) do update set name = excluded.name, general_sources = excluded.general_sources`;
      let sPos = 0, cPos = 0;
      for (const s of prog.subjects) {
        if (EXCLUDED_SUBJECTS.has(s.name)) continue;
        const [subj] = await tx`insert into subjects (level_code, name, position, official_sources) values (${code}, ${s.name}, ${++sPos}, ${tx.json(s.official_sources ?? [])})
          on conflict (level_code, name) do update set position = excluded.position, official_sources = excluded.official_sources returning id`;
        let chPos = 0;
        for (const ch of s.chapters) {
          const [chap] = await tx`insert into chapters (subject_id, name, position) values (${subj.id}, ${ch.name}, ${++chPos})
            on conflict (subject_id, name) do update set position = excluded.position returning id`;
          for (const c of ch.courses) {
            await tx`insert into courses (chapter_id, code, title, priority, position, official_note)
              values (${chap.id}, ${c.code ?? null}, ${c.title}, ${c.priority}, ${++cPos}, ${c.official_note ?? null})
              on conflict (chapter_id, title) do update set priority = excluded.priority, position = excluded.position,
                official_note = excluded.official_note, code = coalesce(courses.code, excluded.code)`;
            count++;
          }
        }
      }
    });
    console.log(`${name} : ${count} cours chargés.`);
  }
} finally {
  await sql.end();
}
