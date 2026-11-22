import { notFound } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import { validateCourse, type CourseDocument, type Question } from '@/lib/course-format';
import { PageTitle } from '@/components/Shell';
import { BlockView, SupportTextView, Stars } from '@/components/CourseBlocks';
import { RichText } from '@/components/RichText';
import { publishAction } from './actions';
import { Screen } from '@/components/Layout';

type V = { id: string; version: number; status: string; document: CourseDocument; imported_at: Date; source_name: string | null; published_at: Date | null };

function QuestionAdmin({ q }: { q: Question }) {
  return (
    <div className="border border-line rounded-xl p-4 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <strong>{q.id}</strong><Stars n={q.stars} />
        {q.points !== undefined && <span className="pill bg-soft text-ink-2">{q.points} pt{q.points > 1 ? 's' : ''}</span>}
        <span className="pill bg-soft text-ink-2">{({ open: 'Rédigée', qcm: 'QCM', numeric: 'Numérique', short: 'Réponse courte' })[q.type]}</span>
        {q.lesson_part && <span className="muted">Partie {q.lesson_part}</span>}
        {q.skills?.map(s => <span key={s} className="pill bg-brand-soft text-brand-dark">{s}</span>)}
      </div>
      <p className="m-0 text-[15px]"><RichText text={q.prompt} /></p>
      {q.options && <ol className="m-0 pl-6 list-[upper-alpha] text-sm">{q.options.map((o, i) => <li key={i} className={((Array.isArray(q.answer) ? q.answer : [q.answer]) as unknown[]).includes(i) ? 'font-bold text-brand-dark' : ''}>{o}</li>)}</ol>}
      {(q.type === 'numeric' || q.type === 'short') && <p className="m-0 text-sm"><strong>Réponse attendue :</strong> {Array.isArray(q.answer) ? q.answer.join(' · ') : String(q.answer)}{q.tolerance ? ` (± ${q.tolerance})` : ''}</p>}
      <div className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-ink"><strong>Corrigé :</strong> <RichText text={q.solution} /></div>
      {q.rubric && <div className="rounded-lg bg-soft px-3 py-2 text-sm"><strong>Barème :</strong> <RichText text={q.rubric} /></div>}
    </div>
  );
}

