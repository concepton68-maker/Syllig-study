import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';
import { MasteryPill } from '@/components/Mastery';
import { ResetCourse, ResetStudent } from './ResetForms';
import { RulesForm } from './RulesForm';
import { ResetForm } from '../Forms';
import { setForcedAction } from './actions';

export const metadata = { title: 'Fiche enfant' };
export const dynamic = 'force-dynamic';

type Row = { course_id: number; title: string; subject: string; mastery: number; best: string | null; attempts: number; minutes: number; last: Date | null };
type Pub = { course_id: number; title: string; subject: string; mastery: number; forced: string | null };
const TABS = [
  { id: 'cours', label: 'Cours' },
  { id: 'regles', label: 'Règles et thème' },
  { id: 'compte', label: 'Compte' },
  { id: 'zero', label: 'Repartir de zéro' },
] as const;

// Fiche d'un enfant : tout ce que le parent règle pour lui, au même endroit
export default async function ChildSheet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string; reinitialise?: string; t?: string; p?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { onglet } = sp;
  const tab = TABS.some(t => t.id === onglet) ? onglet! : 'cours';
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, id);
  const [acc] = await sql<{ login: string; last_login_at: Date | null }[]>`select login, last_login_at from users where id = ${s.user_id}`;

  let body: React.ReactNode = null;
  if (tab === 'cours') {
    const rows = await sql<Row[]>`
      with touched as (
        select course_id from course_progress where student_id = ${s.id} and (mastery > 0 or lesson_done_at is not null)
        union select course_id from eval_attempts where student_id = ${s.id}
        union select course_id from exercise_submissions where student_id = ${s.id}
        union select course_id from work_sessions where student_id = ${s.id} and course_id is not null)
      select c.id as course_id, c.title, sj.name as subject, coalesce(p.mastery, 0) as mastery, p.best_eval_score as best,
        (select count(*)::int from eval_attempts a where a.student_id = ${s.id} and a.course_id = c.id) as attempts,
        (select coalesce(sum(active_seconds), 0)::int / 60 from work_sessions w where w.student_id = ${s.id} and w.course_id = c.id) as minutes,
        (select max(started_at) from work_sessions w where w.student_id = ${s.id} and w.course_id = c.id) as last
      from touched t join courses c on c.id = t.course_id join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
      left join course_progress p on p.student_id = ${s.id} and p.course_id = c.id
      order by last desc nulls last, c.position`;
    const pub = await sql<Pub[]>`
      select c.id as course_id, c.title, sj.name as subject, coalesce(p.mastery, 0) as mastery, p.forced
      from courses c join chapters ch on ch.id = c.chapter_id join subjects sj on sj.id = ch.subject_id
      join course_versions v on v.course_id = c.id and v.status = 'published'
      left join course_progress p on p.student_id = ${s.id} and p.course_id = c.id
      where sj.level_code = ${s.level_code} order by sj.position, c.position`;
    const [resetTitle] = sp.reinitialise ? await sql<{ title: string }[]>`select title from courses where id = ${Number(sp.reinitialise) || 0}` : [];
    body = (
      <>
        {resetTitle && <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-3 text-sm"><strong>« {resetTitle.title} » est remis à zéro.</strong> {Number(sp.t) || 0} tentative(s) d’évaluation et {Number(sp.p) || 0} gain(s) de points effacés ; le cours redevient « Pas encore commencé ».</p>}
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold">Cours commencés</h2>
          <p className="muted text-sm mt-1 mb-3">Réinitialiser un cours efface ses tentatives et ses notes : elles ne comptent plus nulle part (moyenne, niveaux, points).</p>
          {rows.length === 0 && <span className="muted text-sm">Aucun cours commencé pour l’instant.</span>}
          {rows.map(r => (
            <div key={r.course_id} className="flex flex-wrap items-center gap-3 py-3 border-t border-soft text-sm">
              <span className="flex-[1_1_260px] min-w-0"><strong>{r.title}</strong><span className="block muted">{r.subject}</span></span>
              <MasteryPill level={r.mastery} />
              <span className="w-32">{r.attempts} tentative{r.attempts > 1 ? 's' : ''}{r.best ? ` · ${Number(r.best).toLocaleString('fr-FR')}/20` : ''}</span>
              <span className="w-20 muted">{r.minutes} min</span>
              <ResetCourse studentId={s.id} courseId={r.course_id} title={r.title} />
            </div>
          ))}
        </section>
        <section className="card flex flex-col">
          <h2 className="text-xl font-semibold">Ordre du parcours</h2>
          <p className="muted text-sm mt-1 mb-3">Par défaut, le parcours suit les priorités du programme. Vous pouvez faire passer un cours en premier, ou le repousser.</p>
          {pub.length === 0 && <span className="muted text-sm">Aucun cours publié pour ce niveau.</span>}
          {pub.map(c => (
            <form key={c.course_id} action={setForcedAction} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft text-sm">
              <input type="hidden" name="student" value={s.id} /><input type="hidden" name="course" value={c.course_id} />
              <span className="flex-[1_1_260px] min-w-0"><strong>{c.title}</strong><span className="block muted">{c.subject}</span></span>
              <MasteryPill level={c.mastery} />
              <select className="field w-auto min-w-[200px]" name="forced" defaultValue={c.forced ?? ''} aria-label={`Place de « ${c.title} » dans le parcours`}>
                <option value="">Ordre normal</option><option value="now">À faire en premier</option><option value="later">Plus tard</option>
              </select>
              <button className="btn" type="submit">Appliquer</button>
            </form>
          ))}
        </section>
      </>
    );
  } else if (tab === 'regles') {
    body = (
      <>
        <section className="card max-w-[900px]"><RulesForm studentId={s.id} s={s.settings} /></section>
        <section className="card max-w-[900px] bg-surface-2 flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Ce que Syllig Study ne fait jamais</h2>
          <ul className="m-0 pl-5 list-disc text-sm text-ink-2 flex flex-col gap-1"><li>Filmer, enregistrer le micro ou l’écran</li><li>Lire ce que l’élève fait hors de Syllig Study</li><li>Comparer l’élève à d’autres ou afficher un classement</li></ul>
        </section>
      </>
    );
  } else if (tab === 'compte') {
    body = (
      <section className="card max-w-[900px] flex flex-col gap-4">
        <div><span className="lbl">Identifiant de connexion</span><p className="m-0 mt-1 text-lg font-semibold">{acc?.login}</p>
          <span className="muted text-sm">{acc?.last_login_at ? `Dernière connexion le ${acc.last_login_at.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : 'Jamais connecté'}</span></div>
        <div><span className="lbl">Changer son mot de passe</span><div className="mt-2"><ResetForm studentId={s.id} /></div></div>
      </section>
    );
  } else {
    body = (
      <section className="card max-w-[900px] flex flex-col gap-2 border-warm-mid">
        <h2 className="text-xl font-semibold text-warm-dark">Repartir de zéro</h2>
        <ResetStudent studentId={s.id} firstName={s.first_name} />
      </section>
    );
  }

  return (
    <Screen top={<div className="flex flex-col gap-4">
      <PageTitle kicker="Enfants" title={s.first_name} sub={`${s.level_name} · identifiant ${acc?.login ?? '—'}`}>
        <Link className="btn" href="/parent/enfants">‹ Tous les enfants</Link>
      </PageTitle>
      <nav aria-label="Rubriques" className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map(t => (
          <Link key={t.id} href={`/parent/enfants/${s.id}?onglet=${t.id}`} aria-current={tab === t.id ? 'page' : undefined}
            className={`navlink border ${tab === t.id ? 'bg-brand text-white border-brand hover:bg-brand-dark hover:text-white' : 'border-line'}`}>{t.label}</Link>
        ))}
      </nav>
    </div>}>
      {body}
    </Screen>
  );
}
