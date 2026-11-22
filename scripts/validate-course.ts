// Vérifie un ou plusieurs fichiers de cours sans rien importer :
//   npm run validate -- content/seconde-generale/cours/C001.json
import fs from 'node:fs';
import { validateCourse } from '../src/lib/course-format';

let failed = false;
for (const f of process.argv.slice(2)) {
  const r = validateCourse(JSON.parse(fs.readFileSync(f, 'utf8')));
  console.log(`\n${f} : ${r.ok ? 'VALIDE' : 'REFUSÉ'}`);
  if (!r.ok) { failed = true; r.errors.forEach(e => console.log('  ✗', e)); }
  r.warnings.forEach(w => console.log('  ·', w));
}
process.exit(failed ? 1 : 0);
