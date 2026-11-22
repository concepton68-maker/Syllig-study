import Link from 'next/link';
import { sql } from '@/lib/db';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Catalogue' };

type Row = { level: string; subject: string; chapter: string; id: number; code: string | null; title: string; priority: string; published: number | null; draft: number | null };

export default async function Catalogue() {
  const rows = await sql<Row[]>`
    select l.name as level, s.name as subject, ch.name as chapter, c.id, c.code, c.title, c.priority,
      (select version from course_versions v where v.course_id = c.id and v.status = 'published') as published,
      (select max(version) from course_versions v where v.course_id = c.id and v.status = 'draft') as draft
    from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    order by l.position, s.position, ch.position, c.position`;
  const total = rows.length, pub = rows.filter(r => r.published).length;
  const groups = new Map<string, Map<string, Row[]>>();
  for (const r of rows) {
    const k = `${r.level} · ${r.subject}`;
    if (!groups.has(k)) groups.set(k, new Map());
    const g = groups.get(k)!;
    if (!g.has(r.chapter)) g.set(r.chapter, []);
    g.get(r.chapter)!.push(r);
  }
  return (
    <Screen top={<>
      <PageTitle kicker="Catalogue" title={`${pub} cours publiés sur ${total}`} sub="Pour créer un cours : « Préparer la consigne », la coller dans Claude, puis importer le JSON obtenu.">
        <Link className="btn btn-primary" href="/contenu/importer">Importer un cours</Link>
      </PageTitle>
    </>}>
      {[...groups].map(([subject, chapters]) => (
        <section key={subject} className="card flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{subject}</h2>
          {[...chapters].map(([chapter, courses]) => (
            <div key={chapter}>
              <div className="lbl mb-1">{chapter}</div>
              <ul className="m-0 p-0 list-none">
                {courses.map(c => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-soft">
                    <span className="w-16 text-sm font-mono muted">{c.code ?? '—'}</span>
                    <span className="flex-[1_1_260px] text-[15px]">{c.title}</span>
                    {c.priority === 'prioritaire' && <span className="pill bg-warm-soft text-warm">Prioritaire</span>}
                    {c.published ? <span className="pill bg-brand-soft text-brand-dark">Publié · v{c.published}</span> : null}
                    {c.draft && (!c.published || c.draft > c.published) ? <span className="pill bg-soft text-ink-2">Brouillon · v{c.draft}</span> : null}
                    {(c.published || c.draft) && <Link href={`/contenu/cours/${c.id}`} className="text-sm font-semibold">Ouvrir</Link>}
                    <Link href={`/contenu/generer/${c.id}`} className="text-sm font-semibold">{c.published ? 'Nouvelle consigne' : 'Préparer la consigne'}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </Screen>
  );
}
