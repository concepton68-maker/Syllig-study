import { Users, GraduationCap, UserRound } from 'lucide-react';
import { sql } from '@/lib/db';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { ResetLink } from './ResetLink';
import { logoutEverywhere, grantContentBulk } from './reset-actions';

type Account = { id: string; login: string; display_name: string; role: string; roles: string[]; last_login_at: Date | null; sessions: number;
  household_id: string | null; household: string | null; level: string | null };
const when = (d: Date | null) => d ? d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'jamais';
const ROLE: Record<string, string> = { parent: 'Parent', student: 'Élève', admin: 'Contenu' };

// Vue d'ensemble pour l'administrateur : toutes les familles, leurs parents et leurs élèves, avec identifiants
export async function Families({ me }: { me: string }) {
  const rows = await sql<Account[]>`
    select u.id, u.login, u.display_name, u.role, u.last_login_at,
      coalesce((select array_agg(r.role order by r.role) from user_roles r where r.user_id = u.id), array[u.role]) as roles,
      (select count(*)::int from auth_sessions a where a.user_id = u.id and a.expires_at > now()) as sessions,
      hm.household_id, h.name as household, l.name as level
    from users u
    left join household_members hm on hm.user_id = u.id
    left join households h on h.id = hm.household_id
    left join students s on s.user_id = u.id
    left join levels l on l.code = s.level_code
    order by h.created_at nulls last, u.role = 'student', u.login`;
  const groups = new Map<string, { name: string; accounts: Account[] }>();
  for (const r of rows) {
    const k = r.household_id ?? 'aucune';
    if (!groups.has(k)) groups.set(k, { name: r.household ?? 'Comptes hors famille (gestion du contenu)', accounts: [] });
    if (!groups.get(k)!.accounts.some(a => a.id === r.id)) groups.get(k)!.accounts.push(r);
  }
  const families = [...groups.keys()].filter(k => k !== 'aucune').length;
  const parents = rows.filter(r => r.role !== 'student').length, students = rows.filter(r => r.role === 'student').length;
  return (
    <section className="card flex flex-col max-w-[1100px]" aria-labelledby="familles">
      <h2 id="familles" className="text-xl font-semibold mb-1 flex items-center gap-2"><Users size={20} aria-hidden="true" />Familles et comptes</h2>
      <p className="muted text-sm mt-0 mb-3">{families} famille{families > 1 ? 's' : ''} · {parents} compte{parents > 1 ? 's' : ''} adulte{parents > 1 ? 's' : ''} · {students} élève{students > 1 ? 's' : ''}. L’identifiant est ce qu’on tape pour se connecter.</p>
      <div className="mb-2"><BulkBar formId="bulk-familles" noun="compte"
        actions={[{ label: 'Déconnecter de tous les appareils', action: logoutEverywhere, confirm: 'Déconnecter {n} de tous leurs appareils ? Ils devront se reconnecter.' },
          { label: 'Donner l’accès Contenu', action: grantContentBulk, confirm: 'Donner l’accès Contenu à {n} ? (les comptes élèves sont ignorés)' }]} /></div>
      {[...groups.values()].map(g => (
        <div key={g.name} className="flex flex-col border-t border-line pt-3 mt-2">
          <h3 className="text-[15px] font-semibold m-0 mb-1">{g.name}</h3>
          {g.accounts.map(a => (
            <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 border-t border-soft text-sm">
              {a.id !== me ? <BulkCheck formId="bulk-familles" value={a.id} label={a.display_name} /> : <span className="w-5 shrink-0" />}
              <span className={`kpi-icon ${a.role === 'student' ? 'tone-violet' : 'tone-brand'} !w-8 !h-8`} aria-hidden="true">{a.role === 'student' ? <GraduationCap size={16} /> : <UserRound size={16} />}</span>
              <span className="flex-[1_1_170px] min-w-0">
                <strong>{a.display_name}</strong>{a.level && <span className="muted"> · {a.level}</span>}
                <span className="block">Identifiant : <code className="select-all font-semibold">{a.login}</code></span>
              </span>
              <span className="flex-[0_1_150px] flex flex-wrap gap-1">{a.roles.map(r => <span key={r} className="pill bg-soft text-ink-2">{ROLE[r] ?? r}</span>)}{a.id === me && <span className="pill bg-brand text-white">Vous</span>}</span>
              <span className="flex-[1_1_200px] muted">Dernière connexion : {when(a.last_login_at)}{a.sessions ? ` · connecté sur ${a.sessions} appareil${a.sessions > 1 ? 's' : ''}` : ''}</span>
              <div className="flex-[1_1_220px]"><ResetLink login={a.login} label="Lien nouveau mot de passe" small /></div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
