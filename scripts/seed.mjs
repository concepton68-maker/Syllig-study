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
    const { code, name, cycle = null, position = null } = prog.level;
    let count = 0;
    await sql.begin(async tx => {
      await tx`insert into levels (code, name, general_sources, cycle, position) values (${code}, ${name}, ${tx.json(prog.general_sources ?? [])}, ${cycle}, ${position ?? 0})
        on conflict (code) do update set name = excluded.name, general_sources = excluded.general_sources,
          cycle = coalesce(excluded.cycle, levels.cycle), position = coalesce(${position}, levels.position)`;
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

    // Bibliothèque de cours prêts (content/<niveau>/cours/*.json, validés par `npm run validate`) :
    // publiés automatiquement UNIQUEMENT pour les cours qui n'ont encore aucune version
    // (jamais d'écrasement du travail fait dans l'espace contenu).
    const dirCours = path.join(root, dir, 'cours');
    if (fs.existsSync(dirCours) && process.env.SEED_SANS_BIBLIOTHEQUE !== '1') {
      let published = 0, updated = 0;
      for (const f of fs.readdirSync(dirCours).filter(x => x.endsWith('.json')).sort()) {
        // un fichier illisible ou incomplet est signalé et ignoré : il ne doit jamais empêcher le site de démarrer
        let doc;
        try { doc = JSON.parse(fs.readFileSync(path.join(dirCours, f), 'utf8')); }
        catch (e) { console.warn(`  ${f} : fichier illisible, ignoré (${e.message})`); continue; }
        if (doc?.format !== 'syllig-course/1' || !doc.code || !doc.title || !doc.lesson || !doc.exercises || !doc.evaluation) {
          console.warn(`  ${f} : format incomplet, ignoré`); continue;
        }
        const [course] = await sql`
          select c.id from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
          where s.level_code = ${code} and (c.code = ${doc.code} or (s.name = ${doc.subject} and ch.name = ${doc.chapter} and c.title = ${doc.title}))
          order by (c.code = ${doc.code}) desc limit 1`;
        if (!course) { console.warn(`  ${f} : cours introuvable dans le programme (${doc.subject} › ${doc.chapter} › ${doc.title})`); continue; }
        try { await sql.begin(async tx => {
          await tx`select pg_advisory_xact_lock(${course.id})`;
          const [last] = await tx`select id, version, status, source_name, document from course_versions where course_id = ${course.id} order by version desc limit 1`;
          if (!last) {
            await tx`update courses set code = coalesce(code, ${doc.code}) where id = ${course.id}`;
            await tx`insert into course_versions (course_id, version, status, document, source_name, published_at)
              values (${course.id}, 1, 'published', ${tx.json(doc)}, ${'Bibliothèque Syllig · ' + f}, now())`;
            published++;
            return;
          }
          // correction d'un cours de la bibliothèque : nouvelle version publiée, seulement si la dernière version
          // vient elle-même de la bibliothèque (jamais par-dessus un import fait dans l'espace contenu)
          const fromLibrary = String(last.source_name ?? '').startsWith('Bibliothèque Syllig');
          if (!fromLibrary || last.status !== 'published') return;
          if (JSON.stringify(last.document) === JSON.stringify(JSON.parse(JSON.stringify(doc)))) return;
          const [{ same }] = await tx`select ${tx.json(doc)}::jsonb = ${last.document ? tx.json(last.document) : null}::jsonb as same`;
          if (same) return;
          await tx`update course_versions set status = 'archived' where id = ${last.id}`;
          await tx`insert into course_versions (course_id, version, status, document, source_name, published_at)
            values (${course.id}, ${last.version + 1}, 'published', ${tx.json(doc)}, ${'Bibliothèque Syllig · ' + f + ' (corrigé)'}, now())`;
          updated++;
        }); } catch (e) { console.warn(`  ${f} : non publié (${e.message})`); }
      }
      if (published) console.log(`  ${published} cours de la bibliothèque publiés.`);
      if (updated) console.log(`  ${updated} cours de la bibliothèque mis à jour (nouvelle version).`);
    }
  }
} finally {
  await sql.end();
}
