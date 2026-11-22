import Link from 'next/link';
import { loadCourse } from '../data';
import { lessonState } from './state';
import { Checkpoint } from './Checkpoint';
import { BlockView } from '@/components/CourseBlocks';
import { RichText } from '@/components/RichText';
import { ActivityTracker } from '@/components/ActivityTracker';
import { completeLessonWithoutCheckpoint } from './actions';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, course, version, doc, progress } = await loadCourse(id);
  const st = await lessonState(student.id, course.id, version.id, doc, !!progress.lesson_done_at);
  const visible = st.current === -1 ? doc.lesson.parts.length : st.current + 1;
  const done = st.current === -1;
  const pct = Math.round((st.passed.filter(Boolean).length / doc.lesson.parts.length) * 100);

  return (
    <>
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link className="btn" href={`/eleve/cours/${course.id}`}>‹ Quitter</Link>
          <div><div className="lbl">{course.subject} · {course.chapter}{course.code ? ` · ${course.code}` : ''}</div>
            <strong className="font-[family-name:var(--font-display)] text-lg">{course.title} · ① Leçon</strong></div>
        </div>
        <div className="flex items-center gap-2.5"><ActivityTracker kind="lesson" courseId={course.id} idleSeconds={student.settings.idle_seconds} />
          <span className="pill bg-soft text-ink-2">{done ? 'Leçon terminée' : `Partie ${st.current + 1} sur ${doc.lesson.parts.length}`}</span></div>
        <div className="w-full h-1 bg-[#EEF0F3] rounded-full overflow-hidden"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        <nav aria-label="Plan de la leçon" className="card p-4 flex-[1_1_240px] max-w-[300px] flex flex-col gap-1.5">
          <span className="lbl px-1.5 pb-1.5">Plan</span>
          {doc.lesson.parts.map((p, i) => {
            const cur = i === st.current, ok = st.passed[i];
            return (
              <a key={i} href={i < visible ? `#partie-${i + 1}` : undefined} aria-disabled={i >= visible}
                className={`flex gap-2.5 p-2.5 rounded-lg text-sm font-semibold no-underline ${cur ? 'bg-brand text-white' : ok ? 'bg-brand-soft text-[#1E2A78]' : 'text-[#667085]'}`}>
                <span className="w-4">{ok ? '✓' : i + 1}</span>{p.title}
              </a>
            );
          })}
          {doc.lesson.memo && <span className={`p-2.5 text-sm font-semibold ${done ? 'text-[#1E2A78]' : 'text-[#667085]'}`}>★ Fiche mémo</span>}
          <span className="muted text-xs px-1.5 pt-2">Chaque partie s’ouvre après le point de contrôle de la précédente.</span>
        </nav>

        <article className="flex-[999_1_560px] min-w-0 flex flex-col gap-5">
          {doc.lesson.objectives.length > 0 && (
            <section className="card"><span className="lbl">Objectifs · à la fin de cette leçon, je sais</span>
              <ul className="mt-2 mb-0 pl-5 list-disc">{doc.lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
              {doc.lesson.essential && <div className="mt-4"><BlockView block={{ type: 'callout', kind: 'essentiel', text: doc.lesson.essential }} /></div>}
            </section>
          )}
          {doc.lesson.parts.slice(0, visible).map((p, i) => (
            <div key={i} className="flex flex-col gap-5">
              <section id={`partie-${i + 1}`} className="card p-8 flex flex-col gap-4 scroll-mt-28">
                <span className="lbl text-brand-dark">Partie {i + 1}</span>
                <h2 className="text-[26px] font-bold">{p.title}</h2>
                {p.blocks.map((b, j) => <BlockView key={j} block={b} />)}
              </section>
              {i === st.current && st.checkpoint && <Checkpoint key={`${i}-${st.checkpoint.attempt}`} courseId={id} partIndex={i} total={doc.lesson.parts.length} initial={st.checkpoint} />}
            </div>
          ))}
          {done && (
            <>
              {doc.lesson.memo && (
                <section className="card p-8 flex flex-col gap-3">
                  <span className="lbl text-brand-dark">Fiche mémo</span>
                  <h2 className="text-2xl font-bold">À retenir en un coup d’œil</h2>
                  <table className="tbl"><tbody>{doc.lesson.memo.map((m, i) => <tr key={i}><td className="font-semibold w-48">{m.label}</td><td><RichText text={m.text} /></td></tr>)}</tbody></table>
                </section>
              )}
              {progress.lesson_done_at ? (
                <section className="card bg-brand-soft border-brand-mid flex flex-wrap justify-between items-center gap-3">
                  <span><strong>Leçon terminée.</strong> Prochaine étape : t’entraîner avec les exercices.</span>
                  <Link className="btn btn-primary" href={`/eleve/cours/${course.id}/exercices`}>② Faire les exercices</Link>
                </section>
              ) : (
                <form action={completeLessonWithoutCheckpoint.bind(null, id)} className="card flex justify-between items-center gap-3">
                  <span>Tu as lu toute la leçon.</span><button className="btn btn-primary" type="submit">J’ai terminé la leçon</button>
                </form>
              )}
            </>
          )}
        </article>
      </div>
    </>
  );
}
