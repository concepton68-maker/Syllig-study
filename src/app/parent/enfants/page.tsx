import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { AddChildForm } from './Forms';
import { Screen } from '@/components/Layout';
import { ageAt, pathNote } from '@/lib/school-class';

export const metadata = { title: 'Mes enfants' };
export const dynamic = 'force-dynamic';

export default async function Children() {
  const { students } = await requireParent();
  const levels = await sql<{ code: string; name: string }[]>`select code, name from levels where (active and removed_at is null) or code in (select level_code from students) order by position, name`;
  const logins = await sql<{ id: string; login: string; last_login_at: Date | null }[]>`
    select s.id, u.login, u.last_login_at from students s join users u on u.id = s.user_id where s.id in ${sql(students.length ? students.map(s => s.id) : ['00000000-0000-0000-0000-000000000000'])}`;
  const byId = new Map(logins.map(l => [l.id, l]));
  return (
    <Screen top={<>
      <PageTitle kicker="Mes enfants" title="Vos enfants" sub="Ajoutez vos enfants vous-même (en bas de page). Une fiche par enfant : ses cours, son dossier scolaire (niveau, années), ses règles et son thème, son compte. Les comptes sont créés par vous, sans inscription libre." />
    </>}>
      {students.map(s => (
        <section key={s.id} className="card flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4" data-theme={s.settings.theme !== 'classique' ? s.settings.theme : undefined}>
            <span className="avatar !w-14 !h-14 !text-lg !rounded-2xl" aria-hidden="true">{s.first_name.slice(0, 1).toUpperCase()}</span>
            <div><h2 className="text-xl font-semibold m-0">{s.first_name} <span className="pill bg-brand-soft text-brand-dark align-middle ml-1">{s.level_name}</span>{s.settings.birth && <span className="muted text-base font-normal ml-2">{ageAt(s.settings.birth)} ans</span>}{s.settings.extra_time && <span className="pill bg-soft text-ink-2 align-middle ml-2">tiers-temps</span>}</h2>
              {s.settings.birth && pathNote(Number(s.settings.birth.slice(0, 4)), s.level_name) && <span className="block muted text-sm">{pathNote(Number(s.settings.birth.slice(0, 4)), s.level_name)}</span>}
              <span className="muted text-sm">Identifiant : <strong>{byId.get(s.id)?.login}</strong>
              {byId.get(s.id)?.last_login_at ? ` · dernière connexion le ${byId.get(s.id)!.last_login_at!.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : ' · aucune connexion pour l’instant'}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary" href={`/parent/enfants/${s.id}`}>Ouvrir la fiche</Link>
            <Link className="btn" href={`/parent/enfants/${s.id}?onglet=dossier`}>Dossier scolaire</Link>
            <Link className="btn" href={`/parent/enfants/${s.id}?onglet=regles`}>Règles et thème</Link>
          </div>
        </section>
      ))}
      <section className="card flex flex-col gap-3 max-w-[760px]"><h2 className="text-xl font-semibold">Ajouter un enfant</h2><AddChildForm levels={levels} /></section>
    </Screen>
  );
}
