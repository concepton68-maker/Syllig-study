'use client';
import { useFormStatus } from 'react-dom';
import { Bot } from 'lucide-react';

// Bouton d'envoi d'une correction par IA (peut prendre une minute : on le dit)
export function AiButton({ n }: { n: number }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary inline-flex items-center gap-2" type="submit" disabled={pending}>
      <Bot size={17} aria-hidden="true" />{pending ? 'Correction en cours… (jusqu’à une minute)' : `Corriger avec l’IA (${n})`}
    </button>
  );
}
