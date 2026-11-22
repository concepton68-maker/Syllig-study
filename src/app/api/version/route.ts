// Version en ligne : numéro de version (fichier VERSION) et commit Git
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ version: process.env.APP_RELEASE ?? 'dev', commit: process.env.APP_VERSION ?? 'dev', demarre: process.env.APP_STARTED ?? null });
}
