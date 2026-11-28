import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { loadCourse } from '../../data';
import { getAttempt, expireIfNeeded } from '@/lib/evaluation';
import { versionById } from '@/lib/progress';
import { bilanData } from '@/lib/bilan';
import { MASTERY } from '@/lib/settings';
import { RichText } from '@/components/RichText';
import { SupportTextView } from '@/components/CourseBlocks';
import { Screen } from '@/components/Layout';
import { FigureView } from '@/components/Figure';

export const dynamic = 'force-dynamic';
const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export default async function Bilan({ params }: { params: Promise<{ id: string; attempt: string }> }) {
  const { id, attempt } = await params;
  const { student, course, progress } = await loadCourse(id);
  if (!z.string().uuid().safeParse(attempt).success) notFound();
  let a = await getAttempt(attempt);
  if (!a || a.student_id !== student.id || a.course_id !== course.id) notFound();
  a = await expireIfNeeded(a);
  if (a.status !== 'submitted' && a.status !== 'graded') notFound();
  const doc = (await versionById(a.version_id))!.document;
  const b = await bilanData(a, doc);
  const variant = doc.evaluation.variants[a.variant % doc.evaluation.variants.length];
  const max = doc.evaluation.total_points;
  const ref = b.previousBest ?? null;
  const gain = b.final && ref !== null ? b.total! - ref : null;
  const mins = a.started_at && a.submitted_at ? Math.round((a.submitted_at.getTime() - a.started_at.getTime()) / 60000) : null;

  // durée réellement accordée (tiers-temps compris)
  const allowed = a.deadline_at && a.started_at ? Math.round((a.deadline_at.getTime() - a.started_at.getTime()) / 60000) : doc.evaluation.duration_min;
  // l'effort est souligné autant que la note (on progresse en essayant, pas seulement en réussissant)
  const qids = variant.sections.flatMap(x => x.questions.map(q => q.id));
  const blank = qids.filter(id => !(a.answers?.[id] ?? '').trim()).length / Math.max(1, qids.length);
  const effort = mins !== null && mins >= allowed * 0.5 && blank < 0.2
    ? { tone: 'ok', text: 'Tu as pris le temps et tout tenté : c’est exactement comme ça qu’on progresse.' }
    : blank >= 0.4 ? { tone: 'tip', text: 'Beaucoup de questions laissées vides : la prochaine fois, tente même sans être sûr(e). C’est en essayant qu’on apprend, et une réponse tentée peut rapporter des points.' }
    : mins !== null && mins < allowed * 0.3 ? { tone: 'tip', text: `Copie rendue en ${mins} min sur ${allowed} : prends le temps de relire, c’est souvent là qu’on gagne des points.` }
    : null;
  let headline: string;
  if (!b.final) headline = 'Copie remise, bravo pour l’effort';
  else if (gain !== null && gain > 0) headline = `Tu as progressé de ${fr(gain)} point${gain >= 2 ? 's' : ''}, bravo ${student.first_name}`;
  else if (gain !== null) headline = `${fr(b.total!)}/${max} : ta meilleure note reste ${fr(Math.max(ref!, b.total!))}/${max}`;
  else headline = b.total! >= 14 ? `${fr(b.total!)}/${max}, très beau travail ${student.first_name}` : `${fr(b.total!)}/${max} : une base pour progresser`;

  return (
    <Screen top={
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div><div className="lbl">{course.subject} · {course.chapter} · ③ Évaluation · tentative {a.attempt_no}</div><strong className="font-[family-name:var(--font-display)] text-lg">{course.title}</strong></div>
        <Link className="btn" href="/eleve">Retour à mon parcours</Link>
      </div>
    }>

      <section className="card p-8 flex flex-wrap gap-8 items-center">
        <div className="flex-[1_1_420px] flex flex-col gap-2.5">
          <span className="lbl">Bilan de ton évaluation</span>
          <h1 className="text-[32px] font-bold leading-tight spark">{headline}</h1>
          <span className="muted text-base">
            {b.final
              ? (ref !== null ? `Ta meilleure note jusqu’ici : ${fr(ref)}/${max}. C’est toujours ta meilleure note qui compte.` : 'C’est ta meilleure note qui compte : tu pourras retenter dans quelques jours pour viser plus haut.')
              : `Questions corrigées automatiquement : ${fr(b.provisional)}/${fr(b.provisionalMax)}. Les réponses rédigées sont en cours de correction ; ton parent valide la note. Les corrigés sont déjà disponibles ci-dessous.`}
          </span>
          {effort && <span data-effort={effort.tone} className={`text-sm rounded-xl px-3.5 py-2.5 ${effort.tone === 'ok' ? 'bg-brand-soft text-brand-ink' : 'bg-soft text-ink-2'}`}>{effort.text}</span>}
        </div>
        {b.final && (
          <div className="flex items-end gap-4" role="img" aria-label={ref !== null ? `Note passée de ${fr(ref)} à ${fr(b.total!)} sur ${max}` : `Note : ${fr(b.total!)} sur ${max}`}>
            {ref !== null && (
              <div className="flex flex-col items-center gap-1.5"><span className="muted font-semibold">{fr(ref)}</span>
                <div className="w-14 bg-brand-mid rounded-t-lg" style={{ height: `${Math.max(8, (ref / max) * 160)}px` }} /><span className="muted text-xs">avant</span></div>
            )}
            <div className="flex flex-col items-center gap-1.5"><span className="font-[family-name:var(--font-display)] text-3xl font-bold text-brand-dark">{fr(b.total!)}<span className="text-base">/{max}</span></span>
              <div className="w-14 bg-brand rounded-t-lg" style={{ height: `${Math.max(8, (b.total! / max) * 160)}px` }} /><span className="text-xs font-semibold">aujourd’hui</span></div>
          </div>
        )}
      </section>

      {b.final && (
        <section className="card flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Ton niveau sur « {course.title} »</h2>
          <ol className="list-none m-0 p-0 flex flex-wrap gap-2" aria-label="Niveaux d’acquisition">
            {MASTERY.labels.slice(1).map((l, i) => {
              const lvl = i + 1, cur = lvl === progress.mastery;
              return <li key={l} aria-current={cur ? 'step' : undefined} className={`flex-[1_1_140px] p-3.5 rounded-xl ${cur ? 'bg-brand text-white' : lvl < progress.mastery ? 'bg-brand-soft text-brand-ink' : 'bg-white border-[1.5px] border-dashed border-brand-mid text-ink-2'}`}><div className="text-sm font-bold">{l}</div></li>;
            })}
          </ol>
          {progress.mastery < 5 && <span className="muted text-sm">Prochain niveau : {progress.mastery < 4 ? `au moins ${MASTERY.evalAcquired}/20 à une prochaine tentative` : `au moins ${MASTERY.evalMastered}/20 sur une tentative passée au moins ${MASTERY.masteredDelayDays} jours après la leçon, pour vérifier que c’est bien retenu`}.</span>}
        </section>
      )}

      {b.final && (
        <div className="flex flex-wrap gap-6 items-start">
          <section className="card flex-[1_1_420px] flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Ce que tu as réussi dans cette évaluation</h2>
            {b.wins.length === 0 && <span className="text-sm muted">Chaque tentative t’en apprend un peu plus : regarde les corrigés, ils te prépareront à la prochaine.</span>}
            {b.wins.map(w => (
              <div key={w.id} className="flex gap-3 items-start p-3 rounded-xl bg-brand-soft">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-dark shrink-0" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                <strong className="text-sm">{w.label}</strong>
              </div>
            ))}
          </section>
          <section className="card flex-[1_1_420px] flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Ta prochaine marche</h2>
            {b.nextStep || b.weakest ? (
              <div className="p-4 rounded-xl border-[1.5px] border-brand-mid flex flex-col gap-2">
                <strong>{b.nextStep?.label ?? 'Peaufiner les détails'}</strong>
                {b.weakest?.q.lesson_part && <span className="text-sm text-ink-2">Relis la partie {b.weakest.q.lesson_part} de la leçon : « {doc.lesson.parts[b.weakest.q.lesson_part - 1]?.title} ».</span>}
                <div className="flex flex-wrap gap-2 mt-1">
                  <Link className="btn btn-primary" href={`/eleve/cours/${course.id}/lecon${b.weakest?.q.lesson_part ? `#partie-${b.weakest.q.lesson_part}` : ''}`}>Revoir la leçon</Link>
                  <Link className="btn" href={`/eleve/cours/${course.id}/exercices`}>Refaire des exercices</Link>
                </div>
              </div>
            ) : <span className="text-sm">Tout est réussi : vise « Maîtrisé » avec une nouvelle tentative dans quelques jours.</span>}
          </section>
        </div>
      )}

      <section className="card flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Corrigés de ta copie</h2>
        {variant.texts.map(t => <SupportTextView key={t.id} t={t} />)}
        {b.results.map(r => (
          <div key={r.q.id} className="border border-line rounded-xl p-4 flex flex-col gap-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{r.q.id.toUpperCase()} · <RichText text={r.q.prompt} /></strong>
              {r.q.figure && <FigureView f={r.q.figure} />}
              <span className={`pill ${r.points === null ? 'bg-soft text-ink-2' : r.points >= r.max ? 'bg-brand text-white' : 'bg-brand-soft text-brand-dark'}`}>{r.points === null ? 'en correction' : `${fr(r.points)} / ${fr(r.max)}`}</span></div>
            <div className="text-sm"><span className="lbl">Ta réponse</span><p className="m-0 mt-1 whitespace-pre-wrap">{r.q.type === 'qcm' && r.q.options ? <RichText text={r.q.options[Number(r.answer)] ?? '—'} /> : r.answer || '—'}</p></div>
            {r.comment && <div className="text-sm rounded-lg bg-soft px-3 py-2"><strong>Commentaire : </strong>{r.comment}</div>}
            <div className="text-sm rounded-lg bg-brand-soft px-3 py-2 text-brand-ink"><strong>Corrigé : </strong><RichText text={r.q.solution} /></div>
          </div>
        ))}
        {a.feedback?.general && <p className="m-0 rounded-xl bg-soft px-4 py-3"><strong>Mot de ton parent : </strong>{a.feedback.general}</p>}
      </section>

      <section className="card bg-surface-2 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col gap-1 flex-[1_1_420px]">
          <h2 className="text-base font-semibold">Conditions de l’évaluation</h2>
          <span className="text-sm text-ink-2">
            {mins !== null ? `Remise en ${mins} min sur ${allowed}` : 'Remise'}{a.late ? ' (après la fin du temps)' : ''} · horodatée par le serveur.
            {a.focus_losses > 0 ? ` ${a.focus_losses} sortie${a.focus_losses > 1 ? 's' : ''} de la fenêtre (${a.focus_lost_seconds} s au total).` : ' Aucune sortie de la fenêtre.'}
          </span>
        </div>
        <span className="pill bg-white border border-line text-ink-2">Session enregistrée</span>
      </section>
    </Screen>
  );
}
