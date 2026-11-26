// Bilan : chaque révision espacée, par cours, et la prochaine date (maquette validée le 26/11/2026). Faits seulement.
type Row = { course_id: number; title: string; subject: string; due_at: Date; results: { at: Date; ok: number; total: number; gap_days: number; passed: boolean }[] };
const fr = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });
const daysTo = (d: Date) => {
  const p = (x: Date) => new Date(x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })).getTime();
  return Math.round((p(d) - p(new Date())) / 864e5);
};

export function RevisionsCard({ r }: { r: { courses: Row[]; ok: number; total: number; count: number } }) {
  return (
    <section className="card flex flex-col gap-3" aria-labelledby="revisions" data-revisions>
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <h2 id="revisions" className="text-lg font-semibold m-0">Révisions <span className="muted font-normal text-sm">· depuis le 1er septembre</span></h2>
        {r.count > 0 && <span className="text-sm" data-revisions-total><strong>{r.ok} questions justes sur {r.total}</strong> <span className="muted">· {r.count} révision{r.count > 1 ? 's' : ''} faite{r.count > 1 ? 's' : ''}</span></span>}
      </div>
      {r.courses.length === 0 ? <p className="m-0 text-sm muted">La première révision est programmée le lendemain d’une leçon finie.</p> : (
        <div className="overflow-x-auto">
          <div className="min-w-[620px] flex flex-col">
            <div className="grid grid-cols-[minmax(200px,1.4fr)_2fr_140px] gap-3 py-2 text-xs font-bold tracking-wide muted border-b border-line"><span>COURS</span><span>CHAQUE RÉVISION</span><span className="text-right">PROCHAINE</span></div>
            {r.courses.map(c => {
              const d = daysTo(c.due_at);
              return (
                <div key={c.course_id} className="grid grid-cols-[minmax(200px,1.4fr)_2fr_140px] gap-3 py-3 border-b border-soft items-center" data-revision-course={c.course_id}>
                  <span><strong className="text-[15px]">{c.title}</strong><span className="block text-[13px] muted">{c.subject}</span></span>
                  <span className="flex flex-wrap gap-1.5">{c.results.length === 0 ? <span className="text-[13px] muted">pas encore de révision</span>
                    : c.results.map((x, i) => <span key={i} data-tip={`le ${fr(x.at)}`} tabIndex={0} className={`pill text-[13px] font-semibold ${x.passed ? 'bg-brand-soft text-brand-dark' : 'bg-warm-soft text-warm-dark'}`}>J+{x.gap_days} · {x.ok}/{x.total}</span>)}</span>
                  <span className="text-right text-sm"><strong>{fr(c.due_at)}</strong><span className="block text-[13px] muted">{d < 0 ? 'en retard' : d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} jours`}</span></span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <span className="text-xs muted">J+n : révision faite n jours après la précédente (ou après la fin de la leçon). 4/5 : questions justes, corrigées par la plateforme. Orange : moins de 4 sur 5.</span>
      <details className="border-t border-line pt-3" data-revisions-sources>
        <summary className="cursor-pointer font-semibold text-[15px]">Comment c’est calculé, et sur quelles études</summary>
        <div className="flex flex-col gap-3 pt-2.5 text-sm leading-relaxed">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            <div className="rounded-xl bg-surface-2 px-3.5 py-3"><strong>La règle</strong><br />Leçon finie → révision le lendemain. Puis 3, 7, 14, 30 et 60 jours si au moins 4 sur 5. Moins de 4 sur 5 → on revient à 1 jour. Au plus 2 cours par jour.</div>
            <div className="rounded-xl bg-surface-2 px-3.5 py-3"><strong>Les questions</strong><br />5 par cours, corrigées par la plateforme (exercices, évaluations, points de contrôle), celles vues le moins récemment en révision ; jamais deux fois de suite la même quand le cours en a assez.</div>
          </div>
          <ul className="m-0 pl-5 flex flex-col gap-1.5">
            <li><strong>Se tester fait mieux retenir que relire</strong> : Roediger &amp; Karpicke (2006), <em>Psychological Science</em> ; méta-analyse Adesope, Trevisan &amp; Sundararajan (2017), <em>Review of Educational Research</em>.</li>
            <li><strong>Espacer fait mieux retenir que tout faire d’un coup</strong> : méta-analyse Cepeda et al. (2006), <em>Psychological Bulletin</em>.</li>
            <li><strong>Les deux techniques jugées les plus utiles sur dix étudiées</strong> : Dunlosky et al. (2013), <em>Psychological Science in the Public Interest</em>.</li>
            <li><strong>Intervalles qui s’allongent après une réussite</strong> : boîtes de Leitner (1972) ; revue Kang (2016), <em>Policy Insights from the Behavioral and Brain Sciences</em>.</li>
          </ul>
          <span className="text-[13px] muted">Ce qui n’est pas prouvé : l’intervalle idéal exact. Il dépend de la date à laquelle on veut retenir (Cepeda et al., 2008). La règle ci-dessus est simple et prudente, pas « optimale ».</span>
        </div>
      </details>
    </section>
  );
}
