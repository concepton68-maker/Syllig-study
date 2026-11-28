'use client';
import { useRef, useState } from 'react';

// Liste à cocher pour ajouter plusieurs éléments d'un coup (matières, niveaux) : titre, liste alignée (groupée si besoin),
// pied compact « Tout cocher · n sélectionnés · Annuler · Ajouter (n) ». Les cases portent name="ids" (action groupée).
export type PickItem = { value: string; label: string; group?: string };

export function PickList({ id, title, items, action, hidden, nounPlural, onClose }: {
  id: string; title: string; items: PickItem[]; action: (f: FormData) => void | Promise<void>; hidden?: Record<string, string>;
  nounPlural: string; onClose?: () => void;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const groups = [...new Set(items.map(i => i.group ?? ''))];
  const all = sel.length === items.length;
  const toggle = (v: string) => setSel(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);
  return (
    <form ref={form} id={id} action={action} className="flex flex-col w-full" data-picklist={id}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="px-4 pt-3 pb-2 border-b border-line flex items-baseline justify-between gap-3">
        <strong className="text-[15px]">{title}</strong>
        <button type="button" className="text-[13px] font-semibold text-brand-dark" onClick={() => setSel(all ? [] : items.map(i => i.value))} data-pick-all>
          {all ? 'Tout décocher' : 'Tout cocher'}</button>
      </div>
      <div className="max-h-[46vh] overflow-y-auto py-1.5">
        {groups.map(g => (
          <div key={g} role="group" aria-label={g || title}>
            {g && <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide muted">{g}</div>}
            {items.filter(i => (i.group ?? '') === g).map(i => (
              <label key={i.value} className={`flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-surface-2 ${sel.includes(i.value) ? 'bg-brand-soft/60' : ''}`}>
                <input type="checkbox" name="ids" value={i.value} checked={sel.includes(i.value)} onChange={() => toggle(i.value)}
                  className="size-4 shrink-0 accent-[var(--color-brand)]" data-pick={i.value} />
                <span className="leading-snug">{i.label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-line flex items-center gap-2 bg-surface-2 rounded-b-xl">
        <span className="text-[13px] muted flex-1" aria-live="polite">{sel.length ? `${sel.length} à ajouter` : `Coche les ${nounPlural} à ajouter`}</span>
        {onClose && <button type="button" className="btn btn-sm" onClick={onClose}>Annuler</button>}
        <button type="submit" className="btn btn-sm btn-primary" disabled={!sel.length} data-pick-submit>Ajouter{sel.length ? ` (${sel.length})` : ''}</button>
      </div>
    </form>
  );
}

/** Bouton qui ouvre la liste dans un panneau flottant, fermé par Échap, un clic dehors ou « Annuler ». */
export function PickPopover({ label, align = 'right', width = 360, ...p }: { label: string; align?: 'left' | 'right'; width?: number } & Omit<Parameters<typeof PickList>[0], 'onClose'>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
      <button type="button" className="btn btn-sm btn-primary" aria-expanded={open} onClick={() => setOpen(o => !o)} data-pick-open={p.id}>{label}</button>
      {open && <>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-20 mt-2 bg-white border border-line rounded-xl shadow-xl`} style={{ width }}>
          <PickList {...p} onClose={() => setOpen(false)} />
        </div>
      </>}
    </div>
  );
}
