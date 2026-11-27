import Link from 'next/link';
import { sql } from '@/lib/db';
import { checkUnsubscribe } from '@/lib/mailer';
import { AuthFrame } from '../connexion/AuthFrame';

export const metadata = { title: 'Désabonnement' };
export const dynamic = 'force-dynamic';

// Lien « Ne plus recevoir ce message » des e-mails du lundi : signé, sans connexion nécessaire
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ u?: string; t?: string }> }) {
  const { u, t } = await searchParams;
  const ok = !!u && !!t && /^[0-9a-f-]{36}$/i.test(u) && checkUnsubscribe(u, t);
  if (ok) await sql`update users set weekly_email = false where id = ${u}`;
  return (
    <AuthFrame title={ok ? 'C’est fait' : 'Lien invalide'} sub={ok ? 'Vous ne recevrez plus le message du lundi par e-mail. Il reste visible sur votre Accueil.' : 'Ce lien de désabonnement n’est pas valide.'} back={{ href: '/', label: '‹ Retour' }}>
      <p className="m-0 text-sm" data-unsubscribed={ok ? 'oui' : 'non'}>Vous pouvez le réactiver à tout moment dans <Link href="/compte">Mon compte</Link>.</p>
    </AuthFrame>
  );
}
