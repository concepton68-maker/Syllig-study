import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Compass, Gauge, Lightbulb, ListChecks, Sparkles } from 'lucide-react';
import { sql } from '@/lib/db';
import { requireParent } from '@/lib/access';
import { aiOverview } from '@/lib/ai';
import { studentProfile, type CourseFacts, type Profile } from '@/lib/profile';
import { type ReportData } from '@/lib/report';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { ChildPicker } from '@/components/ChildPicker';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { AiButton } from '../a-faire/AiButton';
import { requestReport, assignPlacement, assignEntry, requestCheckin, deleteReports, deletePlacementTests, saveAiConsent, deleteAiRequests } from './actions';
import { ShieldCheck } from 'lucide-react';
import { workFacts } from '@/lib/engagement';
import { entryBank } from '@/lib/entry-test';
import { EngagementCard } from '@/components/Engagement';
import { CheckinCard, type CheckinRow } from '@/components/Checkin';
import { TrajectoryCard } from '@/components/Trajectory';
import { trajectory } from '@/lib/trajectory';
import { subjectSummary, schoolYearStart } from '@/lib/subject-summary';
import { reviewOverview } from '@/lib/revisions';
import { RevisionsCard } from '@/components/RevisionsCard';
import { WeeklyBars } from '@/components/TrajectoryChart';
import { SubjectCards } from '@/components/SubjectCards';
import { Fold, OpenFromHash } from '@/components/Fold';
import { duree } from '@/lib/duration';

export const metadata = { title: 'Bilan' };
export const dynamic = 'force-dynamic';

type Report = { id: string; created_at: Date; provider: string; model: string; data: ReportData; indicators: Profile };
type Test = { id: string; report_id: string | null; created_at: Date; status: string; score: number | null; total: number | null; duration_min: number;
  started_at: Date | null; submitted_at: Date | null; results: { matiere: string; notion: string; niveau_origine: string; correct: boolean; vide: boolean }[] | null };
const day = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });
const fr = (n: number) => n.toLocaleString('fr-FR');

