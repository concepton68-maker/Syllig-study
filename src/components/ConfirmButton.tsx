'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

// Bouton d'envoi avec confirmation et état « en cours ».
// La confirmation s'affiche dans la page (pas de fenêtre du navigateur : Firefox peut les bloquer sans rien dire,
// et le bouton semblait alors ne rien faire).
export function ConfirmButton({ message, className, children }: { message?: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);
  if (pending) return <button type="button" className={className} disabled>Un instant…</button>;
  if (message && armed) return (
    <span role="alertdialog" aria-label="Confirmation" className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-soft px-3 py-2">
      <span className="text-sm font-medium">{message}</span>
      <button type="submit" className={className} autoFocus>Oui, confirmer</button>
      <button type="button" className="btn" onClick={() => setArmed(false)}>Annuler</button>
    </span>
  );
  return (
    <button type={message ? 'button' : 'submit'} className={className} onClick={message ? () => setArmed(true) : undefined}>
      {children}
    </button>
  );
}
