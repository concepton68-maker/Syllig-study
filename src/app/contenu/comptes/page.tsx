import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { ResetLink } from './ResetLink';
import { dismissAdultRequests } from './reset-actions';

export const metadata = { title: 'Comptes' };
export const dynamic = 'force-dynamic';

// Donner l'accès « Contenu » à un compte parent existant (un seul compte, deux espaces)
async function grant(form: FormData) {
  'use server';
  await requireUser('admin');
  const login = String(form.get('login') ?? '').trim().toLowerCase();
  const [u] = await sql<{ id: string; role: string; display_name: string }[]>`select id, role, display_name from users where login = ${login}`;
  if (!u) redirect(`/contenu/comptes?erreur=${encodeURIComponent(`Aucun compte avec l’e-mail ${login}.`)}`);
  if (u.role === 'student') redirect(`/contenu/comptes?erreur=${encodeURIComponent('Un compte élève ne peut pas recevoir l’accès Contenu.')}`);
  await sql`insert into user_roles (user_id, role) values (${u.id}, 'admin') on conflict do nothing`;
  revalidatePath('/contenu/comptes');
  redirect(`/contenu/comptes?ok=${encodeURIComponent(`Accès Contenu donné à ${u.display_name}.`)}`);
}
// retrait groupé (on ne se retire jamais son propre accès ; il reste toujours au moins un administrateur)
async function revoke(form: FormData) {
  'use server';
  const me = await requireUser('admin');
  let removed = 0;
  for (const id of form.getAll('ids').map(String)) {
    if (id === me.id || !/^[0-9a-f-]{36}$/i.test(id)) continue;
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from user_roles where role = 'admin'`;
    if (n <= 1) break;
    removed += (await sql`delete from user_roles r using users u where r.user_id = ${id} and r.role = 'admin' and u.id = r.user_id and u.role <> 'admin' returning 1`).length;
  }
  revalidatePath('/contenu/comptes');
  redirect(`/contenu/comptes?ok=${encodeURIComponent(`Accès Contenu retiré à ${removed} compte${removed > 1 ? 's' : ''}.`)}`);
}

export default async function Accounts({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser('admin');
  const admins = await sql<{ id: string; login: string; display_name: string; roles: string[] }[]>`
    select u.id, u.login, u.display_name, array_agg(r2.role order by r2.role) as roles
    from users u join user_roles r on r.user_id = u.id and r.role = 'admin' join user_roles r2 on r2.user_id = u.id
    group by u.id order by u.login`;
  const requests = await sql<{ id: string; login: string; display_name: string; created_at: Date }[]>`
    select r.id::text, u.login, u.display_name, r.created_at from password_requests r join users u on u.id = r.user_id
    where r.done_at is null and u.role <> 'student' order by r.created_at`;
  return (
    <Screen top={<PageTitle kicker="Comptes" title="Accès à l’espace Contenu" sub="Un parent qui gère aussi les cours n’a besoin que d’un compte : donnez-lui l’accès Contenu, il bascule ensuite d’un espace à l’autre depuis la barre du haut." />}>
      {sp.ok && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm max-w-[900px]">{sp.ok}</p>}
      {sp.erreur && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm max-w-[900px]">{sp.erreur}</p>}
      {requests.length > 0 && (
        <section className="card flex flex-col max-w-[900px]">
          <h2 className="text-xl font-semibold mb-2">Mots de passe oubliés</h2>
          <div className="mb-2"><BulkBar formId="bulk-mdp" noun="demande" feminine actions={[{ label: 'Marquer comme réglée', action: dismissAdultRequests }]} /></div>
          {requests.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
              <BulkCheck formId="bulk-mdp" value={r.id} label={r.display_name} />
              <span className="flex-[1_1_220px]"><strong>{r.display_name}</strong><span className="block muted">{r.login} · demandé le {r.created_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></span>
              <div className="flex-[1_1_100%]"><ResetLink login={r.login} label="Créer un lien de nouveau mot de passe" /></div>
            </div>
          ))}
        </section>
      )}
      <section className="card flex flex-col max-w-[900px]">
        <h2 className="text-xl font-semibold mb-2">Comptes avec l’accès Contenu</h2>
        {admins.filter(a => a.id !== me.id && a.roles.includes('parent')).length > 0 && <div className="mb-2"><BulkBar formId="bulk-comptes" noun="compte"
          actions={[{ label: 'Retirer l’accès Contenu', action: revoke, tone: 'danger', confirm: 'Retirer l’accès Contenu à {n} ? Ils gardent leur espace Famille.' }]} /></div>}
        {admins.map(a => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft">
            {a.id !== me.id && a.roles.includes('parent') ? <BulkCheck formId="bulk-comptes" value={a.id} label={a.display_name} /> : <span className="w-5 shrink-0" />}
            <span className="flex-[1_1_260px]"><strong>{a.display_name}</strong><span className="block muted text-sm">{a.login}</span></span>
            <span className="text-sm">{a.roles.map(r => ({ admin: 'Contenu', parent: 'Famille', student: 'Élève' } as Record<string, string>)[r]).join(' + ')}</span>
            {a.id === me.id && <span className="pill bg-soft text-ink-2">Vous</span>}
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
      <section className="card flex flex-col gap-3 max-w-[900px]">
        <h2 className="text-xl font-semibold">Lien de nouveau mot de passe</h2>
        <p className="muted text-sm m-0">Pour un parent qui ne peut plus se connecter : le lien lui permet de choisir lui-même un nouveau mot de passe (valable 48 h, une seule fois).</p>
        <ResetLink />
      </section>
    </Screen>
  );
}