export default async function Bilan({ searchParams }: { searchParams: Promise<{ eleve?: string; rapport?: string; erreur?: string; note?: string; test?: string; consentement?: string }> }) {
  const sp = await searchParams;
  const { students, student } = await requireParent(sp.eleve);
  if (!student) return <Screen top={<PageTitle kicker="Bilan" title="Aucun enfant" />}><p className="muted">Ajoutez d’abord un enfant.</p></Screen>;
  const ai = await aiOverview();
  const aiOn = ai.ready.bilan;
  const [profile, eng, traj, sum] = await Promise.all([studentProfile(student.id), workFacts(student.id), trajectory(student.id), subjectSummary(student.id, student.level_code)]);
  const revs = await reviewOverview(student.id, student.level_code, (await schoolYearStart()).start);
  const reports = await sql<Report[]>`select id, created_at, provider, model, data, indicators from student_reports where student_id = ${student.id} order by created_at desc limit 30`;
  // ancienne consigne (avant le 25/11/2026) : le bilan attribuait une « origine » et une « implication » ; jamais affiché par défaut
  const oldStyle = (r: Report) => 'origine' in (r.data as object) || 'implication' in (r.data as object);
  const shown = reports.find(r => r.id === sp.rapport) ?? reports.find(r => !oldStyle(r));
  const tests = await sql<Test[]>`select id, report_id, created_at, status, score, total, duration_min, started_at, submitted_at, results
    from placement_tests where student_id = ${student.id} order by created_at desc limit 20`;
  const openTest = tests.find(t => t.status !== 'termine');
  const bank = entryBank(student.level_code);
  const checkins = await sql<CheckinRow[]>`select created_at, answers, free from student_checkins where student_id = ${student.id} order by created_at desc limit 2`;
  const name = student.first_name;
  const consent = { correction: !!student.settings.ai_correction, bilan: !!student.settings.ai_bilan };
  const sent = await sql<{ id: string; task: string; provider: string; model: string; eu: boolean; payload: string; error: string | null; created_at: Date }[]>`
    select id::text, task, provider, model, eu, payload, error, created_at from ai_requests where student_id = ${student.id} order by created_at desc limit 50`;
  const where = (t: 'correction' | 'bilan') => { const c = ai.tasks[t]; const i = c ? ai.catalog[c.provider] : null; return i ? `${i.name} (${i.eu ? 'Union européenne' : i.where})` : 'aucune IA configurée'; };

  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent/bilan" />
      <PageTitle kicker="Bilan" title={`Bilan de ${name}`} />
    </>}>
      {sp.erreur && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm">{sp.erreur}</p>}
      {sp.note && <p role="status" className="m-0 rounded-xl bg-soft px-4 py-3 text-sm">{sp.note}</p>}
      {sp.consentement && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>Choix enregistrés pour {name}.</strong> Vous pouvez les changer à tout moment.</p>}
      {sp.test === 'propose' && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>Test proposé à {name}.</strong> Il apparaît dans son espace, rubrique « Aujourd’hui ». Les résultats s’afficheront ici.</p>}

      <SubjectCards s={sum} />
      <RevisionsCard r={revs} />

      <section className="card flex flex-col gap-2" aria-labelledby="temps-semaine" data-weekly-time>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="temps-semaine" className="text-lg font-semibold m-0">Temps de travail par semaine <span className="muted font-normal text-sm">· 12 dernières semaines</span></h2>
          <span className="text-[13px] muted">pointillés : objectif {duree(student.settings.weekly_goal_minutes)} · semaine en cours en pointillés</span></div>
        <WeeklyBars unit="hhmm" goal={student.settings.weekly_goal_minutes} bars={traj.weeks.map(w => ({ key: w.week, label: w.label, value: w.minutes, current: w.current,
          tip: w.started ? [`Semaine du ${w.label}${w.current ? ' (en cours)' : ''}`, `${duree(w.minutes)} de travail`, `${w.days} jour${w.days > 1 ? 's' : ''} avec 10 min ou plus`] : [`Semaine du ${w.label}`, 'avant la première activité'] }))} />
        {traj.timeNote && <span className="muted text-xs" data-rule-note>{traj.timeNote}</span>}
      </section>

      <section className="card flex flex-col !py-3" aria-labelledby="plus" data-more>
        <OpenFromHash />
        <h2 id="plus" className="text-lg font-semibold m-0 py-2">Pour aller plus loin</h2>
        <Fold id="test" title="Test de positionnement" sub={tests[0] ? (tests[0].status === 'termine' ? `fait le ${day(tests[0].submitted_at ?? tests[0].created_at)}${tests[0].total ? ` · ${tests[0].score} / ${tests[0].total}` : ''}` : 'proposé, pas encore terminé') : 'pas encore fait'} open={!!sp.test}>
      <section className="card flex flex-col gap-3" aria-labelledby="positionnement">
        <h2 id="positionnement" className="text-xl font-semibold m-0 flex items-center gap-2"><Compass size={20} aria-hidden="true" />Test de positionnement</h2>
        <p className="muted text-sm m-0">Un court test sur les bases des années précédentes, corrigé automatiquement. Il ne compte pas dans les notes. Il donne un score par matière et la liste des questions ratées, à vérifier ensuite.</p>
        {shown && !openTest && shown.data.test_positionnement.questions.length > 0 && (
          <form action={assignPlacement.bind(null, shown.id)} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 border border-line px-4 py-3">
            <span className="flex-1 text-sm"><strong>Test préparé par le bilan du {day(shown.created_at)}</strong> · {shown.data.test_positionnement.questions.length} questions sur {[...new Set(shown.data.test_positionnement.questions.map(q => q.notion))].slice(0, 4).join(', ')}{shown.data.test_positionnement.questions.length > 4 ? '…' : ''}</span>
            <button className="btn btn-primary" type="submit">Proposer ce test à {name}</button>
          </form>
        )}
        {bank && !openTest && (
          <form action={assignEntry.bind(null, student.id)} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 border border-line px-4 py-3" data-entry-test>
            <span className="flex-1 text-sm"><strong>Test de rentrée de {student.level_name}</strong> · {bank.questions.length} questions sur les bases des années précédentes ({[...new Set(bank.questions.map(q => q.matiere))].join(', ')}), environ {bank.duree_min} min. Sans IA, rien n’est envoyé.</span>
            <button className="btn" type="submit">Proposer le test de rentrée</button>
          </form>
        )}
        {tests.length === 0 ? <p className="m-0 text-sm">{shown || bank ? '' : 'Demandez d’abord un bilan : il prépare le test.'}</p> : (
          <>
            {tests.length > 1 && <BulkBar formId="bulk-tests" noun="test" actions={[{ label: 'Retirer', action: deletePlacementTests, tone: 'danger', confirm: 'Retirer {n} ? Les réponses éventuelles seront effacées.' }]} />}
            {tests.map(t => <TestRow key={t.id} t={t} name={name} multi={tests.length > 1} />)}
          </>
        )}
      </section>
        </Fold>
        <Fold id="questionnaire" title="Ses réponses « Comment je travaille »" sub={checkins.length ? `dernières réponses le ${day(checkins[0].created_at)}` : 'pas encore rempli'}>
          <CheckinCard rows={checkins} name={name} requestAction={requestCheckin.bind(null, student.id)} requested={!!(student.settings as { checkin_requested?: boolean }).checkin_requested} fille={student.settings.gender === 'fille'} />
        </Fold>
        <Fold id="bilan-ia-plus" title="Bilan rédigé par l’IA" sub={shown ? `dernier bilan le ${day(shown.created_at)}` : aiOn ? 'demander un bilan' : 'IA non configurée'} open={!!sp.rapport}>
      <section className="card flex flex-col gap-4" aria-labelledby="bilan-ia">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="bilan-ia" className="text-xl font-semibold m-0 flex items-center gap-2"><Sparkles size={20} aria-hidden="true" />Bilan par l’IA</h2>
          {aiOn && !consent.bilan ? <a className="btn" href="#confidentialite">Autoriser le bilan par l’IA</a> : aiOn
            ? <form action={requestReport.bind(null, student.id)}><AiButton n={0} label={reports.length ? 'Nouveau bilan' : 'Demander un bilan'} busy="Rédaction du bilan… (une à deux minutes)" /></form>
            : <span className="muted text-sm">IA non configurée pour le bilan : Contenu › IA.</span>}
        </div>
        {!shown ? <p className="m-0 text-sm">Aucun bilan pour l’instant. L’IA lit les chiffres ci-dessus (sans le prénom de {name}) et rédige un bilan pour vous.</p>
          : <ReportView r={shown} name={name} />}
      </section>
      {reports.length > 1 && (
        <section className="card flex flex-col" aria-labelledby="historique">
          <h2 id="historique" className="text-lg font-semibold mb-2">Bilans précédents</h2>
          <div className="mb-2"><BulkBar formId="bulk-bilans" noun="bilan" actions={[{ label: 'Supprimer', action: deleteReports, tone: 'danger', confirm: 'Supprimer {n} ? (les leçons à créer déjà proposées restent dans l’espace Contenu)' }]} hidden={{ eleve: student.id }} /></div>
          {reports.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
              <BulkCheck formId="bulk-bilans" value={r.id} label={`bilan du ${day(r.created_at)}`} />
              <span className="flex-1"><strong>{day(r.created_at)}</strong><span className="muted"> · {ai.catalog[r.provider]?.name ?? r.provider}</span>{oldStyle(r) && <span className="block text-[13px] text-warm-dark">Ancienne consigne : ce bilan supposait des causes. Demandez un nouveau bilan.</span>}</span>
              {r.id === shown?.id ? <span className="pill bg-brand-soft text-brand-dark">Affiché</span> : <Link className="font-semibold" href={`/parent/bilan?eleve=${student.id}&rapport=${r.id}`}>Voir</Link>}
            </div>
          ))}
        </section>
      )}
        </Fold>
        <Fold id="chiffres" title="Tous les chiffres détaillés" sub="28 jours, 12 semaines, cours par cours">
          <EngagementCard f={eng} name={name} idleMin={student.settings.idle_seconds / 60} />
          <TrajectoryCard tr={traj} name={name} goalMin={student.settings.weekly_goal_minutes} />
      <section className="card flex flex-col gap-3" aria-labelledby="faits">
        <h2 id="faits" className="text-xl font-semibold m-0 flex items-center gap-2"><Gauge size={20} aria-hidden="true" />Ce que montrent les chiffres</h2>
        <p className="muted text-sm m-0">
          {profile.global.courses} cours commencé{profile.global.courses > 1 ? 's' : ''} · {duree(profile.global.active_min)} de travail sur {profile.global.days_active} jour{profile.global.days_active > 1 ? 's' : ''}
          {' · '}{profile.global.evaluations ? `moyenne des évaluations ${fr(profile.global.eval_avg!)}/20 (${profile.global.evaluations})` : 'aucune évaluation notée'}
        </p>
        {profile.courses.length === 0 ? <p className="m-0 text-sm">Pas encore de travail enregistré.</p> : (
          <div className="flex flex-col">
            {profile.courses.map(c => <CourseRow key={c.course_id} c={c} />)}
          </div>
        )}
        <p className="muted text-xs m-0">Temps de travail : page de travail visible à l’écran, réflexion et brouillon compris ; il s’arrête si la page est cachée (autre onglet, fenêtre réduite, écran verrouillé) ou après {student.settings.idle_seconds / 60} min sans rien toucher, et ces minutes ne comptent pas si personne ne répond à « Tu es là ? ». Chiffres depuis l’inscription.</p>
      </section>
        </Fold>
        <Fold id="confidentialite" title="Confidentialité et IA" sub={`correction par l’IA : ${consent.correction ? 'oui' : 'non'} · bilan par l’IA : ${consent.bilan ? 'oui' : 'non'}`} open={!!sp.consentement}>
      <section className="card flex flex-col gap-3" aria-labelledby="rgpd">
        <h2 id="rgpd" className="text-xl font-semibold m-0 flex items-center gap-2"><ShieldCheck size={20} aria-hidden="true" />Confidentialité et IA</h2>
        <p className="m-0 text-sm">Rien n’est envoyé à une IA pour {name} sans votre accord. Ce qui part ne contient <strong>jamais</strong> son nom : prénoms, identifiants, e-mails, téléphones et adresses sont retirés des réponses avant l’envoi.</p>
        <form action={saveAiConsent.bind(null, student.id)} className="flex flex-col gap-3">
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="ai_correction" defaultChecked={consent.correction} className="w-5 h-5 mt-0.5 accent-[var(--color-brand)]" />
            <span><strong>Correction des copies par l’IA</strong><span className="block muted">Envoyé : les énoncés, corrigés et réponses rédigées. Chez : {where('correction')}.</span></span>
          </label>
          <label className="flex items-start gap-2.5 text-sm ml-8">
            <input type="checkbox" name="auto_correction" defaultChecked={student.settings.auto_correction} className="w-5 h-5 mt-0.5 accent-[var(--color-brand)]" />
            <span><strong>Automatique</strong> : chaque copie est corrigée dès sa remise. Vous validez toujours la note.</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="ai_bilan" defaultChecked={consent.bilan} className="w-5 h-5 mt-0.5 accent-[var(--color-brand)]" />
            <span><strong>Bilan pédagogique et test de positionnement par l’IA</strong><span className="block muted">Envoyé : temps de travail, notes, questions ratées et réponses. Chez : {where('bilan')}.</span></span>
          </label>
          <div className="ml-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><strong>Bilan automatique</strong>
              <select className="field !py-1.5 !min-h-0" name="auto_bilan" defaultValue={student.settings.auto_bilan}>
                <option value="off">Non, je le demande moi-même</option><option value="3_evals">Toutes les 3 évaluations notées</option><option value="hebdo">Chaque semaine (s’il y a eu du travail)</option>
              </select></label>
            <label className="flex items-center gap-2"><input type="checkbox" name="auto_test" defaultChecked={student.settings.auto_test} className="w-5 h-5 accent-[var(--color-brand)]" />
              Proposer automatiquement le test de positionnement</label>
          </div>
          <p className="m-0 muted text-xs">Les automatismes ne fonctionnent qu’avec l’accord correspondant ci-dessus. Les résultats arrivent dans « À faire » et sur cette page.</p>
          <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary" type="submit">Enregistrer mes choix</button>
            <Link href="/confidentialite" className="font-semibold text-sm">Comment sont protégées les données ?</Link></div>
        </form>
        <h3 className="text-base font-semibold m-0 mt-2">Ce qui a été envoyé à une IA</h3>
        {sent.length === 0 ? <p className="m-0 text-sm muted">Aucun envoi pour {name}.</p> : (
          <>
            <BulkBar formId="bulk-envois" noun="envoi" actions={[{ label: 'Effacer du journal', action: deleteAiRequests, tone: 'danger', confirm: 'Effacer {n} du journal ? (le fournisseur ne conserve pas ces données au-delà de ses propres règles)' }]} />
            {sent.map(r => (
              <div key={r.id} className="flex flex-wrap items-start gap-3 py-2.5 border-t border-soft text-sm">
                <BulkCheck formId="bulk-envois" value={r.id} label={`envoi du ${day(r.created_at)}`} />
                <details className="flex-1 min-w-0">
                  <summary className="cursor-pointer"><strong>{r.task === 'bilan' ? 'Bilan' : 'Correction'}</strong> · {r.created_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{ai.catalog[r.provider]?.name ?? r.provider} <span className={r.eu ? 'text-brand-dark' : 'text-warm-dark'}>({r.eu ? 'UE' : 'hors UE'})</span>{r.error ? <span className="text-warm-dark"> · échec</span> : ''}</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-surface-2 border border-line p-3 text-xs whitespace-pre-wrap break-words">{r.payload}</pre>
                </details>
              </div>
            ))}
          </>
        )}
        <p className="muted text-xs m-0">Les bilans et ce journal sont effacés automatiquement après {ai.retention_days >= 730 ? '2 ans' : ai.retention_days >= 365 ? '1 an' : '6 mois'}.</p>
      </section>
        </Fold>
      </section>
    </Screen>
  );
}

