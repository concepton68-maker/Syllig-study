'use client';
import { useFormStatus } from 'react-dom';
import { confirmSubmit, splitQuestion } from './Dialog';

// Bouton d'envoi avec confirmation (fenêtre de l'application, jamais celle du navigateur) et état « en cours »
export function ConfirmButton({ message, confirmLabel, danger, className, children }: { message?: string; confirmLabel?: string; danger?: boolean; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}
      onClick={message ? e => confirmSubmit(e, { ...splitQuestion(message), confirmLabel: confirmLabel ?? 'Oui, confirmer', tone: danger ? 'danger' : 'primary' }) : undefined}>
      {pending ? 'Un instant…' : children}
    </button>
  );
}
