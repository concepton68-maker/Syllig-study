'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { sizeInfo, tokensLabel, CONSIGNE_CHARS } from '@/lib/export-size';
import { importLotAction } from './importer/actions';
import { publishBulkAction } from './cours/[id]/actions';

// Circuit de relecture par Claude (maquette validée le 27/11/2026) : ① cocher → ② faire relire par Claude (un fichier, la consigne
// dedans) → ③ importer sa réponse → ④ vérifier ce qui a changé et publier.

export const CLAUDE_MESSAGE = 'Suis la consigne du fichier joint et renvoie le fichier JSON.';
const NOTE = { ok: 'tient dans une conversation Claude', limite: 'à la limite d’une conversation Claude', trop: 'trop gros pour une conversation : en cocher moins' } as const;

/** Cours cochés dans le catalogue (cases du formulaire `formId`). */
export function useSelection(formId: string) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const read = () => setIds([...document.querySelectorAll<HTMLInputElement>(`input[data-bulk="${formId}"]:checked`)].map(x => x.value));
    read();
    document.addEventListener('change', read);
    const mo = new MutationObserver(read); mo.observe(document.body, { childList: true, subtree: true });
    return () => { document.removeEventListener('change', read); mo.disconnect(); };
  }, [formId]);
  return ids;
}

export function weightOf(ids: string[], sizes: Record<string, number>) {
  const withContent = ids.filter(id => (sizes[id] ?? 0) > 0);
  const s = sizeInfo(withContent.reduce((n, id) => n + sizes[id], 0) + CONSIGNE_CHARS);
  return { n: withContent.length, ...s, text: `${s.size} · ${tokensLabel(s.tokens)}`, note: NOTE[s.level] };
}

type Mode = null | 'export' | 'import';

/** Le circuit en 4 étapes, en haut du catalogue, et le panneau guidé. */
export function Pipeline({ formId, sizes, toReview }: { formId: string; sizes: Record<string, number>; toReview: number }) {
  const ids = useSelection(formId);
  const w = weightOf(ids, sizes);
  const [mode, setMode] = useState<Mode>(null);
  const [sent, setSent] = useState<string[]>([]);
  const open = (m: Mode) => { if (m === 'export') setSent(ids.filter(id => (sizes[id] ?? 0) > 0)); setMode(m); };
  const step = 'flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] text-left text-[13px] leading-tight';
  const num = (on: boolean) => `size-[22px] shrink-0 rounded-full grid place-items-center text-xs font-bold ${on ? 'bg-brand text-white' : 'bg-soft text-ink-2'}`;
  return (
    <>
      <ol aria-label="Faire relire des cours par Claude" className="list-none m-0 p-1.5 grid gap-1.5 grid-cols-2 lg:grid-cols-4 bg-white border border-line rounded-2xl shrink-0" data-pipeline>
        <li className={`${step} ${w.n ? 'bg-brand-soft text-brand-dark' : ''}`}><span className={num(w.n > 0)}>1</span>
          <span><strong>Cocher les cours</strong><span className="block" data-pipeline-weight>{w.n ? `${w.n} cours · ${w.size} · ${w.note}` : 'dans la liste ci-dessous'}</span></span></li>
        <li><button type="button" className={`${step} w-full hover:bg-surface-2 disabled:opacity-60`} disabled={!w.n} onClick={() => open('export')} data-step-export>
          <span className={num(false)}>2</span><span><strong>Faire relire par Claude</strong><span className="block muted">un fichier, la consigne dedans</span></span></button></li>
        <li><button type="button" className={`${step} w-full hover:bg-surface-2`} onClick={() => open('import')} data-step-import>
          <span className={num(false)}>3</span><span><strong>Importer sa réponse</strong><span className="block muted">seuls les cours corrigés changent</span></span></button></li>
        <li><Link href="/contenu/a-relire" className={`${step} no-underline text-ink hover:bg-surface-2`} data-step-review>
          <span className={num(false)}>4</span><span><strong>Vérifier et publier</strong><span className="block muted">{toReview ? `${toReview} cours à relire` : 'rien à relire'}</span></span></Link></li>
      </ol>
      <LaunchButton n={w.n} weight={w} onClick={() => open('export')} portal={formId} />
      {mode && <Drawer mode={mode} ids={sent} weight={weightOf(sent, sizes)} onClose={() => setMode(null)} onImport={() => setMode('import')} />}
    </>
  );
}

