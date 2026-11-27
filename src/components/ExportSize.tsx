'use client';
import { useEffect, useState } from 'react';
import { sizeInfo, tokensLabel, CONSIGNE_CHARS } from '@/lib/export-size';

const NOTE = { ok: 'tient dans une conversation Claude', limite: 'à la limite d’une conversation Claude', trop: 'trop gros pour une conversation Claude : en cocher moins' } as const;
const CLS = { ok: 'bg-brand-soft text-brand-dark', limite: 'bg-warm-soft text-warm-dark', trop: 'bg-warm text-white' } as const;

/** Poids de l'export : la sélection (cases du formulaire `formId`), sinon rien. `sizes` : caractères par cours (0 = sans contenu). */
export function ExportSize({ formId, sizes }: { formId: string; sizes: Record<string, number> }) {
  const [chars, setChars] = useState(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const count = () => {
      const ids = [...document.querySelectorAll<HTMLInputElement>(`input[data-bulk="${formId}"]:checked`)].map(x => x.value).filter(id => sizes[id] > 0);
      setN(ids.length); setChars(ids.reduce((s, id) => s + sizes[id], 0));
    };
    count();
    document.addEventListener('change', count);
    const mo = new MutationObserver(count); mo.observe(document.body, { childList: true, subtree: true });
    return () => { document.removeEventListener('change', count); mo.disconnect(); };
  }, [formId, sizes]);
  if (!n) return null;
  const s = sizeInfo(chars + CONSIGNE_CHARS);
  return <span className={`pill ${CLS[s.level]}`} data-export-size={s.level}>Export : {n} cours · {s.size} · {tokensLabel(s.tokens)} · {NOTE[s.level]}</span>;
}

export function ExportTotal({ chars, n }: { chars: number; n: number }) {
  const s = sizeInfo(chars + CONSIGNE_CHARS);
  return <span className={`pill ${CLS[s.level]}`} data-export-total={s.level}>Tout : {n} cours · {s.size} · {tokensLabel(s.tokens)}{s.level === 'trop' ? ' · trop gros pour une conversation' : ''}</span>;
}
