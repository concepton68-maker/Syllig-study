import Link from 'next/link';
import { GradeForm } from './GradeForm';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';
import { getAttempt } from '@/lib/evaluation';
import { versionById } from '@/lib/progress';
import { evalQuestions } from '@/lib/course-format';
import { RichText } from '@/components/RichText';
import { SupportTextView } from '@/components/CourseBlocks';
import { validateGrade } from '../actions';
import { Screen } from '@/components/Layout';
import { duree } from '@/lib/duration';

export const dynamic = 'force-dynamic';

export default async function CopyReview({ params, searchParams }: { params: Promise<{ attempt: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { attempt } = await params;
  const { erreur } = await searchParams;
  const u = await requireUser('parent');
  if (!z.string().uuid().safeParse(attempt).success) notFound();
  const a = await getAttempt(attempt);
  if (!a || !['submitted', 'graded'].includes(a.status)) notFound();
  const student = await assertParentOf(u.id, a.student_id);
  const doc = (await versionById(a.version_id))!.document;
  const [c] = await sql<{ title: string }[]>`select title from courses where id = ${a.course_id}`;
  const variant = doc.evaluation.variants[a.variant % doc.evaluation.variants.length];
  const qs = evalQuestions(doc, a.variant);
  const graded = a.status === 'graded';
  const val = (id: string) => graded ? a.scores?.[id] : a.proposal?.[id]?.points;
  const com = (id: string) => graded ? a.feedback?.[id] : a.proposal?.[id]?.comment;
  const mins = a.started_at && a.submitted_at ? Math.max(1, Math.round((a.submitted_at.getTime() - a.started_at.getTime()) / 60000)) : null;

  return (
    <Screen top={
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="lbl">{student.first_name} · tentative {a.attempt_no}</span>
          <h1 className="text-[28px] font-bold">{c.title}</h1>
          <span className="muted text-sm">{mins !== null ? `Remise en ${duree(mins)} sur ${duree(doc.evaluation.duration_min)}` : ''}{a.focus_losses ? ` · ${a.focus_losses} sortie(s) de fenêtre (${a.focus_lost_seconds} s)` : ' · aucune sortie de fenêtre'}{a.paste_blocked ? ` · ${a.paste_blocked} collage(s) bloqué(s)` : ''}</span>
        </div>
        <Link className="btn" href="/parent/a-faire">‹ À faire</Link>
      </div>
    }>
      {!graded && !a.proposal && <p className="m-0 rounded-xl bg-soft px-4 py-3 text-sm">Pas encore de proposition de Claude pour cette copie : vous pouvez l’exporter depuis la page précédente, ou corriger vous-même avec le corrigé et le barème.</p>}
      {erreur && <p role="alert" className="m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm">{erreur === 'motif' ? 'Indiquez le motif de la modification.' : `Points invalides pour ${erreur.toUpperCase()}.`}</p>}

      <GradeForm action={validateGrade} graded={graded} firstName={student.first_name}
        maxima={Object.fromEntries(qs.map(q => [q.id, q.points ?? 0]))}
        autoTotal={0}>
        <input type="hidden" name="attempt" value={a.id} />
        {variant.texts.map(t => <SupportTextView key={t.id} t={t} />)}
        {qs.map(q => {
          const auto = !!a.auto_scores && q.id in a.auto_scores;
          return (
            <section key={q.id} className="card flex flex-col gap-3">
              <div className="flex flex-wrap justify-between gap-2"><strong>{q.id.toUpperCase()} · <RichText text={q.prompt} /></strong><span className="pill bg-soft text-ink-2">/ {q.points}</span></div>
              <div className="rounded-lg border border-line px-3 py-2"><span className="lbl">Réponse de l’élève</span><p className="m-0 mt-1 whitespace-pre-wrap">{q.type === 'qcm' && q.options ? <RichText text={q.options[Number(a.answers[q.id])] ?? '—'} /> : a.answers[q.id] || '—'}</p></div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex-[1_1_300px] rounded-lg bg-brand-soft px-3 py-2 text-brand-ink"><strong>Corrigé : </strong><RichText text={q.solution} /></div>
                {q.rubric && <div className="flex-[1_1_300px] rounded-lg bg-soft px-3 py-2"><strong>Barème : </strong><RichText text={q.rubric} /></div>}
              </div>
              {auto ? (
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="flex flex-col gap-1 text-sm font-semibold w-36">Points (automatique)
                    <input className="field" name={`p_${q.id}`} inputMode="decimal" required defaultValue={String(graded && a.scores ? a.scores[q.id] ?? a.auto_scores![q.id] : a.auto_scores![q.id]).replace('.', ',')} />
                  </label>
                  <span className="muted text-sm flex-[1_1_300px] pb-2.5">Corrigée automatiquement ({String(a.auto_scores![q.id]).replace('.', ',')} / {q.points}). Ajustez si la réponse mérite des points partiels (par exemple une petite faute).</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="flex flex-col gap-1 text-sm font-semibold w-36">Points {!graded && a.proposal?.[q.id] ? '(proposés)' : ''}
                    <input className="field" name={`p_${q.id}`} inputMode="decimal" required aria-describedby={`max_${q.id}`} defaultValue={val(q.id)?.toString().replace('.', ',') ?? ''} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-semibold flex-[1_1_360px]">Commentaire pour l’élève
                    <input className="field" name={`c_${q.id}`} defaultValue={com(q.id) ?? ''} />
                  </label>
                </div>
              )}
            </section>
          );
        })}
        <section className="card flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">Mot général pour {student.first_name} (facultatif)
            <textarea className="field min-h-20" name="general" defaultValue={(graded ? a.feedback?.general : a.proposal?.general?.comment) ?? ''} />
          </label>
          {graded && <label className="flex flex-col gap-1 text-sm font-semibold">Motif de la modification (obligatoire, reste tracé dans le journal)<input className="field" name="motif" maxLength={300} /></label>}
        </section>
      </GradeForm>
    </Screen>
  );
}
