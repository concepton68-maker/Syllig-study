'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

export type CatRow = { id: number; code: string | null; title: string; subject: string; chapter: string; priority: string; published: number | null; draft: number | null };

// Catalogue filtrable : recherche, matière, statut
export function CatalogueList({ rows }: { rows: CatRow[] }) {
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState('');
  const subjects = useMemo(() => [...new Set(rows.map(r => r.subject))], [rows]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = rows.filter(r =>
    (!subject || r.subject === subject) &&
    (!status || (status === 'publie' ? !!r.published : status === 'brouillon' ? !!r.draft && (!r.published || r.draft > r.published) : !r.published && !r.draft)) &&
    (!q || norm(`${r.code ?? ''} ${r.title} ${r.chapter}`).includes(norm(q))));
  return (
    <div className="flex flex-col gap-4 lg:flex-1 lg:min-h-0">
      <div className="card !py-3 flex flex-wrap gap-3 items-end shrink-0">
        <label className="flex-[2_1_260px] flex flex-col gap-1 text-sm font-semibold">Rechercher
          <input className="field" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Titre, chapitre ou code (C001…)" /></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Matière
          <select className="field" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Toutes</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Statut
          <select className="field" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tous</option><option value="publie">Publiés</option><option value="brouillon">À relire</option><option value="vide">Sans contenu</option>
          </select></label>
        <span className="muted text-sm pb-3">{shown.length} cours</span>
      </div>
      <section className="card flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto pane">
        {shown.length === 0 && <span className="muted text-sm">Aucun cours ne correspond.</span>}
        {shown.map(c => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft first:border-t-0">
            <span className="w-14 text-sm num muted">{c.code ?? '—'}</span>
            <span className="flex-[1_1_300px] min-w-0"><span className="text-[15px]">{c.title}</span><span className="block muted text-xs">{c.subject} · {c.chapter}</span></span>
            {c.priority === 'prioritaire' && <span className="pill border border-warm text-warm bg-white">▲ Prioritaire</span>}
            {c.published ? <span className="pill bg-brand-soft text-brand-dark">Publié · v{c.published}</span> : null}
            {c.draft && (!c.published || c.draft > c.published) ? <span className="pill bg-warm-soft text-warm-dark">À relire · v{c.draft}</span> : null}
            {(c.published || c.draft) && <Link href={`/contenu/cours/${c.id}`} className="btn">Ouvrir</Link>}
            <Link href={`/contenu/generer/${c.id}`} className="btn">{c.published ? 'Nouvelle consigne' : 'Préparer la consigne'}</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
