'use client';
import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

// Une ligne repliée (« Pour aller plus loin ») : titre + un fait, le contenu s'ouvre au clic.
export function Fold({ id, title, sub, open, children }: { id: string; title: string; sub?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details id={id} open={open} className="group border-t border-line scroll-mt-4" data-fold={id}>
      <summary className="flex items-center justify-between gap-3 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span><strong className="text-[15px]">{title}</strong>{sub && <span className="text-sm muted"> · {sub}</span>}</span>
        <ChevronRight size={18} aria-hidden="true" className="muted shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-4 pb-4 [&_.card]:shadow-none [&_.card]:border-0 [&_.card]:!p-0 [&_.card]:bg-transparent">{children}</div>
    </details>
  );
}

/** Ouvre la ligne repliée visée par l'ancre de l'adresse (#confidentialite…), au chargement et quand l'ancre change. */
export function OpenFromHash() {
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      const d = el?.closest('details') ?? (el instanceof HTMLDetailsElement ? el : null);
      if (d) { d.open = true; el!.scrollIntoView({ block: 'start' }); }
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, []);
  return null;
}
