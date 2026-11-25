import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { sql } from './db';
import { logEvent } from './activity';
import { placementQuestion, type ReportData } from './report';

// Test de rentrée : un test de positionnement écrit à l'avance pour chaque classe (content/<niveau>/positionnement.json),
// sur les bases des années précédentes. Proposé dès l'arrivée d'un enfant, corrigé automatiquement, sans IA ni donnée envoyée.
type Bank = { consigne_eleve: string; duree_min: number; questions: ReportData['test_positionnement']['questions'] };

export function entryBank(levelCode: string): Bank | null {
  if (!/^[a-z0-9-]+$/.test(levelCode)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', levelCode, 'positionnement.json'), 'utf8')) as Bank; }
  catch { return null; }
}

export async function assignEntryTest(studentId: string, actorId: string | null): Promise<{ ok: true; questions: number } | { error: string }> {
  const [st] = await sql<{ level_code: string }[]>`select level_code from students where id = ${studentId}`;
  if (!st) return { error: 'Élève introuvable.' };
  const [open] = await sql`select 1 from placement_tests where student_id = ${studentId} and status <> 'termine'`;
  if (open) return { error: 'Un test de positionnement est déjà proposé : attendez qu’il soit fait (ou retirez-le).' };
  const bank = entryBank(st.level_code);
  if (!bank) return { error: 'Pas encore de test de rentrée pour cette classe.' };
  const items = bank.questions.map(placementQuestion).filter(q => q !== null);
  if (items.length < 5) return { error: 'Test de rentrée inutilisable pour cette classe.' };
  const duration = Math.min(45, Math.max(15, Math.round(bank.duree_min || items.length * 1.25)));
  await sql`insert into placement_tests (student_id, report_id, created_by, questions, duration_min, total)
    values (${studentId}, null, ${actorId}, ${sql.json({ consigne: bank.consigne_eleve, items, entree: true })}, ${duration}, ${items.length})`;
  await logEvent(studentId, 'positionnement_propose', { actorId, data: { questions: items.length, rentree: true } });
  return { ok: true, questions: items.length };
}
