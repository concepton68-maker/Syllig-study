'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { publishCoursesDraftsAction, draftWithAiAction, draftWithAiBulkAction } from './cours/[id]/actions';
import { Bot } from 'lucide-react';

export type CatRow = { id: number; code: string | null; title: string; level: string; level_name: string; subject: string; chapter: string; priority: string; published: number | null; draft: number | null; draft_id: string | null; ai_job: string | null; ai_error: string | null; ai_progress: string | null };

// Catalogue filtrable : recherche, matière, statut
export function CatalogueList({ rows, aiReady }: { rows: CatRow[]; aiReady: boolean }) {
  const levelList = useMemo(() => [...new Map(rows.map(r => [r.level, r.level_name])).entries()], [rows]);
  const [level, setLevel] = useState(() => levelList[0]?.[0] ?? '');
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState('');
  const subjects = useMemo(() => [...new Set(rows.filter(r => !level || r.level === level).map(r => r.subject))], [rows, level]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = rows.filter(r =>
    (!level || r.level === level) &&
    (!subject || r.subject === subject) &&
    (!status || (status === 'publie' ? !!r.published : status === 'brouillon' ? !!r.draft && (!r.published || r.draft > r.published) : !r.published && !r.draft)) &&
    (!q || norm(`${r.code ?? ''} ${r.title} ${r.chapter}`).includes(norm(q))));
  return (
    <div className="flex flex-col gap-4 lg:flex-1 lg:min-h-0">
      <div className="card !py-3 flex flex-wrap gap-3 items-end shrink-0">
        <label className="flex-[2_1_260px] flex flex-col gap-1 text-sm font-semibold">Rechercher
          <input className="field" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Titre, chapitre ou code (C001…)" /></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Niveau
          <select className="field" value={level} onChange={e => { setLevel(e.target.value); setSubject(''); }}>
            <option value="">Tous les niveaux</option>{levelList.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Matière
          <select className="field" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Toutes</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Statut
          <select className="field" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tous</option><option value="publie">Publiés</option><option value="brouillon">À relire</option><option value="vide">Sans contenu</option>
          </select></label>
        <span className="muted text-sm pb-3">{shown.length} cours</span>
      </div>
      <BulkBar formId="bulk-catalogue" noun="cours"
        actions={[
          ...(aiReady ? [{ label: 'Rédiger avec l’IA', action: draftWithAiBulkAction, tone: 'primary' as const, confirm: 'Faire rédiger {n} par l’IA ? Chaque cours arrivera en brouillon dans « À relire » (quelques minutes par cours).' }] : []),
          { label: 'Publier les brouillons', action: publishCoursesDraftsAction, confirm: 'Publier les brouillons de {n} ? Les élèves les verront aussitôt. (Les cours sans brouillon sont ignorés.)' }]} />
      <section className="card flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto pane">
        {shown.length === 0 && <span className="muted text-sm">Aucun cours ne correspond.</span>}
        {shown.map(c => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-soft first:border-t-0">
            <BulkCheck formId="bulk-catalogue" value={c.id} label={c.title} />
            <span className="w-14 text-sm num muted">{c.code ?? '—'}</span>
            <span className="flex-[1_1_300px] min-w-0"><span className="text-[15px]">{c.title}</span><span className="block muted text-xs">{level ? '' : `${c.level_name} · `}{c.subject} · {c.chapter}</span></span>
            {c.priority === 'prioritaire' && <span className="pill border border-warm text-warm bg-white">▲ Prioritaire</span>}
            {c.published ? <span className="pill bg-brand-soft text-brand-dark">Publié · v{c.published}</span> : null}
            {c.draft && (!c.published || c.draft > c.published) ? <span className="pill bg-warm-soft text-warm-dark">À relire · v{c.draft}</span> : null}
            {(c.published || c.draft) && <Link href={`/contenu/cours/${c.id}`} className="btn">Ouvrir</Link>}
            {c.ai_job === 'en_attente' || c.ai_job === 'en_cours'
              ? <span className="pill bg-accent-soft text-ink-2 inline-flex items-center gap-1.5"><Bot size={14} aria-hidden="true" />Rédaction IA{c.ai_progress ? ` : ${c.ai_progress}` : ' en cours…'}</span>
              : aiReady && <form action={draftWithAiAction.bind(null, c.id)}><button className="btn inline-flex items-center gap-1.5" type="submit"><Bot size={15} aria-hidden="true" />{c.published || c.draft ? 'Nouvelle version IA' : 'Rédiger avec l’IA'}</button></form>}
            {c.ai_job === 'echec' && <span className="pill bg-warm-soft text-warm-dark" data-tip={c.ai_error ?? undefined}>Échec de la rédaction IA</span>}
            <Link href={`/contenu/generer/${c.id}`} className="btn">{c.published ? 'Nouvelle consigne' : 'Préparer la consigne'}</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
