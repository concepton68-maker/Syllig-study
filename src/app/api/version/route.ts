// Version en ligne (commit Git) : permet de vérifier qu'une mise à jour est bien déployée
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ version: process.env.APP_VERSION ?? 'dev', demarre: process.env.APP_STARTED ?? null });
}
