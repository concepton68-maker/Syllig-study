import 'server-only';
import { sql } from './db';

// File de tâches en arrière-plan, dans le serveur de l'application (pas de service en plus) :
// une tâche à la fois, reprise si le serveur redémarre, deux nouveaux essais en cas d'échec.
export type JobKind = 'correction' | 'bilan' | 'cours';
export type Job = { id: string; kind: JobKind; payload: Record<string, unknown>; attempts: number };

const TICK = Number(process.env.JOBS_TICK_MS ?? 20_000);
const AUTO_EVERY = Number(process.env.JOBS_AUTO_MS ?? 30 * 60_000);
const MAX_ATTEMPTS = 3;
let running = false;
let started = false;
let lastAuto = 0;

export async function enqueue(kind: JobKind, payload: Record<string, unknown>, dedupe?: string) {
  const r = await sql<{ id: string }[]>`insert into jobs (kind, payload, dedupe) values (${kind}, ${sql.json(payload as never)}, ${dedupe ?? null})
    on conflict (dedupe) where dedupe is not null and status in ('en_attente', 'en_cours') do nothing returning id::text`;
  kick();
  return r[0]?.id ?? null;
}

// Lance le traitement sans attendre la prochaine minute
export function kick() { setTimeout(() => { void tick(); }, 50); }

async function claim(): Promise<Job | null> {
  // une tâche restée « en cours » plus de 20 minutes (serveur redémarré) repart dans la file
  await sql`update jobs set status = 'en_attente' where status = 'en_cours' and started_at < now() - interval '20 minutes'`;
  const [j] = await sql<Job[]>`update jobs set status = 'en_cours', started_at = now(), attempts = attempts + 1
    where id = (select id from jobs where status = 'en_attente' and run_after <= now() order by id for update skip locked limit 1)
    returning id::text, kind, payload, attempts`;
  return j ?? null;
}

async function run(j: Job): Promise<Record<string, unknown>> {
  const a = await import('./automation');
  if (j.kind === 'correction') return a.runCorrectionJob(String(j.payload.attemptId));
  if (j.kind === 'bilan') return a.runBilanJob(String(j.payload.studentId));
  return a.runCourseJob(Number(j.payload.courseId), j.payload.userId ? String(j.payload.userId) : null);
}

export async function tick() {
  if (running) return;
  running = true;
  try {
    if (Date.now() - lastAuto > AUTO_EVERY) { lastAuto = Date.now(); await (await import('./automation')).scheduleAuto().catch(() => null); }
    for (let n = 0; n < 20; n++) {
      const j = await claim();
      if (!j) break;
      try {
        const result = await run(j);
        await sql`update jobs set status = 'fait', finished_at = now(), result = ${sql.json(result as never)}, error = null where id = ${j.id}`;
      } catch (e) {
        const msg = (e as Error).message?.slice(0, 500) ?? 'erreur';
        if (j.attempts < MAX_ATTEMPTS) await sql`update jobs set status = 'en_attente', run_after = now() + interval '5 minutes', error = ${msg} where id = ${j.id}`;
        else await sql`update jobs set status = 'echec', finished_at = now(), error = ${msg} where id = ${j.id}`;
      }
    }
  } catch { /* base indisponible : on réessaiera */ }
  finally { running = false; }
}

export function startWorker() {
  if (started) return;
  started = true;
  setInterval(() => { void tick(); }, TICK).unref?.();
  setTimeout(() => { void tick(); }, 5_000);
}
