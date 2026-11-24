'use client';
import { confirmSubmit } from '@/components/Dialog';
import { useEffect, useRef, useState } from 'react';

// Formulaire de correction : contrôle des points dans le navigateur (aucune saisie perdue),
// total en direct et confirmation avant que la note devienne visible par l'élève.
export function GradeForm({ action, maxima, autoTotal, graded, firstName, children }: {
  action: (form: FormData) => void | Promise<void>; maxima: Record<string, number>; autoTotal: number; graded: boolean; firstName: string; children: React.ReactNode;
}) {
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const read = (form: HTMLFormElement) => {
    let sum = autoTotal, bad: string | null = null;
    for (const [id, max] of Object.entries(maxima)) {
      const raw = (form.elements.namedItem(`p_${id}`) as HTMLInputElement | null)?.value ?? '';
      const v = Number(raw.replace(',', '.'));
      if (raw.trim() === '' || !Number.isFinite(v) || v < 0 || v > max) { bad ??= `${id.toUpperCase()} : entre 0 et ${String(max).replace('.', ',')} points`; continue; }
      sum += Math.round(v * 4) / 4;
    }
    return { sum: Math.round(sum * 100) / 100, bad };
  };
  const fmt = (n: number) => n.toLocaleString('fr-FR');
  // total affiché dès l'ouverture (points proposés ou corrigés automatiquement)
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (form.current) { const r = read(form.current); setTotal(r.bad ? null : r.sum); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form ref={form} action={action} className="flex flex-col gap-4"
      onInput={e => { const r = read(e.currentTarget); setTotal(r.bad ? null : r.sum); if (!r.bad) setError(null); }}
      onSubmit={e => {
        const r = read(e.currentTarget);
        if (r.bad) { e.preventDefault(); setError(r.bad); return; }
        const motif = (e.currentTarget.elements.namedItem('motif') as HTMLInputElement | null)?.value.trim();
        if (graded && !motif) { e.preventDefault(); setError('Indiquez le motif de la modification.'); return; }
        confirmSubmit(e, graded
          ? { title: `Enregistrer la nouvelle note : ${fmt(r.sum)}/20 ?`, message: `${firstName} verra la note modifiée aussitôt.`, confirmLabel: 'Enregistrer' }
          : { title: `Valider la note de ${fmt(r.sum)}/20 ?`, message: `${firstName} verra la note et vos commentaires aussitôt.`, confirmLabel: `Valider ${fmt(r.sum)}/20`, tone: 'success' });
      }}>
      {children}
      <div className="sticky bottom-0 z-10 card !py-3 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur">
        <span className="text-sm">Total : <strong className="num text-lg">{total === null ? '—' : `${fmt(total)} / 20`}</strong>
          {error && <span role="alert" className="ml-3 text-warm-dark font-semibold">{error}</span>}</span>
        <button className="btn btn-primary" type="submit">{graded ? 'Enregistrer la modification' : 'Valider la note'}</button>
      </div>
    </form>
  );
}
