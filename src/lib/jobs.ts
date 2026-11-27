import 'server-only';
import { sql } from './db';

// File de tâches en arrière-plan, dans le serveur de l'application (pas de service en plus) :
// deux files (rapide / cours), reprise si le serveur redémarre, deux nouveaux essais en cas d'échec.
export type JobKind = 'correction' | 'bilan' | 'cours' | 'relecture' | 'cours_corrige';
export type Job = { id: string; kind: JobKind; payload: Record<string, unknown>; attempts: number };

const TICK = Number(process.env.JOBS_TICK_MS ?? 20_000);
const AUTO_EVERY = Number(process.env.JOBS_AUTO_MS ?? 30 * 60_000);
const MAX_ATTEMPTS = 3;
// deux files : les tâches rapides (corrections, bilans) ne restent jamais bloquées derrière la rédaction d'un cours
const LANES = { rapide: ['correction', 'bilan'], cours: ['cours', 'relecture', 'cours_corrige'] } as const;
type Lane = keyof typeof LANES;
const busy: Record<Lane, boolean> = { rapide: false, cours: false };
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

async function claim(lane: Lane): Promise<Job | null> {
  // une tâche restée « en cours » trop longtemps (serveur redémarré pendant le travail) repart dans la file
  await sql`update jobs set status = 'en_attente', progress = null where status = 'en_cours' and kind in ${sql([...LANES[lane]])}
    and started_at < now() - ${lane === 'cours' ? sql`interval '70 minutes'` : sql`interval '20 minutes'`}`;
  const [j] = await sql<Job[]>`update jobs set status = 'en_cours', started_at = now(), attempts = attempts + 1, progress = null
    where id = (select id from jobs where status = 'en_attente' and run_after <= now() and kind in ${sql([...LANES[lane]])} order by id for update skip locked limit 1)
    returning id::text, kind, payload, attempts`;
  return j ?? null;
}

// Avancement d'une tâche longue (appelé au plus toutes les 3 secondes)
export function progressReporter(jobId: string | null) {
  let last = 0;
  return (text: string) => {
    if (!jobId || Date.now() - last < 3000) return;
    last = Date.now();
    void sql`update jobs set progress = ${text} where id = ${jobId}`.catch(() => null);
  };
}

async function run(j: Job): Promise<Record<string, unknown>> {
  const a = await import('./automation');
  if (j.kind === 'correction') return a.runCorrectionJob(String(j.payload.attemptId));
  if (j.kind === 'bilan') return a.runBilanJob(String(j.payload.studentId));
  if (j.kind === 'relecture' || j.kind === 'cours_corrige') {
    const r = await import('./course-review');
    return j.kind === 'relecture' ? r.runReviewJob(String(j.payload.versionId), j.id) : r.runFixJob(String(j.payload.reviewId), j.payload.userId ? String(j.payload.userId) : null, j.id);
  }
  return a.runCourseJob(Number(j.payload.courseId), j.payload.userId ? String(j.payload.userId) : null, j.id);
}

export async function tick() {
  await (await import('./weekly')).weeklyTick().catch(e => console.error('message hebdomadaire :', (e as Error).message));
  if (Date.now() - lastAuto > AUTO_EVERY) { lastAuto = Date.now(); await (await import('./automation')).scheduleAuto().catch(() => null); }
  await Promise.all([drain('rapide'), drain('cours')]);
}

async function drain(lane: Lane) {
  if (busy[lane]) return;
  busy[lane] = true;
  try {
    for (let n = 0; n < 20; n++) {
      const j = await claim(lane);
      if (!j) break;
      try {
        const result = await run(j);
        await sql`update jobs set status = 'fait', finished_at = now(), result = ${sql.json(result as never)}, error = null, progress = null where id = ${j.id}`;
      } catch (e) {
        const msg = (e as Error).message?.slice(0, 500) ?? 'erreur';
        if (j.attempts < MAX_ATTEMPTS) await sql`update jobs set status = 'en_attente', run_after = now() + interval '2 minutes', error = ${msg}, progress = null where id = ${j.id}`;
        else await sql`update jobs set status = 'echec', finished_at = now(), error = ${msg}, progress = null where id = ${j.id}`;
      }
    }
  } catch { /* base indisponible : on réessaiera */ }
  finally { busy[lane] = false; }
}

export function startWorker() {
  if (started) return;
  started = true;
  // au démarrage, rien ne tourne encore : une tâche marquée « en cours » a été interrompue par le redémarrage, elle repart
  void sql`update jobs set status = 'en_attente', run_after = now(), progress = null where status = 'en_cours'`.catch(() => null);
  setInterval(() => { void tick(); }, TICK).unref?.();
  setTimeout(() => { void tick(); }, 5_000);
}
