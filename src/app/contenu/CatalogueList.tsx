'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { Pipeline } from './Relecture';
import { publishCoursesDraftsAction, draftWithAiAction, draftWithAiBulkAction, reviewAction, reviewBulkAction } from './cours/[id]/actions';
import { Bot, MoreHorizontal } from 'lucide-react';

export type CatRow = { id: number; code: string | null; title: string; level: string; level_name: string; subject: string; chapter: string; priority: string; published: number | null; draft: number | null; draft_id: string | null; ai_job: string | null; ai_error: string | null; ai_progress: string | null; ai_kind: string | null; review_verdict: string | null; review_count: number | null; size: number | null; live: boolean };

// Catalogue filtrable : recherche, matière, statut
export function CatalogueList({ rows, levels, aiReady, reviewReady }: { rows: CatRow[]; levels: { code: string; name: string; subjects: number }[]; aiReady: boolean; reviewReady: boolean }) {
  const levelList = useMemo(() => levels.map(l => [l.code, l.name] as [string, string]), [levels]);
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
  const toReview = rows.filter(r => !!r.draft && (!r.published || r.draft > r.published)).length;
  const pub = rows.filter(r => r.published).length, empty = rows.filter(r => !r.published && !r.draft).length;
  const fld = 'field !w-auto lg:max-w-[180px] !min-h-9 !py-1 text-sm';
  // écran fixe : en-tête et filtres sur une ligne, circuit de relecture, puis la liste (seule zone qui défile), actions en bas
  return (
    <div className="flex flex-col gap-2.5 lg:flex-1 lg:min-h-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 shrink-0" data-cat-head>
        <h1 className="m-0 text-[22px] font-bold">Catalogue</h1>
        <span className="text-[13px] muted" data-cat-stats>{pub} publié{pub > 1 ? 's' : ''} · {toReview} à relire · {empty} sans contenu</span>
        <span className="flex-1" />
        <input className={`${fld} !w-full sm:!w-52 lg:!max-w-none`} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher (titre, chapitre, code)" aria-label="Rechercher" />
        <select className={fld} aria-label="Niveau" value={level} onChange={e => { setLevel(e.target.value); setSubject(''); }}>
          <option value="">Tous les niveaux</option>{levelList.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
        <select className={fld} aria-label="Matière" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Toutes matières</option>{subjects.map(s => <option key={s}>{s}</option>)}</select>
        <select className={fld} aria-label="Statut" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tous statuts</option><option value="publie">Publiés</option><option value="brouillon">À relire</option><option value="vide">Sans contenu</option></select>
        <Link className="btn btn-sm" href="/contenu/importer">Importer un fichier</Link>
      </div>
      <Pipeline formId="bulk-catalogue" sizes={sizes} toReview={toReview} />
      <section className="card !p-0 flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden">
        <div className="hidden lg:grid cat-grid px-3 py-2 border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted shrink-0">
          <span /><span>Code</span><span>Cours</span><span>Matière · chapitre</span><span>Statut</span><span className="text-right">{shown.length} cours</span>
        </div>
        <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto pane">
          {shown.length === 0 && (level && !q && !rows.some(r => r.level === level)
            ? <div className="p-5 flex flex-col gap-2 text-sm max-w-[640px]" data-empty-level>
                <strong className="text-base">Aucun cours en {levels.find(l => l.code === level)?.name} pour l’instant</strong>
                <span>Les cours se créent à partir du programme du niveau : ses matières, ses chapitres et la liste de ses cours. {(levels.find(l => l.code === level)?.subjects ?? 0) > 0 ? 'Les matières sont là : ajoute maintenant les chapitres et les cours.' : 'Commence par ajouter ses matières.'} Le programme peut être proposé par l’IA ou préparé par Claude, puis vérifié. Ensuite, chaque cours apparaît ici, prêt à être rédigé.</span>
                <span className="flex flex-wrap gap-2 mt-1"><Link className="btn btn-primary btn-sm" href={`/contenu/programmes?niveau=${level}`}>Préparer le programme</Link>
                  <Link className="btn btn-sm" href={`/contenu/programmes?niveau=${level}`}>Importer un programme (fichier)</Link></span>
              </div>
            : <span className="muted text-sm p-4">Aucun cours ne correspond.</span>)}
          {shown.map(c => <Row key={c.id} c={c} showLevel={!level || !!q} aiReady={aiReady} reviewReady={reviewReady} />)}
        </div>
      </section>
      <div className="shrink-0">
        <BulkBar formId="bulk-catalogue" noun="cours" children={<span className="contents" data-launch-slot="bulk-catalogue" />}
          actions={[
            ...(aiReady ? [{ label: 'Rédiger avec l’IA', action: draftWithAiBulkAction, confirm: 'Faire rédiger {n} par l’IA ? Chaque cours arrivera en brouillon dans « À relire » (quelques minutes par cours).' }] : []),
            ...(reviewReady ? [{ label: 'Relire avec l’IA', action: reviewBulkAction, confirm: 'Faire relire {n} par l’IA ? Les problèmes relevés s’afficheront sur chaque cours.' }] : []),
            { label: 'Publier les brouillons', action: publishCoursesDraftsAction, confirm: 'Publier les brouillons de {n} ? Les élèves les verront aussitôt. (Les cours sans brouillon sont ignorés.)' }]} />
      </div>
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
    <div className="cat-grid grid shrink-0 items-center gap-x-3 gap-y-1 px-3 py-1.5 lg:py-1 lg:min-h-[44px] border-t border-soft first:border-t-0 hover:bg-surface-2/60 text-sm" data-cat-row data-title={c.title}>
      <BulkCheck formId="bulk-catalogue" value={c.id} label={c.title} />
      <span className="num muted">{c.code ?? '—'}</span>
      <span className="min-w-0 font-medium lg:truncate" data-tip={c.title}>{c.priority === 'prioritaire' && <span className="text-warm font-semibold" aria-label="Prioritaire" data-tip="Notion prioritaire du programme">▲ </span>}{c.title}</span>
      <span className="min-w-0 muted text-[13px] lg:truncate">{showLevel ? `${c.level_name} · ` : ''}{c.subject} · {c.chapter}</span>
      <span className="cat-status flex items-center gap-2 min-w-0">
        {running
          ? <span className="pill !py-0.5 text-xs bg-brand-soft text-brand-dark inline-flex items-center gap-1 min-w-0 max-w-full" data-tip={`${kind} par l’IA : ${c.ai_job === 'en_attente' ? 'en attente' : c.ai_progress ?? 'en cours…'}`} data-ai-running>
              <Bot size={13} aria-hidden="true" className="shrink-0" /><span className="truncate">{kind} IA · {c.ai_job === 'en_attente' ? 'en attente' : c.ai_progress ?? 'en cours…'}</span></span>
          : <span className={`pill !py-0.5 text-xs shrink-0 ${status.cls}`}>{status.label}</span>}
        {!c.live && <span className="text-xs font-semibold muted shrink-0" data-tip="Niveau, matière ou chapitre désactivé dans Programmes : invisible pour les élèves">Désactivé</span>}
        {running ? null
          : c.ai_job === 'echec' ? <span className="text-xs text-warm-dark font-semibold truncate" data-tip={c.ai_error ?? undefined}>{kind} IA : échec</span>
          : c.review_verdict ? <Link href={`/contenu/cours/${c.id}`} className={`text-xs font-semibold no-underline truncate ${c.review_verdict === 'publiable' ? 'text-brand-dark' : 'text-warm-dark'}`}>
              {c.review_verdict === 'publiable' ? 'Relu : publiable' : `Relu : ${c.review_count} problème${(c.review_count ?? 0) > 1 ? 's' : ''}`}</Link> : null}
      </span>
      <span className="cat-actions flex items-center justify-end gap-1.5">
        {hasContent ? <Link href={`/contenu/cours/${c.id}`} className="btn btn-sm">Ouvrir</Link>
          : aiReady && !running ? <form action={draftWithAiAction.bind(null, c.id)}><button className="btn btn-sm btn-primary inline-flex items-center gap-1.5" type="submit"><Bot size={14} aria-hidden="true" />Rédiger avec l’IA</button></form>
          : running ? null
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
