import { sql } from '@/lib/db';
import Link from 'next/link';
import { loadCourse } from '../data';
import { lessonState } from './state';
import { LessonBook, type BookPage } from './Book';
import { ActivityTracker } from '@/components/ActivityTracker';
import { PaneScreen } from '@/components/Layout';
import { completeLessonWithoutCheckpoint } from './actions';
import { skipCourse } from '../../../skip-actions';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, course, version, doc, progress } = await loadCourse(id);
  const st = await lessonState(student.id, course.id, version.id, doc, !!progress.lesson_done_at);
  const done = st.current === -1;
  const parts = doc.lesson.parts;
  // seules les parties ouvertes sont envoyées au navigateur
  const pages: BookPage[] = [
    { kind: 'intro', title: course.title, objectives: doc.lesson.objectives, essential: doc.lesson.essential },
    ...parts.map((p, i): BookPage => ({
      kind: 'part', index: i, title: p.title, passed: st.passed[i], hasCheckpoint: !!p.checkpoint,
      blocks: done || i <= st.current ? p.blocks : null,
    })),
    { kind: 'memo', title: 'Fiche mémo', memo: done ? (doc.lesson.memo ?? []) : null },
  ];
  // page d'ouverture : la partie en cours (ou la fiche mémo si tout est validé ; l'intro au tout début)
  const firstVisit = st.current === 0 && !st.checkpoint?.attempt;
  const startPage = done ? pages.length - 1 : firstVisit ? 0 : st.current + 1;

  // « +50 points » annoncé seulement juste après les avoir gagnés (pas à chaque retour sur la page)
  const [{ fresh }] = await sql<{ fresh: boolean }[]>`select exists (select 1 from points_ledger where student_id = ${student.id} and course_id = ${course.id}
    and reason = 'Leçon terminée' and at > now() - interval '15 minutes') as fresh`;
  return (
    <PaneScreen top={
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 qhead">
        <div className="flex items-center gap-3 flex-wrap">
          <Link className="btn" href={`/eleve/cours/${course.id}`}>‹ Quitter</Link>
          <div><div className="lbl">{course.subject} · {course.chapter}{course.code ? ` · ${course.code}` : ''}</div>
            <h1 className="font-[family-name:var(--font-display)] !text-lg font-bold m-0 leading-snug">{course.title} · ① Leçon</h1></div>
        </div>
        <div className="flex items-center gap-2.5"><ActivityTracker kind="lesson" courseId={course.id} idleSeconds={student.settings.idle_seconds} />
          <span className="pill bg-soft text-ink-2">{done ? 'Leçon terminée' : `Partie ${st.current + 1} sur ${parts.length}`}</span>
          {!done && <form action={skipCourse.bind(null, course.id)}><button className="btn" type="submit" data-skip>Passer cette leçon</button></form>}</div>
      </div>
    }>
      <LessonBook pointsJustEarned={fresh} courseId={id} pages={pages} startPage={startPage} current={st.current} checkpoint={st.checkpoint}
        totalParts={parts.length} lessonDone={!!progress.lesson_done_at} exercisesHref={`/eleve/cours/${course.id}/exercices`}
        finishAction={completeLessonWithoutCheckpoint.bind(null, id)} />
    </PaneScreen>
  );
}