function CourseRow({ c }: { c: CourseFacts }) {
  const e = c.evaluations.at(-1);
  return (
    <div className="grid gap-x-4 gap-y-1.5 py-3 border-t border-soft text-sm md:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]">
      <span className="min-w-0"><strong>{c.title}</strong><span className="block muted">{c.subject}</span></span>
      <Fact label="Leçon (temps de travail / durée prévue)" value={c.lesson.active_min || c.lesson.done ? `${duree(c.lesson.active_min)} / ${duree(c.lesson.expected_min)}` : '—'} />
      <Fact label="Contrôles 1er coup" value={c.checkpoints.parts ? `${c.checkpoints.first_try_ok} / ${c.checkpoints.parts}` : '—'} />
      <Fact label="Exercices, meilleure série (corrigés par la plateforme)" value={c.exercises.score !== null ? `${c.exercises.score}/10` : '—'} />
      <Fact label="Évaluation" value={e ? `${e.score === null ? 'en correction' : `${fr(e.score)}/20`}${e.used_min ? ` · ${duree(e.used_min)} / ${duree(e.allowed_min)}` : ''}` : '—'} />
    </div>
  );
}
const Fact = ({ label, value }: { label: string; value: string }) => (
  <span className="flex md:flex-col justify-between gap-2"><span className="muted text-xs uppercase tracking-wide font-semibold">{label}</span><span className="num">{value}</span></span>
);

