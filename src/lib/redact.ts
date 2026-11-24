import 'server-only';
import { sql } from './db';

// Minimisation (RGPD) : avant tout envoi à une IA, on retire des textes de l'élève ce qui pourrait l'identifier.
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?:(?:\+|00)33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/g;
const ADDRESS = /\b\d{1,4}\s?(?:bis|ter)?,?\s+(?:rue|avenue|av\.|boulevard|bd|chemin|all[ée]e|place|impasse|route|quai|cours|square|r[ée]sidence)\b[^,.;\n]{0,60}/gi;
const POSTCODE = /\b\d{5}\s+[A-ZÉÈ][\w'’ -]{2,40}/g;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function redact(text: string, names: string[]): string {
  let t = (text ?? '').replace(EMAIL, '[e-mail]').replace(PHONE, '[téléphone]').replace(ADDRESS, '[adresse]').replace(POSTCODE, '[ville]');
  for (const n of names.map(x => x.trim()).filter(x => x.length >= 2).sort((a, b) => b.length - a.length))
    t = t.replace(new RegExp(`(^|[^\\p{L}])${esc(n)}(?=$|[^\\p{L}])`, 'giu'), '$1[prénom]');
  return t;
}

// Noms à masquer pour un élève : son prénom, son identifiant, les noms des adultes de son foyer (prénoms et noms séparés)
export async function namesFor(studentId: string): Promise<string[]> {
  const rows = await sql<{ n: string }[]>`
    select s.first_name as n from students s where s.id = ${studentId}
    union select u.login from students s join users u on u.id = s.user_id where s.id = ${studentId}
    union select u.display_name from household_members m join users u on u.id = m.user_id where m.household_id = (select household_id from students where id = ${studentId})`;
  return [...new Set(rows.flatMap(r => [r.n, ...r.n.split(/[\s-]+/)]).filter(x => x && !x.includes('@') && x.length >= 2))];
}
