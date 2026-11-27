import { requireUser } from '@/lib/auth';
import { mailSettings } from '@/lib/mailer';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { MailForm, TestForm } from './Form';

export const metadata = { title: 'E-mails' };
export const dynamic = 'force-dynamic';

export default async function EmailsPage() {
  await requireUser('admin');
  const s = await mailSettings();
  const sends = await sql<{ email: string; sent_at: Date | null; error: string | null; first_name: string; week_start: string }[]>`
    select w.email, w.sent_at, w.error, st.first_name, to_char(m.week_start, 'DD/MM') as week_start from weekly_sends w join weekly_messages m on m.id = w.message_id
    join students st on st.id = m.student_id order by coalesce(w.sent_at, m.created_at) desc limit 20`;
  return (
    <Screen top={<PageTitle kicker="Contenu" title="Envoi des e-mails" sub="Pour le message du lundi aux parents. Un service d’envoi européen (Brevo, Scaleway…), gratuit à ce volume." />}>
      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold m-0">Service d’envoi</h2>
        <ol className="m-0 pl-5 text-sm flex flex-col gap-1 muted">
          <li>Créez un compte gratuit chez un service hébergé dans l’Union européenne, par exemple Brevo (brevo.com) ou Scaleway (scaleway.com) : les e-mails contiennent le prénom et les notes des enfants.</li>
          <li>Dans son espace, ouvrez la page « SMTP » : il donne le serveur, le port, l’identifiant et une clé.</li>
          <li>Collez-les ici, puis envoyez-vous un e-mail d’essai.</li>
        </ol>
        <MailForm v={s ? { host: s.host, port: s.port, user: s.user, hint: s.pass_hint, from: s.from } : null} />
      </section>
      {s && <section className="card flex flex-col gap-3"><h2 className="text-lg font-semibold m-0">Essai</h2><TestForm /></section>}
      <section className="card flex flex-col gap-2" data-sends>
        <h2 className="text-lg font-semibold m-0">Derniers messages du lundi</h2>
        {sends.length === 0 && <p className="m-0 text-sm muted">Aucun envoi pour l’instant.</p>}
        {sends.map((x, i) => (
          <div key={i} className="flex flex-wrap justify-between gap-3 py-2 border-t border-soft text-sm">
            <span><strong>{x.first_name}</strong> · semaine du {x.week_start} · {x.email}</span>
            <span className={x.sent_at ? 'muted' : 'text-warm-dark'}>{x.sent_at ? `envoyé le ${x.sent_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : `pas envoyé : ${x.error ?? 'en attente'}`}</span>
          </div>
        ))}
      </section>
    </Screen>
  );
}
