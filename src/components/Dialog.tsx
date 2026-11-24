'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

// Fenêtre de confirmation aux couleurs de l'application (remplace window.confirm, que Firefox peut bloquer
// et qui affiche « study.syllig.com indique… »). Un seul hôte <DialogHost /> dans la mise en page racine.
export type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
};
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((p: Pending) => void) | null = null;

export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (show) show({ ...opts, resolve });
    else resolve(window.confirm([opts.title, typeof opts.message === 'string' ? opts.message : ''].filter(Boolean).join('\n\n')));   // secours
  });
}

// Pour un bouton d'envoi : demande confirmation, puis renvoie le formulaire avec ce même bouton (son action et ses valeurs)
export function confirmSubmit(e: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement>, opts: ConfirmOptions) {
  const btn = ('nativeEvent' in e && 'submitter' in e.nativeEvent ? (e.nativeEvent as SubmitEvent).submitter : e.currentTarget) as HTMLButtonElement | null;
  const form = (e.currentTarget instanceof HTMLFormElement ? e.currentTarget : (e.currentTarget as HTMLButtonElement).form);
  const onSubmitEvent = e.type === 'submit';   // appelé depuis onSubmit du formulaire (sinon depuis onClick du bouton)
  const flag = btn ?? form;
  if (onSubmitEvent && flag?.dataset.confirmed === '1') { delete flag.dataset.confirmed; return; }   // deuxième passage : confirmé
  e.preventDefault();
  askConfirm(opts).then(ok => {
    if (!ok || !form) return;
    if (onSubmitEvent && flag) flag.dataset.confirmed = '1';
    form.requestSubmit(btn && btn.form === form ? btn : undefined);
  });
}

// « Question ? Précision. » → titre + message
export function splitQuestion(text: string): Pick<ConfirmOptions, 'title' | 'message'> {
  const i = text.indexOf('?');
  return i > 0 && i < text.length - 1 ? { title: text.slice(0, i + 1).trim(), message: text.slice(i + 1).trim() } : { title: text };
}

export function DialogHost() {
  const [p, setP] = useState<Pending | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => { show = d => { back.current = document.activeElement as HTMLElement; setP(d); }; return () => { show = null; }; }, []);
  const close = (ok: boolean) => { p?.resolve(ok); setP(null); back.current?.focus?.(); };
  useEffect(() => {
    if (!p) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Tab') {   // la tabulation reste dans la fenêtre
        const f = [...document.querySelectorAll<HTMLElement>('[data-dialog] button')];
        const i = f.indexOf(document.activeElement as HTMLElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!p) return null;
  const tone = p.tone ?? 'primary';
  const Icon = tone === 'danger' ? AlertTriangle : tone === 'success' ? CheckCircle2 : HelpCircle;
  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(false); }}>
      <div data-dialog role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={p.message ? 'dialog-msg' : undefined} className="dialog-card">
        <span className={`dialog-icon ${tone === 'danger' ? 'tone-warm' : tone === 'success' ? 'tone-green' : 'tone-brand'}`} aria-hidden="true"><Icon size={22} /></span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h2 id="dialog-title" className="text-lg font-bold m-0 leading-snug">{p.title}</h2>
          {p.message && <div id="dialog-msg" className="muted text-[15px] leading-relaxed">{p.message}</div>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" data-dialog-cancel onClick={() => close(false)}>{p.cancelLabel ?? 'Annuler'}</button>
          <button type="button" ref={okRef} data-dialog-ok onClick={() => close(true)}
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}>{p.confirmLabel ?? 'Oui, confirmer'}</button>
        </div>
      </div>
    </div>
  );
}

// Bulles des champs de formulaire : remplace les bulles du navigateur (« Veuillez renseigner ce champ »)
// par un message sous le champ, en français et aux couleurs de l'application.
export function FieldHints() {
  useEffect(() => {
    const text = (el: HTMLInputElement) => {
      const v = el.validity;
      if (v.valueMissing) return el.type === 'checkbox' ? 'À cocher pour continuer.' : el.type === 'file' ? 'Choisissez un fichier.' : 'Ce champ est à remplir.';
      if (v.typeMismatch) return el.type === 'email' ? 'Adresse e-mail incomplète (exemple : prenom@exemple.fr).' : 'Format incorrect.';
      if (v.tooShort) return `Au moins ${el.minLength} caractères (${el.value.length} pour l’instant).`;
      if (v.tooLong) return `Au plus ${el.maxLength} caractères.`;
      if (v.rangeUnderflow) return `Au minimum ${el.min}.`;
      if (v.rangeOverflow) return `Au maximum ${el.max}.`;
      if (v.stepMismatch) return 'Valeur non acceptée (pas de nombre aussi précis).';
      if (v.badInput) return 'Ce n’est pas un nombre.';
      return el.validationMessage;
    };
    const clear = (el: Element) => { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); el.parentElement?.querySelector(':scope > .field-hint')?.remove(); };
    let first = true;
    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!el.matches?.('input, textarea, select')) return;
      e.preventDefault();
      clear(el);
      const id = `hint-${Math.random().toString(36).slice(2, 8)}`;
      const hint = document.createElement('span');
      hint.className = 'field-hint'; hint.id = id; hint.setAttribute('role', 'alert'); hint.textContent = text(el);
      el.insertAdjacentElement('afterend', hint);
      el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', id);
      if (first) { el.focus(); first = false; setTimeout(() => { first = true; }, 0); }
    };
    const onInput = (e: Event) => { const el = e.target as HTMLElement; if (el.getAttribute?.('aria-invalid') === 'true') clear(el); };
    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    return () => { document.removeEventListener('invalid', onInvalid, true); document.removeEventListener('input', onInput, true); document.removeEventListener('change', onInput, true); };
  }, []);
  return null;
}
