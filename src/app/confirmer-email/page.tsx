import Link from 'next/link';
import { checkConfirm } from '@/lib/mailer';
import { AuthFrame } from '../connexion/AuthFrame';
import { confirmEmail } from './actions';

export const metadata = { title: 'Confirmation de l’adresse' };
export const dynamic = 'force-dynamic';

// Lien envoyé à la nouvelle adresse : ouvrir la page ne confirme rien (les messageries ouvrent parfois les liens) ; un bouton confirme.
export default async function Confirm({ searchParams }: { searchParams: Promise<{ u?: string; e?: string; x?: string; t?: string; fait?: string }> }) {
  const { u, e, x, t, fait } = await searchParams;
  if (fait) return (
    <AuthFrame title={fait === '1' ? 'Adresse confirmée' : 'Lien invalide ou expiré'} sub={fait === '1' ? 'Le message du lundi pourra être envoyé à cette adresse, si la case « Recevoir le message » est cochée dans Mon compte.' : 'Ce lien n’est plus valable (expiré, ou l’adresse a été changée depuis). Enregistrez à nouveau votre adresse dans Mon compte.'} back={{ href: '/compte', label: '‹ Mon compte' }}>
      <p className="m-0 text-sm" data-confirmed={fait === '1' ? 'oui' : 'non'}><Link href="/compte">Mon compte</Link></p>
    </AuthFrame>
  );
  const valid = !!u && !!e && !!t && /^[0-9a-f-]{36}$/i.test(u) && checkConfirm(u, e, Number(x), t);
  return (
    <AuthFrame title={valid ? 'Confirmer cette adresse ?' : 'Lien invalide ou expiré'} sub={valid ? `Le message du lundi sur le travail de votre enfant sera envoyé à ${e}.` : 'Ce lien n’est plus valable. Enregistrez à nouveau votre adresse dans Mon compte.'} back={{ href: '/compte', label: '‹ Mon compte' }}>
      {valid ? <form action={confirmEmail}>{(['u', 'e', 'x', 't'] as const).map(k => <input key={k} type="hidden" name={k} value={{ u, e, x, t }[k]} />)}
        <button className="btn btn-primary" type="submit" data-confirm>Confirmer mon adresse</button></form>
        : <p className="m-0 text-sm" data-confirmed="non">Vérifiez le lien reçu.</p>}
    </AuthFrame>
  );
}
