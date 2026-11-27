'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { ExportSize } from '@/components/ExportSize';
import { publishCoursesDraftsAction, draftWithAiAction, draftWithAiBulkAction, reviewAction, reviewBulkAction } from './cours/[id]/actions';
import { Bot, MoreHorizontal } from 'lucide-react';

export type CatRow = { id: number; code: string | null; title: string; level: string; level_name: string; subject: string; chapter: string; priority: string; published: number | null; draft: number | null; draft_id: string | null; ai_job: string | null; ai_error: string | null; ai_progress: string | null; ai_kind: string | null; review_verdict: string | null; review_count: number | null; size: number | null };

// Catalogue filtrable : recherche, matière, statut
export function CatalogueList({ rows, aiReady, reviewReady }: { rows: CatRow[]; aiReady: boolean; reviewReady: boolean }) {
  const levelList = useMemo(() => [...new Map(rows.map(r => [r.level, r.level_name])).entries()], [rows]);
  // niveau ouvert par défaut : celui où il y a le plus de cours publiés (là où l'on travaille)
  const [level, setLevel] = useState(() => {
    const n = new Map<string, number>();
    for (const r of rows) if (r.published) n.set(r.level, (n.get(r.level) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? levelList[0]?.[0] ?? '';
  });
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState('');
  const subjects = useMemo(() => [...new Set(rows.filter(r => !level || r.level === level).map(r => r.subject))], [rows, level]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = rows.filter(r =>
    (!level || !!q || r.level === level) &&   // une recherche porte sur tous les niveaux
    (!subject || r.subject === subject) &&
    (!status || (status === 'publie' ? !!r.published : status === 'brouillon' ? !!r.draft && (!r.published || r.draft > r.published) : !r.published && !r.draft)) &&
    (!q || norm(`${r.code ?? ''} ${r.title} ${r.chapter}`).includes(norm(q))));
  const sizes = useMemo(() => Object.fromEntries(rows.map(r => [String(r.id), r.size ?? 0])), [rows]);
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
      <BulkBar formId="bulk-catalogue" noun="cours" children={<ExportSize formId="bulk-catalogue" sizes={sizes} />}
        actions={[
          ...(aiReady ? [{ label: 'Rédiger avec l’IA', action: draftWithAiBulkAction, confirm: 'Faire rédiger {n} par l’IA ? Chaque cours arrivera en brouillon dans « À relire » (quelques minutes par cours).' }] : []),
          ...(reviewReady ? [{ label: 'Relire avec l’IA', action: reviewBulkAction, confirm: 'Faire relire {n} par l’IA ? Les problèmes relevés s’afficheront sur chaque cours.' }] : []),
          { label: 'Exporter pour relecture (1 fichier)', action: '/api/contenu/lot' },
          { label: 'Publier les brouillons', action: publishCoursesDraftsAction, confirm: 'Publier les brouillons de {n} ? Les élèves les verront aussitôt. (Les cours sans brouillon sont ignorés.)' }]} />
      <section className="card !p-0 flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden">
        <div className="hidden lg:grid cat-grid px-4 py-2.5 border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted shrink-0">
          <span /><span>Code</span><span>Cours</span><span>Statut</span><span className="text-right">Actions</span>
        </div>
        <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto pane">
          {shown.length === 0 && <span className="muted text-sm p-4">Aucun cours ne correspond.</span>}
          {shown.map(c => <Row key={c.id} c={c} showLevel={!level || !!q} aiReady={aiReady} reviewReady={reviewReady} />)}
        </div>
      </section>
    </div>
  );
}

function Row({ c, showLevel, aiReady, reviewReady }: { c: CatRow; showLevel: boolean; aiReady: boolean; reviewReady: boolean }) {
  const hasDraft = !!c.draft && (!c.published || c.draft > c.published);
  const hasContent = !!(c.published || c.draft);
  const running = c.ai_job === 'en_attente' || c.ai_job === 'en_cours';
  const kind = c.ai_kind === 'relecture' ? 'Relecture' : c.ai_kind === 'cours_corrige' ? 'Correction' : 'Rédaction';
  const status = hasDraft ? { label: `À relire · v${c.draft}`, cls: 'bg-warm-soft text-warm-dark' }
    : c.published ? { label: `Publié · v${c.published}`, cls: 'bg-brand-soft text-brand-dark' } : { label: 'Sans contenu', cls: 'bg-soft text-muted' };
  return (
    <div className="cat-grid grid items-center gap-x-3 gap-y-1.5 px-4 py-2.5 border-t border-soft first:border-t-0 hover:bg-surface-2/60">
      <BulkCheck formId="bulk-catalogue" value={c.id} label={c.title} />
      <span className="text-sm num muted">{c.code ?? '—'}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug">{c.title}</span>
        <span className="block muted text-xs mt-0.5">{c.priority === 'prioritaire' && <span className="text-warm font-semibold" data-tip="Notion prioritaire du programme">▲ Prioritaire · </span>}{showLevel ? `${c.level_name} · ` : ''}{c.subject} · {c.chapter}</span>
      </span>
      <span className="cat-status flex flex-col items-start gap-1">
        <span className={`pill ${status.cls}`}>{status.label}</span>
        {running ? <span className="text-xs text-ink-2 inline-flex items-center gap-1"><Bot size={13} aria-hidden="true" />{kind} IA : {c.ai_progress ?? 'en cours…'}</span>
          : c.ai_job === 'echec' ? <span className="text-xs text-warm-dark font-semibold" data-tip={c.ai_error ?? undefined}>{kind} IA : échec</span>
          : c.review_verdict ? <Link href={`/contenu/cours/${c.id}`} className={`text-xs font-semibold no-underline ${c.review_verdict === 'publiable' ? 'text-brand-dark' : 'text-warm-dark'}`}>
              {c.review_verdict === 'publiable' ? 'Relu par l’IA : publiable' : `Relu par l’IA : ${c.review_count} problème${(c.review_count ?? 0) > 1 ? 's' : ''}`}</Link> : null}
      </span>
      <span className="cat-actions flex items-center justify-end gap-2">
        {hasContent ? <Link href={`/contenu/cours/${c.id}`} className="btn btn-sm">Ouvrir</Link>
          : aiReady && !running ? <form action={draftWithAiAction.bind(null, c.id)}><button className="btn btn-sm btn-primary inline-flex items-center gap-1.5" type="submit"><Bot size={14} aria-hidden="true" />Rédiger avec l’IA</button></form>
          : <Link href={`/contenu/generer/${c.id}`} className="btn btn-sm">Préparer la consigne</Link>}
        <RowMenu>
          {hasContent && reviewReady && !running && <form action={reviewAction.bind(null, c.id)}><button role="menuitem" className="menu-item" type="submit">Relire avec l’IA</button></form>}
          {hasContent && aiReady && !running && <form action={draftWithAiAction.bind(null, c.id)}><button role="menuitem" className="menu-item" type="submit">Nouvelle version par l’IA</button></form>}
          {(hasContent || aiReady) && <Link role="menuitem" className="menu-item" href={`/contenu/generer/${c.id}`}>{hasContent ? 'Nouvelle consigne pour Claude' : 'Préparer la consigne pour Claude'}</Link>}
          {hasContent && <Link role="menuitem" className="menu-item" href={`/contenu/cours/${c.id}`}>Voir le cours et ses versions</Link>}
        </RowMenu>
      </span>
    </div>
  );
}

// Menu « ⋯ » d'une ligne : positionné à l'écran (jamais coupé par la zone qui défile), fermé par Échap ou un clic ailleurs
function RowMenu({ children }: { children: React.ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const btn = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => { if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return; if (e.type === 'mousedown' && (box.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return; setPos(null); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close); window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);
  if (!items.length) return <span className="w-9" />;
  const toggle = () => {
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    const up = r.bottom + 200 > window.innerHeight;
    setPos({ position: 'fixed', right: Math.max(8, window.innerWidth - r.right), ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  };
  return (
    <>
      <button ref={btn} type="button" className="btn btn-sm btn-icon" aria-haspopup="menu" aria-expanded={!!pos} aria-label="Autres actions" data-tip="Autres actions" onClick={toggle}><MoreHorizontal size={16} aria-hidden="true" /></button>
      {pos && <div ref={box} role="menu" className="menu-pop" style={pos} onClick={() => setTimeout(() => setPos(null), 0)}>{items}</div>}
    </>
  );
}