export default async function CoursePreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; importe?: string; onglet?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();
  const versions = await sql<V[]>`select id, version, status, document, imported_at, source_name, published_at from course_versions where course_id = ${courseId} order by version desc`;
  if (!versions.length) notFound();
  const tab = ['lecon', 'exercices', 'evaluation'].includes(sp.onglet ?? '') ? sp.onglet! : 'lecon';
  const v = versions.find(x => x.id === sp.v) ?? versions.find(x => x.status === 'draft') ?? versions.find(x => x.status === 'published') ?? versions[0];
  const doc = v.document;
  const check = validateCourse(doc);
  const warnings = check.warnings;

  return (
    <Screen top={<>
      <PageTitle kicker={`${doc.subject} · ${doc.chapter} · ${doc.code}`} title={doc.title}
        sub={`Version ${v.version} · ${({ draft: 'brouillon', published: 'publiée', archived: 'archivée' } as Record<string, string>)[v.status]} · importée le ${v.imported_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}${v.source_name ? ` depuis ${v.source_name}` : ''}`}>
        {v.status === 'draft' && (
          <form action={publishAction}>
            <input type="hidden" name="version" value={v.id} /><input type="hidden" name="course" value={courseId} />
            <button className="btn btn-primary" type="submit">Publier cette version</button>
          </form>
        )}
        <Link className="btn" href="/contenu/importer">Importer une nouvelle version</Link>
      </PageTitle>
    </>}>

      {sp.importe && <p role="status" className="rounded-xl bg-brand-soft text-brand-ink px-4 py-3 m-0 text-sm"><strong>Import réussi.</strong> Relis le cours ci-dessous (vue complète avec corrigés), puis publie-le.</p>}
      {warnings.length > 0 && (
        <div className="rounded-xl bg-soft px-4 py-3"><strong className="text-sm">Remarques du contrôle automatique</strong>
          <ul className="text-sm mt-2 mb-0 pl-5 list-disc">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {versions.map(x => <Link key={x.id} href={`?v=${x.id}&onglet=${tab}`} className={`pill ${x.id === v.id ? 'bg-brand text-white' : 'bg-white border border-line text-ink-2'}`}>v{x.version} · {({ draft: 'brouillon', published: 'publiée', archived: 'archivée' } as Record<string, string>)[x.status]}</Link>)}
      </div>

      <nav aria-label="Parties du cours" className="flex flex-wrap gap-2 border-b border-line pb-3">
        {[['lecon', '① Leçon'], ['exercices', '② Exercices'], ['evaluation', '③ Évaluation et corrigés']].map(([id, label]) => (
          <Link key={id} href={`?v=${v.id}&onglet=${id}`} aria-current={tab === id ? 'page' : undefined}
            className={`navlink border ${tab === id ? 'bg-brand text-white border-brand hover:bg-brand-dark hover:text-white' : 'border-line'}`}>{label}</Link>
        ))}
      </nav>

      {tab === 'lecon' && <section className="card flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">① Leçon · {doc.lesson.duration_min} min</h2>
        {doc.lesson.objectives.length > 0 && <ul className="m-0 pl-6 list-disc">{doc.lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>}
        {doc.lesson.essential && <BlockView block={{ type: 'callout', kind: 'essentiel', text: doc.lesson.essential }} />}
        {doc.lesson.parts.map((p, i) => (
          <div key={i} className="flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-xl font-semibold">Partie {i + 1} · {p.title}</h3>
            {p.blocks.map((b, j) => <BlockView key={j} block={b} />)}
            {p.checkpoint && (
              <div className="rounded-xl border-2 border-brand p-4 flex flex-col gap-3">
                <span className="lbl text-brand-dark">Point de contrôle · {p.checkpoint.variants.length} variantes</span>
                {p.checkpoint.variants.map((cv, k) => (
                  <div key={k} className="text-sm">
                    <strong>{k + 1}. {cv.prompt}</strong>{cv.quote && <em className="block muted">« {cv.quote} »</em>}
                    <ol className="m-0 pl-6 list-[upper-alpha]">{cv.options.map((o, l) => <li key={l} className={l === cv.answer ? 'font-bold text-brand-dark' : ''}>{o}</li>)}</ol>
                    {cv.hint && <span className="muted">Indice : {cv.hint}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {doc.lesson.memo && (
          <div className="border-t border-line pt-4"><h3 className="text-xl font-semibold mb-2">Fiche mémo</h3>
            <table className="tbl"><tbody>{doc.lesson.memo.map((m, i) => <tr key={i}><td className="font-semibold w-48">{m.label}</td><td><RichText text={m.text} /></td></tr>)}</tbody></table></div>
        )}
      </section>}

      {tab === 'exercices' && <section className="card flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">② Exercices · {doc.exercises.duration_min} min · seuil {doc.exercises.pass_threshold}/10</h2>
        {doc.exercises.instructions && <p className="m-0">{doc.exercises.instructions}</p>}
        {doc.exercises.texts.map(t => <SupportTextView key={t.id} t={t} />)}
        {doc.exercises.items.map(q => <QuestionAdmin key={q.id} q={q} />)}
      </section>}

      {tab === 'evaluation' && <section className="card flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">③ Évaluation · {doc.evaluation.duration_min} min · /{doc.evaluation.total_points} · {doc.evaluation.variants.length} sujet{doc.evaluation.variants.length > 1 ? 's' : ''}</h2>
        {doc.evaluation.conditions && <p className="m-0">{doc.evaluation.conditions}</p>}
        {doc.evaluation.variants.map((ev, vi) => (
          <div key={vi} className="flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-xl font-semibold">Sujet {vi + 1}</h3>
            {ev.texts.map(t => <SupportTextView key={t.id} t={t} />)}
            {ev.sections.map((s, si) => (
              <div key={si} className="flex flex-col gap-3"><div className="lbl">{s.label}</div>{s.questions.map(q => <QuestionAdmin key={q.id} q={q} />)}</div>
            ))}
          </div>
        ))}
      </section>}
    </Screen>
  );
}
