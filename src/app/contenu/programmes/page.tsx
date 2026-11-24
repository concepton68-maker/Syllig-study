import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Programmes' };
export const dynamic = 'force-dynamic';

type Lvl = { code: string; name: string; cycle: string | null; subjects: number; courses: number; published: number; drafts: number; students: number };
type Sub = { level_code: string; name: string; courses: number; published: number };

// Vue d'ensemble des niveaux : programme officiel chargé, cours rédigés, élèves inscrits
export default async function Programmes() {
  const levels = await sql<Lvl[]>`
    select l.code, l.name, l.cycle,
      (select count(*)::int from subjects s where s.level_code = l.code) as subjects,
      (select count(*)::int from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id where s.level_code = l.code) as courses,
      (select count(distinct c.id)::int from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
         join course_versions v on v.course_id = c.id and v.status = 'published' where s.level_code = l.code) as published,
      (select count(distinct c.id)::int from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
         join course_versions v on v.course_id = c.id and v.status = 'draft' where s.level_code = l.code) as drafts,
      (select count(*)::int from students st where st.level_code = l.code) as students
    from levels l order by l.position, l.name`;
  const subs = await sql<Sub[]>`
    select s.level_code, s.name, count(c.id)::int as courses, count(v.id)::int as published
    from subjects s join chapters ch on ch.subject_id = s.id join courses c on c.chapter_id = ch.id
    left join course_versions v on v.course_id = c.id and v.status = 'published'
    group by s.id, s.level_code, s.name, s.position order by s.position`;
  return (
    <Screen top={<PageTitle kicker="Programmes" title="Niveaux et programmes"
      sub="Chaque niveau charge son programme officiel au démarrage du site. Les cours se rédigent ensuite matière par matière depuis le catalogue." />}>
      {levels.map(l => {
        const pct = l.courses ? Math.round((l.published / l.courses) * 100) : 0;
        return (
          <section key={l.code} className="card flex flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="kpi-icon tone-brand !w-11 !h-11"><GraduationCap size={22} aria-hidden="true" /></span>
                <div><span className="lbl">{l.cycle ?? 'Niveau'}</span><h2 className="text-xl font-bold m-0">{l.name}</h2></div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="pill bg-soft text-ink-2">{l.subjects} matières</span>
                <span className="pill bg-brand-soft text-brand-dark">{l.published} / {l.courses} cours publiés</span>
                {l.drafts > 0 && <span className="pill bg-warm-soft text-warm-dark">{l.drafts} à relire</span>}
                <span className="pill bg-soft text-ink-2">{l.students} élève{l.students > 1 ? 's' : ''}</span>
              </div>
            </header>
            <div className="h-2 bg-track rounded-full overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(pct, 1)}%` }} /></div>
            <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
              {subs.filter(s => s.level_code === l.code).map(s => (
                <div key={s.name} className="rounded-xl border border-line px-3 py-2.5 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold truncate">{s.name}</span>
                  <span className={`num ${s.published ? 'text-brand-dark font-semibold' : 'muted'}`}>{s.published} / {s.courses}</span>
                </div>
              ))}
            </div>
            <div><Link className="btn" href="/contenu">Ouvrir le catalogue</Link></div>
          </section>
        );
      })}
      <p className="muted text-sm m-0 max-w-[760px]">Ajouter un niveau : déposer son programme (<code>content/&lt;niveau&gt;/programme.json</code>) dans le dépôt ; il est chargé automatiquement à la mise en ligne suivante, puis apparaît ici et dans le choix de niveau des élèves.</p>
    </Screen>
  );
}