function ReportView({ r, name }: { r: Report; name: string }) {
  const d = r.data;
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 muted text-xs">Bilan du {day(r.created_at)} · rédigé par {r.provider} ({r.model}) à partir des faits ci-dessus · à lire comme une proposition</p>
      <p className="m-0 text-[15.5px] leading-relaxed">{d.synthese}</p>
      {d.matieres.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold m-0">Matière par matière</h3>
          {d.matieres.map((m, i) => (
            <div key={i} className="rounded-xl border border-line px-4 py-3 text-sm">
              <strong>{m.matiere}</strong> — {m.constat}
              <div className="grid gap-2 sm:grid-cols-2 mt-2">
                {m.points_forts.length > 0 && <div><span className="lbl text-brand-dark">Réussi dans les copies</span><ul className="m-0 pl-5 list-disc">{m.points_forts.map((x, j) => <li key={j}>{x}</li>)}</ul></div>}
                {m.points_faibles.length > 0 && <div><span className="lbl text-warm-dark">Raté dans les copies</span><ul className="m-0 pl-5 list-disc">{m.points_faibles.map((x, j) => <li key={j}>{x}</li>)}</ul></div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {d.lacunes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-semibold m-0 flex items-center gap-2"><ListChecks size={18} aria-hidden="true" />Notions à revoir (erreurs constatées)</h3>
          {d.lacunes.map((l, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-baseline text-sm py-1.5 border-t border-soft">
              <span className={`pill ${l.gravite === 'haute' ? 'bg-warm-soft text-warm-dark' : 'bg-soft text-ink-2'}`}>{l.gravite === 'haute' ? 'Prioritaire' : l.gravite === 'moyenne' ? 'Important' : 'À surveiller'}</span>
              <strong>{l.notion}</strong><span className="muted">{l.matiere} · niveau {l.niveau_origine}</span>
              <span className="basis-full muted">{l.preuve}</span>
            </div>
          ))}
        </div>
      )}
      {d.conseils_parents.length > 0 && (
        <div className="rounded-2xl bg-brand-soft text-brand-ink px-4 py-3">
          <span className="lbl flex items-center gap-1.5"><Lightbulb size={15} aria-hidden="true" />Conseils pour vous</span>
          <ul className="m-0 mt-1.5 pl-5 list-disc text-sm flex flex-col gap-1">{d.conseils_parents.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {d.lecons_a_creer.length > 0 && <p className="m-0 text-sm"><strong>{d.lecons_a_creer.length} leçon{d.lecons_a_creer.length > 1 ? 's' : ''} de rattrapage proposée{d.lecons_a_creer.length > 1 ? 's' : ''}</strong> : {d.lecons_a_creer.map(l => `${l.titre} (${l.niveau})`).join(' · ')}. Elles sont transmises à l’espace Contenu (« À créer »).</p>}
      <p className="m-0 muted text-sm"><strong>Limites :</strong> {d.limites}</p>
      <p className="m-0 muted text-xs">Ce bilan éclaire, il ne décide pas : pour un redoublement ou une orientation, il complète l’avis des professeurs et du conseil de classe.</p>
    </div>
  );
}

function TestRow({ t, name, multi }: { t: Test; name: string; multi: boolean }) {
  const used = t.started_at && t.submitted_at ? Math.max(1, Math.round((t.submitted_at.getTime() - t.started_at.getTime()) / 60000)) : null;
  // résultats tels quels : score par matière, puis les questions ratées ou laissées vides comme pistes à vérifier
  // (une question par notion ne permet pas d'affirmer qu'une notion est sue ou non)
  const bySubject = new Map<string, { ok: number; n: number }>();
  for (const r of t.results ?? []) { const e = bySubject.get(r.matiere) ?? { ok: 0, n: 0 }; e.n++; if (r.correct) e.ok++; bySubject.set(r.matiere, e); }
  const missed = (t.results ?? []).filter(r => !r.correct);
  return (
    <div className="flex flex-col gap-2 py-3 border-t border-soft text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {multi && <BulkCheck formId="bulk-tests" value={t.id} label={`test du ${day(t.created_at)}`} />}
        <span className="flex-1"><strong>Test du {day(t.created_at)}</strong> · {t.total} questions · {duree(t.duration_min)} prévues</span>
        <span className={`pill ${t.status === 'termine' ? 'bg-brand-soft text-brand-dark' : 'bg-soft text-ink-2'}`}>
          {t.status === 'termine' ? `Fait : ${t.score}/${t.total}${used ? ` en ${duree(used)}` : ''}` : t.status === 'en_cours' ? `${name} l’a commencé` : `Proposé à ${name}`}
        </span>
      </div>
      {t.status === 'termine' && (
        <>
          {used !== null && used < t.duration_min * 0.25 && <p className="m-0 rounded-lg bg-warm-soft text-warm-dark px-3 py-2">Fait très vite ({duree(used)} pour {duree(t.duration_min)} prévues) : les résultats sont à prendre avec prudence.</p>}
          <div className="flex flex-wrap gap-1.5" data-test-subjects>
            {[...bySubject.entries()].map(([m, e]) => <span key={m} className="pill bg-soft text-ink-2">{m} : {e.ok} sur {e.n}</span>)}
          </div>
          {missed.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Questions ratées ou sans réponse : pistes à vérifier</span>
              <ul className="m-0 pl-5 list-disc flex flex-col gap-0.5" data-test-missed>
                {missed.map((r, i) => <li key={i}>{r.notion} <span className="muted">· {r.matiere} · niveau {r.niveau_origine}{r.vide ? ' · sans réponse' : ''}</span></li>)}
              </ul>
              <span className="muted text-xs">Une seule question par notion : une erreur signale une notion à vérifier (par un exercice ou une explication), elle ne prouve pas à elle seule qu’elle n’est pas sue.</span>
            </div>
          )}
          <p className="m-0 muted text-xs">Demandez un nouveau bilan : il tiendra compte de ce test.</p>
        </>
      )}
    </div>
  );
}
