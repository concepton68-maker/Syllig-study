'use client';
import { useFormStatus } from 'react-dom';
import { Bot } from 'lucide-react';

// Bouton d'envoi d'une demande à l'IA (peut prendre une minute : on le dit)
export function AiButton({ n, label, busy }: { n: number; label?: string; busy?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary inline-flex items-center gap-2" type="submit" disabled={pending}>
      <Bot size={17} aria-hidden="true" />{pending ? (busy ?? 'Correction en cours… (jusqu’à une minute)') : (label ?? `Corriger avec l’IA (${n})`)}
    </button>
  );
}
