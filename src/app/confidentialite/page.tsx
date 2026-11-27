import { aiOverview, TASKS, type Task } from '@/lib/ai';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Confidentialité' };
export const dynamic = 'force-dynamic';

// Information des parents (RGPD) : quelles données, pourquoi, où, combien de temps, quels droits
export default async function Privacy() {
  const ai = await aiOverview();
  const used = (Object.keys(TASKS) as Task[]).filter(t => ai.enabled && ai.tasks[t]);
  const keep = ai.retention_days >= 730 ? '2 ans' : ai.retention_days >= 365 ? '1 an' : '6 mois';
  return (
    <main className="h-full overflow-y-auto pane bg-[#F6F7FB]">
      <div className="max-w-[820px] mx-auto px-5 py-10 flex flex-col gap-6">
        <Logo id="logo-privacy" />
        <h1 className="text-[30px] font-bold tracking-tight m-0">Confidentialité et protection des données</h1>
        <p className="m-0 text-[16px]">Syllig Study suit le travail scolaire d’enfants, souvent mineurs. Voici, simplement, ce que nous faisons de leurs données.</p>

        <section className="card flex flex-col gap-2">
          <h2 className="text-xl font-semibold m-0">Données enregistrées</h2>
          <ul className="m-0 pl-5 list-disc flex flex-col gap-1">
            <li>Le compte : prénom de l’élève, identifiant, niveau ; e-mail et nom du parent.</li>
            <li>Le travail : leçons, réponses aux exercices et évaluations, notes, temps de travail, journal d’activité.</li>
            <li>Les bilans pédagogiques et tests de positionnement, si le parent les demande.</li>
          </ul>
          <p className="m-0">Elles servent uniquement au suivi scolaire de l’élève par sa famille. Elles ne sont ni vendues, ni utilisées pour de la publicité.</p>
        </section>

        <section className="card flex flex-col gap-2">
          <h2 className="text-xl font-semibold m-0">Intelligence artificielle</h2>
          <p className="m-0">L’IA ne décide de rien : elle <strong>propose</strong> une correction ou un bilan, que le parent relit et valide. Elle n’est utilisée pour un enfant <strong>qu’avec l’accord de son parent</strong>, donné séparément pour la correction et pour le bilan, et retirable à tout moment.</p>
          <ul className="m-0 pl-5 list-disc flex flex-col gap-1">
            <li><strong>Jamais de nom</strong> : les prénoms, identifiants, e-mails, téléphones et adresses sont retirés des réponses avant l’envoi.</li>
            <li><strong>Transparence</strong> : chaque envoi est consigné ; le parent voit exactement ce qui est parti, chez qui et quand (Famille › Bilan).</li>
            <li><strong>Europe d’abord</strong> : les données d’élèves ne partent que chez un fournisseur qui les traite dans l’Union européenne, sauf dérogation explicite de l’administrateur.</li>
          </ul>
          <div className="rounded-xl bg-surface-2 border border-line px-4 py-3 text-sm">
            <strong>Fournisseurs utilisés actuellement</strong>
            {used.length === 0 ? <p className="m-0 mt-1">Aucun : l’IA n’est pas active.</p> : (
              <ul className="m-0 mt-1 pl-5 list-disc">{used.map(t => { const c = ai.tasks[t]!; const p = ai.catalog[c.provider] ?? { name: c.provider, eu: false, where: 'lieu inconnu' }; return (
                <li key={t}>{TASKS[t].label} : <strong>{p.name}</strong>, données traitées {p.eu ? 'dans l’Union européenne' : `aux ${p.where}`}.</li>); })}</ul>
            )}
          </div>
        </section>

        <section className="card flex flex-col gap-2">
          <h2 className="text-xl font-semibold m-0">Durée de conservation</h2>
          <p className="m-0">Le message du lundi (prénom de l’enfant et faits de sa semaine) est envoyé par e-mail seulement au parent qui l’a demandé et a confirmé son adresse, par un service d’envoi que l’administrateur s’engage à choisir dans l’Union européenne (sous-traitant). Chaque e-mail contient un lien pour ne plus le recevoir. Les messages restent visibles sur l’Accueil du parent et sont effacés quand il « repart de zéro » ou quand le compte de l’enfant est supprimé.</p>
          <p className="m-0">Les bilans, tests de positionnement terminés et le journal des envois à l’IA sont effacés automatiquement après <strong>{keep}</strong>. Toutes les données d’un enfant sont effacées quand son compte est supprimé ; le parent peut aussi « repartir de zéro » à tout moment.</p>
        </section>

        <section className="card flex flex-col gap-2">
          <h2 className="text-xl font-semibold m-0">Vos droits</h2>
          <p className="m-0">Vous pouvez à tout moment accéder aux données de votre enfant, les faire rectifier ou effacer, retirer votre accord pour l’IA, ou vous opposer à un traitement. Adressez-vous à l’administrateur de la plateforme. En cas de désaccord, vous pouvez saisir la CNIL (cnil.fr).</p>
        </section>
        <a href="/connexion" className="font-semibold text-sm">‹ Retour</a>
      </div>
    </main>
  );
}