// bouton « Faire relire par Claude » et poids de la sélection, placés dans la barre d'actions groupées
function LaunchButton({ n, weight, onClick, portal }: { n: number; weight: ReturnType<typeof weightOf>; onClick: () => void; portal: string }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.querySelector<HTMLElement>(`[data-launch-slot="${portal}"]`)); }, [portal]);
  if (!slot) return null;
  return <LaunchInSlot slot={slot} n={n} weight={weight} onClick={onClick} />;
}
function LaunchInSlot({ slot, n, weight, onClick }: { slot: HTMLElement; n: number; weight: ReturnType<typeof weightOf>; onClick: () => void }) {
  const cls = { ok: 'bg-brand-soft text-brand-dark', limite: 'bg-warm-soft text-warm-dark', trop: 'bg-warm text-white' }[weight.level];
  return createPortal(<>
    {n > 0 && <span className={`pill ${cls}`} data-export-size={weight.level}>{weight.text} · {weight.note}</span>}
    <button type="button" className="btn btn-primary" disabled={!n} onClick={onClick} data-launch>Faire relire par Claude ›</button>
  </>, slot);
}

function Drawer({ mode, ids, weight, onClose, onImport }: { mode: Exclude<Mode, null>; ids: string[]; weight: ReturnType<typeof weightOf>; onClose: () => void; onImport: () => void }) {
  const [state, action, pending] = useActionState(importLotAction, undefined);
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState<number | null>(null);
  const dl = useRef<HTMLAnchorElement>(null);
  const href = `/api/contenu/lot?${ids.map(id => `ids=${id}`).join('&')}`;
  // le fichier se télécharge dès l'ouverture (étape 1 faite)
  useEffect(() => { if (mode === 'export' && ids.length) dl.current?.click(); }, [mode, ids.length]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  const done = !!state?.imported;
  const card = 'rounded-2xl border p-4 flex flex-col gap-2.5';
  const badge = (s: 'ok' | 'on' | 'off', n: string) => <span className={`size-[26px] shrink-0 rounded-full grid place-items-center text-[13px] font-bold ${s === 'ok' ? 'bg-brand text-white' : s === 'on' ? 'bg-brand text-white' : 'bg-soft text-ink-2'}`}>{s === 'ok' ? '✓' : n}</span>;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={done ? 'Réponse de Claude importée' : 'Faire relire par Claude'} className="w-full max-w-[620px] h-full bg-white shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto" data-relecture>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-bold m-0">{done ? 'Réponse de Claude importée' : 'Faire relire par Claude'}</h2>
          <button type="button" className="btn btn-icon" aria-label="Fermer" onClick={onClose}>×</button>
        </div>
        {!done && <>
          {mode === 'export' && <>
            <span className="text-sm muted">{ids.length} cours</span>
            <section className={`${card} border-line`}>
              <div className="flex items-center gap-2.5">{badge('ok', '1')}<strong>Le fichier est téléchargé</strong></div>
              <span className="text-sm text-ink-2 pl-9">{weight.text} · {weight.note}. La consigne pour Claude est dedans.</span>
              <a ref={dl} href={href} download className="text-sm font-semibold pl-9" data-download>Le télécharger à nouveau</a>
            </section>
            <section className={`${card} border-brand border-2`}>
              <div className="flex items-center gap-2.5">{badge('on', '2')}<strong>Dans Claude (ou une autre IA)</strong></div>
              <ol className="m-0 pl-14 text-sm text-ink-2 flex flex-col gap-1"><li>Ouvre une nouvelle conversation.</li><li>Joins le fichier téléchargé.</li><li>Colle ce message et envoie :</li></ol>
              <div className="ml-9 flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2.5 text-sm">
                <span className="flex-1" data-claude-message>« {CLAUDE_MESSAGE} »</span>
                <button type="button" className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(CLAUDE_MESSAGE).then(() => setCopied(true), () => {}); }}>{copied ? 'Copié' : 'Copier'}</button>
              </div>
              <a className="btn ml-9 self-start" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Ouvrir claude.ai ↗</a>
              <span className="text-xs muted ml-9">Si Claude répond en plusieurs fois, importe chaque réponse l’une après l’autre.</span>
            </section>
          </>}
          <section className={`${card} ${mode === 'import' ? 'border-brand border-2' : 'border-line'}`}>
            <div className="flex items-center gap-2.5">{badge(mode === 'import' ? 'on' : 'off', mode === 'export' ? '3' : '1')}<strong>Importer sa réponse</strong></div>
            <form action={action} className="ml-9 flex flex-col gap-2.5" data-lot-form>
              <label className="border-2 border-dashed border-line-strong rounded-xl p-4 flex flex-col items-center gap-1 text-sm text-center cursor-pointer">
                <strong>Déposer le fichier renvoyé par Claude</strong>
                <input type="file" name="file" accept=".json,application/json,text/plain" className="text-xs" />
              </label>
              <textarea name="json" className="field font-mono text-xs min-h-[90px]" placeholder="ou coller sa réponse ici" aria-label="Réponse de Claude" spellCheck={false} onFocus={onImport} />
              <span className="text-xs muted">Seuls les cours que Claude a corrigés changent, en brouillon. Si un cours est mal formé, rien n’est importé.</span>
              <button className="btn btn-primary self-start" type="submit" disabled={pending}>{pending ? 'Vérification…' : 'Importer'}</button>
            </form>
            {state?.errors && <div role="alert" className="ml-9 rounded-xl bg-warm-soft text-warm-dark px-4 py-3 text-sm"><strong>Rien n’a été importé :</strong>
              <ul className="mt-1 mb-0 pl-5 list-disc">{state.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          </section>
        </>}
        {done && <Result imported={state!.imported!} unchanged={state!.unchanged ?? []} published={published} onPublish={setPublished} />}
      </aside>
    </div>
  );
}

