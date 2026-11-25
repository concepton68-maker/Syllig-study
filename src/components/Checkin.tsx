import { MessageCircleHeart } from 'lucide-react';
import { ITEMS, SCALE } from '@/lib/checkin';

// Ressenti de l'élève : ses réponses exactes, phrase par phrase (aucun score calculé, aucune interprétation).
export type CheckinRow = { created_at: Date; answers: Record<string, number>; free: { aide?: string; bloque?: string } };

export function CheckinCard({ rows, name, requestAction, requested, fille }: { rows: CheckinRow[]; name: string; requestAction: () => Promise<void>; requested: boolean; fille?: boolean }) {
  const [last, prev] = rows;
  const day = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
  return (
    <section className="card flex flex-col gap-4" aria-labelledby="ressenti" data-checkin-card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="ressenti" className="text-xl font-semibold m-0 flex items-center gap-2 mr-auto"><MessageCircleHeart size={20} aria-hidden="true" />Ce que {name} dit de son travail</h2>
        {requested ? <span className="pill bg-soft text-ink-2">Proposé à {name}</span>
          : <form action={requestAction}><button className="btn btn-sm" type="submit">{last ? 'Lui reproposer maintenant' : 'Lui proposer maintenant'}</button></form>}
      </div>
      <p className="muted text-sm m-0">Ses réponses au questionnaire « Comment tu travailles ? » (proposé toutes les 6 semaines), telles qu’{fille ? 'elle' : 'il'} les a données. C’est son avis sur lui-même, pas une mesure.</p>
      {!last ? <p className="m-0 text-sm">Pas encore de réponse. Le questionnaire apparaît dans son espace (« Aujourd’hui »), après le test de rentrée s’il y en a un.</p> : (
        <>
          <span className="text-sm muted">Réponses du {day(last.created_at)}{prev ? ` · entre parenthèses, la réponse du ${day(prev.created_at)} quand elle était différente` : ''}</span>
          <ul className="list-none m-0 p-0 grid gap-x-8 sm:grid-cols-2">
            {ITEMS.filter(it => typeof last.answers?.[it.id] === 'number').map(it => {
              const a = SCALE[last.answers[it.id]], b = prev && typeof prev.answers?.[it.id] === 'number' ? SCALE[prev.answers[it.id]] : null;
              return (
                <li key={it.id} className="flex justify-between gap-3 py-1.5 border-t border-soft text-sm" data-item={it.id}>
                  <span>{it.text}</span>
                  <span className="text-right whitespace-nowrap"><strong>{a}</strong>{b && b !== a && <span className="block muted text-xs">({b})</span>}</span>
                </li>
              );
            })}
          </ul>
          {(last.free.aide || last.free.bloque) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {last.free.aide && <blockquote className="m-0 rounded-xl bg-soft px-4 py-3 text-sm"><span className="lbl block mb-1">Ce qui l’aide</span>« {last.free.aide} »</blockquote>}
              {last.free.bloque && <blockquote className="m-0 rounded-xl bg-soft px-4 py-3 text-sm"><span className="lbl block mb-1">Ce qui {fille ? 'la' : 'le'} bloque</span>« {last.free.bloque} »</blockquote>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
