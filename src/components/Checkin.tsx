import { MessageCircleHeart } from 'lucide-react';
import { DIMS, type Dim } from '@/lib/checkin';

// Ressenti de l'élève (questionnaire « Comment je travaille ») : une barre par dimension, ce qui aide quand c'est un point d'attention.
export type CheckinRow = { created_at: Date; scores: Partial<Record<Dim, number>>; free: { aide?: string; bloque?: string } };
const ORDER: Dim[] = ['envie', 'sens', 'confiance', 'organisation', 'soutien', 'conditions', 'stress', 'pression'];
const concern = (d: Dim, v: number) => DIMS[d].bad ? v >= 60 : v < 50;

export function CheckinCard({ rows, name, requestAction, requested, fille }: { rows: CheckinRow[]; name: string; requestAction: () => Promise<void>; requested: boolean; fille?: boolean }) {
  const [last, prev] = rows;
  const day = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
  return (
    <section className="card flex flex-col gap-4" aria-labelledby="ressenti" data-checkin-card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="ressenti" className="text-xl font-semibold m-0 flex items-center gap-2 mr-auto"><MessageCircleHeart size={20} aria-hidden="true" />Son ressenti</h2>
        {requested ? <span className="pill bg-soft text-ink-2">Proposé à {name}</span>
          : <form action={requestAction}><button className="btn btn-sm" type="submit">{last ? 'Lui reproposer maintenant' : 'Lui proposer maintenant'}</button></form>}
      </div>
      <p className="muted text-sm m-0">Ce que {name} dit de sa façon de travailler (questionnaire de 2 minutes, proposé toutes les 6 semaines). C’est son ressenti, pas un diagnostic : il complète les mesures de la plateforme.</p>
      {!last ? <p className="m-0 text-sm">Pas encore de réponse. Le questionnaire apparaît dans son espace (« Aujourd’hui »), après le test de rentrée s’il y en a un.</p> : (
        <>
          <span className="text-sm muted">Réponses du {day(last.created_at)}{prev ? ` · comparées au ${day(prev.created_at)}` : ''}</span>
          <ul className="list-none m-0 p-0 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {ORDER.filter(d => last.scores[d] !== undefined).map(d => {
              const v = last.scores[d]!, p = prev?.scores[d], c = concern(d, v);
              const delta = p === undefined ? null : v - p;
              return (
                <li key={d} className="flex flex-col gap-1" data-dim={d} data-concern={c ? '1' : '0'}>
                  <span className="flex items-baseline gap-2 text-sm"><strong>{DIMS[d].label}</strong>
                    {delta !== null && Math.abs(delta) >= 10 && <span className="muted text-xs">{delta > 0 ? '▲' : '▼'} {Math.abs(delta)} pts</span>}
                    <span className="ml-auto tabular-nums font-semibold">{v} %</span></span>
                  <span className="h-2 rounded-full bg-track overflow-hidden" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(3, v)}%`, background: c ? '#f47230' : 'var(--color-brand)' }} /></span>
                  <span className={`text-[13px] ${c ? 'text-warm-dark' : 'muted'}`}>{v >= 50 ? DIMS[d].high : DIMS[d].low}{c ? ` Ce qui aide : ${DIMS[d].help}` : ''}</span>
                </li>
              );
            })}
          </ul>
          {(last.free.aide || last.free.bloque) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {last.free.aide && <blockquote className="m-0 rounded-xl bg-soft px-4 py-3 text-sm"><span className="lbl block mb-1">Ce qui l’aide</span>« {last.free.aide} »</blockquote>}
              {last.free.bloque && <blockquote className="m-0 rounded-xl bg-warm-soft px-4 py-3 text-sm"><span className="lbl block mb-1">Ce qui {fille ? 'la' : 'le'} bloque</span>« {last.free.bloque} »</blockquote>}
            </div>
          )}
          <p className="m-0 text-[13px] muted">Pour en parler : partez de ce qu’il a dit (« tu as écrit que… »), demandez ce qui l’aiderait, évitez de juger. Ce qui motive le plus durablement : se sentir capable, avoir un peu de choix, et se sentir soutenu.</p>
        </>
      )}
    </section>
  );
}
