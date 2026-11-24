// Démarre la file de tâches en arrière-plan (corrections et bilans automatiques, rédaction de cours) avec le serveur.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.JOBS !== 'off') {
    const { startWorker } = await import('./lib/jobs');
    startWorker();
  }
}
