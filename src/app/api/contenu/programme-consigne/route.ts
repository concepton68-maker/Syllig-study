import { currentUser } from '@/lib/auth';
import { levelDef } from '@/lib/levels-catalog';
import { programmeInstructions } from '@/lib/programme-proposal';

// Consigne à donner à Claude (sans clé) pour préparer le programme d'un niveau ; la réponse s'importe dans Programmes
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !u.roles.includes('admin')) return new Response('Non autorisé', { status: 403 });
  const code = new URL(req.url).searchParams.get('niveau') ?? '';
  if (!levelDef(code)) return new Response('Niveau inconnu.', { status: 404 });
  const text = `${programmeInstructions(code)}\n\n(Consigne Syllig Study : colle ce texte dans Claude, puis importe sa réponse dans Contenu › Programmes.)\n`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="consigne-programme-${code}.txt"` } });
}
