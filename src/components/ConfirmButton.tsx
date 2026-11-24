'use client';
import { useFormStatus } from 'react-dom';

// Bouton d'envoi avec confirmation et état « en cours »
export function ConfirmButton({ message, className, children }: { message?: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}
      onClick={e => { if (message && !window.confirm(message)) e.preventDefault(); }}>
      {pending ? 'Un instant…' : children}
    </button>
  );
}