function Result({ imported, unchanged, published, onPublish }: { imported: NonNullable<NonNullable<Parameters<typeof importLotAction>[0]>['imported']>; unchanged: string[]; published: number | null; onPublish: (n: number) => void }) {
  const [checked, setChecked] = useState<string[]>(imported.map(x => x.versionId));
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col gap-4" data-lot-result>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-warm-soft px-4 py-3"><strong className="text-[26px] leading-none" data-lot-changed>{imported.length}</strong><span className="block text-sm">cours corrigé{imported.length > 1 ? 's' : ''}, en brouillon</span></div>
        <div className="rounded-xl bg-surface-2 px-4 py-3"><strong className="text-[26px] leading-none" data-lot-unchanged>{unchanged.length}</strong><span className="block text-sm">sans changement, gardé{unchanged.length > 1 ? 's' : ''} tel{unchanged.length > 1 ? 's' : ''} quel{unchanged.length > 1 ? 's' : ''}</span></div>
      </div>
      {imported.length === 0 && <p className="m-0 text-sm">Claude n’a rien trouvé à corriger : rien n’a changé.</p>}
      {imported.length > 0 && <>
        <ul className="list-none m-0 p-0 border border-line rounded-2xl overflow-hidden">
          {imported.map(x => (
            <li key={x.versionId} className="grid grid-cols-[28px_60px_minmax(0,1fr)_auto] gap-2 items-center px-3 py-2.5 border-t border-soft first:border-t-0 text-sm" data-lot-row={x.code}>
              <input type="checkbox" aria-label={`Publier ${x.code}`} checked={checked.includes(x.versionId)} disabled={published !== null}
                onChange={e => setChecked(c => e.target.checked ? [...c, x.versionId] : c.filter(v => v !== x.versionId))} />
              <span className="muted">{x.code}</span>
              <span className="min-w-0"><strong className="block truncate">{x.title}</strong><span className="block text-warm-dark text-[13px]" data-lot-changes>Changé : {x.changes}</span></span>
              <Link className="font-semibold" href={`/contenu/cours/${x.courseId}/comparer?v=${x.versionId}`} target="_blank">Comparer</Link>
            </li>
          ))}
        </ul>
        <span className="text-xs muted">« Comparer » montre l’ancien et le nouveau texte côte à côte. Les élèves voient l’ancienne version tant que ce n’est pas publié.</span>
        {published !== null
          ? <p role="status" className="m-0 rounded-xl bg-brand-soft text-brand-dark px-4 py-3 text-sm" data-lot-published><strong>{published} cours publié{published > 1 ? 's' : ''}.</strong> Les élèves voient la nouvelle version. Les autres restent dans « À relire ».</p>
          : <div className="flex flex-wrap gap-2.5 justify-end">
            <Link className="btn" href="/contenu/a-relire">Plus tard (dans « À relire »)</Link>
            <button type="button" className="btn btn-primary" disabled={!checked.length || pending} data-lot-publish
              onClick={async () => { setPending(true); const fd = new FormData(); checked.forEach(id => fd.append('ids', id)); await publishBulkAction(fd); onPublish(checked.length); setPending(false); }}>
              Publier les {checked.length} cochés</button>
          </div>}
      </>}
    </div>
  );
}
