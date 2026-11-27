import Link from 'next/link';
import { checkUnsubscribe } from '@/lib/mailer';
import { AuthFrame } from '../connexion/AuthFrame';
import { unsubscribe } from './actions';

export const metadata = { title: 'Désabonnement' };
export const dynamic = 'force-dynamic';

// Lien « Ne plus recevoir ce message » : ouvrir la page ne désabonne pas (les messageries ouvrent parfois les liens
// toutes seules) ; un bouton confirme. Le désabonnement en un clic des messageries passe par /api/desabonnement (POST).
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ u?: string; t?: string; fait?: string }> }) {
  const { u, t, fait } = await searchParams;
  if (fait) return (
    <AuthFrame title={fait === '1' ? 'C’est fait' : 'Lien invalide'} sub={fait === '1' ? 'Vous ne recevrez plus le message du lundi par e-mail. Il reste visible sur votre Accueil.' : 'Ce lien de désabonnement n’est pas valide.'} back={{ href: '/', label: '‹ Retour' }}>
      <p className="m-0 text-sm" data-unsubscribed={fait === '1' ? 'oui' : 'non'}>Vous pouvez le réactiver à tout moment dans <Link href="/compte">Mon compte</Link>.</p>
    </AuthFrame>
  );
  const valid = !!u && !!t && /^[0-9a-f-]{36}$/i.test(u) && checkUnsubscribe(u, t);
  return (
    <AuthFrame title={valid ? 'Ne plus recevoir le message du lundi ?' : 'Lien invalide'} sub={valid ? 'Le message restera visible sur votre Accueil.' : 'Ce lien de désabonnement n’est pas valide.'} back={{ href: '/', label: '‹ Retour' }}>
      {valid ? <form action={unsubscribe}><input type="hidden" name="u" value={u} /><input type="hidden" name="t" value={t} />
        <button className="btn btn-primary" type="submit" data-unsubscribe>Ne plus le recevoir</button></form>
        : <p className="m-0 text-sm" data-unsubscribed="non">Vérifiez le lien reçu.</p>}
    </AuthFrame>
  );
}
