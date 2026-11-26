import 'server-only';
import { sql } from './db';

// Changement de définition du temps de travail (26/11/2026, migration 019) : pause après 60 s sans geste, puis après le délai
// choisi par le parent (10 min par défaut). Les minutes d'avant et d'après ne se comparent pas directement : on le dit.
export async function pauseRuleSince(): Promise<Date | null> {
  const [r] = await sql<{ at: Date }[]>`select applied_at as at from schema_migrations where name = '019_pause_10_min.sql'`;
  return r?.at ?? null;
}
export const ruleNote = (at: Date) =>
  `Avant le ${at.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })}, le temps s’arrêtait après 60 s sans geste : les minutes d’avant ne se comparent pas directement à celles d’après.`;
