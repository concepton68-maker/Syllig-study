import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Comptes' };
export const dynamic = 'force-dynamic';

// Donner l'accès « Contenu » à un compte parent existant (un seul compte, deux espaces)
async function grant(form: FormData) {
  'use server';
  await requireUser('admin');
  const login = String(form.get('login') ?? '').trim().toLowerCase();
  const [u] = await sql<{ id: string; role: string }[]>`select id, role from users where login = ${login}`;
  if (!u || u.role === 'student') return;
  await sql`insert into user_roles (user_id, role) values (${u.id}, 'admin') on conflict do nothing`;
  revalidatePath('/contenu/comptes');
}
async function revoke(form: FormData) {
  'use server';
  const me = await requireUser('admin');
  const id = String(form.get('user'));
  if (id === me.id) return;                                   // on ne se retire pas son propre accès
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from user_roles where role = 'admin'`;
  if (n <= 1) return;                                         // jamais zéro administrateur
  await sql`delete from user_roles r using users u where r.user_id = ${id} and r.role = 'admin' and u.id = r.user_id and u.role <> 'admin'`;
  revalidatePath('/contenu/comptes');
}

export default async function Accounts() {
  const me = await requireUser('admin');
  const admins = await sql<{ id: string; login: string; display_name: string; roles: string[] }[]>`
    select u.id, u.login, u.display_name, array_agg(r2.role order by r2.role) as roles
    from users u join user_roles r on r.user_id = u.id and r.role = 'admin' join user_roles r2 on r2.user_id = u.id
    group by u.id order by u.login`;
  return (
    <Screen top={<PageTitle kicker="Comptes" title="Accès à l’espace Contenu" sub="Un parent qui gère aussi les cours n’a besoin que d’un compte : donnez-lui l’accès Contenu, il bascule ensuite d’un espace à l’autre depuis la barre du haut." />}>
      <section className="card flex flex-col max-w-[900px]">
        <h2 className="text-xl font-semibold mb-2">Comptes avec l’accès Contenu</h2>
        {admins.map(a => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft">
            <span className="flex-[1_1_260px]"><strong>{a.display_name}</strong><span className="block muted text-sm">{a.login}</span></span>
            <span className="text-sm">{a.roles.map(r => ({ admin: 'Contenu', parent: 'Famille', student: 'Élève' } as Record<string, string>)[r]).join(' + ')}</span>
            {a.id !== me.id && a.roles.includes('parent') && (
              <form action={revoke}><input type="hidden" name="user" value={a.id} /><button className="btn" type="submit">Retirer l’accès Contenu</button></form>
            )}
          </div>
        ))}
      </section>
      <section className="card flex flex-col gap-3 max-w-[900px]">
        <h2 className="text-xl font-semibold">Donner l’accès Contenu à un parent</h2>
        <form action={grant} className="flex flex-wrap gap-3 items-end">
          <label className="flex-[1_1_320px] flex flex-col gap-1 text-sm font-semibold">E-mail du compte parent
            <input className="field" name="login" type="email" required autoComplete="off" /></label>
          <button className="btn btn-primary" type="submit">Donner l’accès</button>
        </form>
        <p className="muted text-sm m-0">Le parent garde son espace Famille. Les comptes élèves ne peuvent pas recevoir cet accès.</p>
      </section>
    </Screen>
  );
}
