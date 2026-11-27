import Link from 'next/link';
import { sql } from '@/lib/db';
import { checkConfirm } from '@/lib/mailer';
import { AuthFrame } from '../connexion/AuthFrame';

export const metadata = { title: 'Confirmation de l’adresse' };
export const dynamic = 'force-dynamic';

// Lien envoyé à la nouvelle adresse : elle devient l'adresse du message du lundi (signé, sans connexion nécessaire)
export default async function Confirm({ searchParams }: { searchParams: Promise<{ u?: string; e?: string; t?: string }> }) {
  const { u, e, t } = await searchParams;
  const ok = !!u && !!e && !!t && /^[0-9a-f-]{36}$/i.test(u) && checkConfirm(u, e, t);
  if (ok) await sql`update users set email = ${e!.toLowerCase()}, email_pending = case when email_pending = ${e!.toLowerCase()} then null else email_pending end where id = ${u}`;
  return (
    <AuthFrame title={ok ? 'Adresse confirmée' : 'Lien invalide'} sub={ok ? `Le message du lundi pourra être envoyé à ${e}, si la case « Recevoir le message » est cochée dans Mon compte.` : 'Ce lien de confirmation n’est pas valide.'} back={{ href: '/compte', label: '‹ Mon compte' }}>
      <p className="m-0 text-sm" data-confirmed={ok ? 'oui' : 'non'}><Link href="/compte">Mon compte</Link></p>
    </AuthFrame>
  );
}
