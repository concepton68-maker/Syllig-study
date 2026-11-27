import { currentUser } from '@/lib/auth';
import { exportBatch } from '@/lib/course-batch';

// Export groupé pour relecture par Claude : les cours cochés (ids=…), sinon tous les cours qui ont un contenu
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !u.roles.includes('admin')) return new Response('Non autorisé', { status: 403 });
  const ids = new URL(req.url).searchParams.getAll('ids').map(Number).filter(n => Number.isInteger(n) && n > 0);
  const lot = await exportBatch(ids.length ? ids : null);
  if (!lot.cours.length) return new Response('Aucun cours avec un contenu dans la sélection.', { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(lot, null, 1), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="cours-a-relire-${day}-${lot.cours.length}.json"`,
  } });
}
