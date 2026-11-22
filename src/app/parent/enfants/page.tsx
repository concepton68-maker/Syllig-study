import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { AddChildForm } from './Forms';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Mes enfants' };
export const dynamic = 'force-dynamic';

export default async function Children() {
  const { students } = await requireParent();
  const levels = await sql<{ code: string; name: string }[]>`select code, name from levels order by position, name`;
  const logins = await sql<{ id: string; login: string; last_login_at: Date | null }[]>`
    select s.id, u.login, u.last_login_at from students s join users u on u.id = s.user_id where s.id in ${sql(students.length ? students.map(s => s.id) : ['00000000-0000-0000-0000-000000000000'])}`;
  const byId = new Map(logins.map(l => [l.id, l]));
  return (
    <Screen top={<>
      <PageTitle kicker="Mes enfants" title="Vos enfants" sub="Une fiche par enfant : ses cours, ses règles et son thème, son compte. Les comptes sont créés par vous, sans inscription libre." />
    </>}>
      {students.map(s => (
        <section key={s.id} className="card flex flex-wrap justify-between items-start gap-4">
          <div><h2 className="text-xl font-semibold">{s.first_name}</h2><span className="muted text-sm">{s.level_name} · identifiant : <strong>{byId.get(s.id)?.login}</strong>
            {byId.get(s.id)?.last_login_at ? ` · dernière connexion le ${byId.get(s.id)!.last_login_at!.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : ' · jamais connecté'}</span></div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary" href={`/parent/enfants/${s.id}`}>Ouvrir la fiche</Link>
            <Link className="btn" href={`/parent/enfants/${s.id}?onglet=regles`}>Règles et thème</Link>
          </div>
        </section>
      ))}
      <section className="card flex flex-col gap-3 max-w-[760px]"><h2 className="text-xl font-semibold">Ajouter un enfant</h2><AddChildForm levels={levels} /></section>
    </Screen>
  );
}
