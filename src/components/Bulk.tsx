'use client';
import { useEffect, useState } from 'react';

// Actions groupées : chaque ligne d'une liste porte une case <BulkCheck>, reliée par formId au formulaire de la barre <BulkBar>.
// Les cases peuvent être n'importe où dans la page (pas de formulaires imbriqués) ; la barre compte la sélection
// et désactive ses boutons tant que rien n'est coché.

export type BulkAction = {
  label: string;
  action: ((form: FormData) => void | Promise<void>) | string; // action serveur, ou URL (envoi en GET, ex. téléchargement)
  confirm?: string;   // « {n} » est remplacé par le nombre d'éléments sélectionnés
  tone?: 'primary' | 'danger';
};

const boxes = (formId: string) => Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-bulk="${formId}"]`));

export function BulkCheck({ formId, value, label, name = 'ids' }: { formId: string; value: string | number; label: string; name?: string }) {
  return <input type="checkbox" name={name} value={value} form={formId} data-bulk={formId} aria-label={`Sélectionner ${label}`} className="w-5 h-5 shrink-0 accent-[var(--color-brand)] cursor-pointer" />;
}

export function BulkBar({ formId, actions, hidden, children, noun = 'élément', feminine }: {
  formId: string; actions: BulkAction[]; hidden?: Record<string, string>; children?: React.ReactNode; noun?: string; feminine?: boolean;
}) {
  const [n, setN] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const count = () => { const b = boxes(formId); setTotal(b.length); setN(b.filter(x => x.checked).length); };
    count();
    const onChange = (e: Event) => { if ((e.target as HTMLElement).dataset?.bulk === formId) count(); };
    document.addEventListener('change', onChange);
    const mo = new MutationObserver(count); // lignes filtrées ou rechargées
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { document.removeEventListener('change', onChange); mo.disconnect(); };
  }, [formId]);
  const all = total > 0 && n === total;
  const toggleAll = () => { const b = boxes(formId); b.forEach(x => { x.checked = !all; }); setN(all ? 0 : b.length); };
  const plural = (k: number) => `${k} ${noun}${k > 1 && !noun.endsWith('s') ? 's' : ''}`;

  return (
    <form id={formId} className={`flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${n ? 'bg-brand-soft' : 'bg-surface-2'}`}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="flex items-center gap-2 font-semibold cursor-pointer">
        <input type="checkbox" checked={all} onChange={toggleAll} disabled={!total} className="w-5 h-5 accent-[var(--color-brand)]" />
        Tout sélectionner
      </label>
      <span className="muted">{n ? `${plural(n)} sélectionné${feminine ? 'e' : ''}${n > 1 ? 's' : ''}` : 'Cochez des lignes pour agir sur plusieurs à la fois'}</span>
      {children}
      <span className="flex flex-wrap gap-2 ml-auto">
        {actions.map(a => (
          <button key={a.label} type="submit" disabled={!n}
            {...(typeof a.action === 'string' ? { formAction: a.action, formMethod: 'get' } : { formAction: a.action })}
            onClick={e => { if (a.confirm && !window.confirm(a.confirm.replace('{n}', plural(n)))) e.preventDefault(); }}
            className={`btn ${a.tone === 'primary' ? 'btn-primary' : a.tone === 'danger' ? 'btn-danger' : ''} disabled:opacity-50`}>
            {a.label}{n ? ` (${n})` : ''}
          </button>
        ))}
      </span>
    </form>
  );
}
