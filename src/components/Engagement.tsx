import { ClipboardCheck } from 'lucide-react';
import { type Facts } from '@/lib/engagement';

// « Travail et résultats » : les faits mesurés, chacun avec sa définition. Pas de note composite, pas de diagnostic.
const fr = (n: number) => n.toLocaleString('fr-FR');
const day = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const ratio = (a: number, b: number) => b ? `${a} sur ${b}` : '—';

function Row({ label, value, def, testid }: { label: string; value: React.ReactNode; def: string; testid?: string }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-4 py-2 border-t border-soft first:border-t-0" data-fact={testid}>
      <span className="text-sm">{label}<span className="block muted text-[12px]">{def}</span></span>
      <strong className="text-sm tabular-nums text-right">{value}</strong>
    </li>
  );
}

export function EngagementCard({ f, name }: { f: Facts; name: string }) {
  const w = f.work, e = f.evals, l = f.learning;
  return (
    <section className="card flex flex-col gap-4" aria-labelledby="faits-travail" data-facts>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="faits-travail" className="text-xl font-semibold m-0 flex items-center gap-2 mr-auto"><ClipboardCheck size={20} aria-hidden="true" />Travail et résultats de {name}</h2>
        <span className="muted text-sm">du {day(f.from)} au {day(f.to)} (28 jours)</span>
      </div>
      <p className="muted text-sm m-0">Uniquement ce que la plateforme mesure, avec la définition de chaque chiffre. Le travail fourni et les résultats obtenus sont présentés séparément, côte à côte.</p>
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        <div>
          <h3 className="text-base font-semibold m-0 mb-1">Le travail fourni</h3>
          <ul className="list-none m-0 p-0">
            <Row testid="jours" label="Jours travaillés" value={`${w.days} sur 28`} def="jours où le temps effectif cumulé atteint 10 minutes" />
            <Row testid="temps" label="Temps de travail effectif" value={`${fr(w.active_min)} min`} def={`objectif que vous avez fixé : ${fr(w.goal_min)} min sur 28 jours`} />
            <Row testid="actif" label="Part du temps actif sur la page" value={w.open_min ? `${Math.round((w.active_min / w.open_min) * 100)} %` : '—'} def={`${fr(w.active_min)} min actives sur ${fr(w.open_min)} min de page ouverte (pause si la page est cachée ou après 10 min sans rien toucher)`} />
            <Row testid="lecons" label="Leçons terminées" value={String(w.lessons_done)} def={w.lessons_done ? `temps actif sur ces leçons depuis leur début : ${fr(w.lesson_min)} min, pour ${fr(w.lesson_expected_min)} min prévues` : 'aucune sur la période'} />
            <Row testid="copies" label="Copies sans question vide" value={ratio(e.no_blank, e.submitted)} def="copies remises sur la période, notées ou non" />
            <Row testid="temps-copies" label="Temps utilisé pendant les évaluations" value={e.submitted ? `${fr(e.used_min)} min sur ${fr(e.allowed_min)}` : '—'} def="total du temps utilisé sur le total du temps accordé (tiers-temps compris)" />
            <Row testid="sorties" label="Page de l’évaluation masquée" value={String(e.focus_losses)} def="nombre de fois (autre onglet, autre application ou écran verrouillé)" />
          </ul>
        </div>
        <div>
          <h3 className="text-base font-semibold m-0 mb-1">Les résultats obtenus</h3>
          <ul className="list-none m-0 p-0">
            <Row testid="moy-completes" label="Moyenne des copies sans question vide" value={e.full.avg === null ? '—' : `${fr(e.full.avg)}/20`} def={e.full.n ? `${e.full.n} copie${e.full.n > 1 ? 's' : ''} notée${e.full.n > 1 ? 's' : ''}` : 'aucune copie notée'} />
            <Row testid="moy-incompletes" label="Moyenne des copies avec questions vides" value={e.withBlank.avg === null ? '—' : `${fr(e.withBlank.avg)}/20`} def={e.withBlank.n ? `${e.withBlank.n} copie${e.withBlank.n > 1 ? 's' : ''} notée${e.withBlank.n > 1 ? 's' : ''}` : 'aucune copie notée'} />
            <Row testid="controles" label="Points de contrôle réussis du premier coup" value={ratio(l.cp_ok, l.cp_total)} def="questions de la leçon, premier essai" />
            <Row testid="exercices" label="Exercices réussis (corrigés par la plateforme)" value={ratio(l.ex_ok, l.ex_total)} def={l.self_total ? `+ ${l.self_ok} sur ${l.self_total} réponses rédigées jugées réussies par ${name} (auto-évaluation)` : 'questions à correction automatique'} />
            {e.pending > 0 && <Row testid="attente" label="Copies en attente de correction" value={String(e.pending)} def="pas encore comptées dans les moyennes" />}
          </ul>
        </div>
      </div>
      {f.subjects.length > 0 && (
        <details className="text-sm" data-facts-subjects>
          <summary className="cursor-pointer muted">Par matière</summary>
          <div className="overflow-x-auto">
            <table className="w-full mt-2 text-sm min-w-[520px]">
              <thead><tr className="text-left muted"><th className="py-1 font-medium">Matière</th><th className="font-medium">Temps effectif</th><th className="font-medium">Contrôles 1er coup</th><th className="font-medium">Exercices</th><th className="font-medium">Copies sans question vide</th></tr></thead>
              <tbody>{f.subjects.map(s => (
                <tr key={s.subject} className="border-t border-soft"><td className="py-1">{s.subject}</td><td>{s.active_min} min</td><td>{ratio(s.cp_ok, s.cp_total)}</td><td>{ratio(s.ex_ok, s.ex_total)}</td>
                  <td>{s.full.length ? `${s.full.length} · moy. ${fr(Math.round((s.full.reduce((a, b) => a + b, 0) / s.full.length) * 10) / 10)}/20` : '—'}{s.withBlank ? ` · ${s.withBlank} avec questions vides` : ''}{s.pending ? ` · ${s.pending} en correction` : ''}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
