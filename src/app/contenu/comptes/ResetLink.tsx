'use client';
import { useActionState, useState } from 'react';
import { makeResetLink } from './reset-actions';

// Crée un lien à usage unique (48 h) pour qu'un adulte choisisse un nouveau mot de passe ; à transmettre par SMS, messagerie…
export function ResetLink({ login, label = 'Créer un lien', small }: { login?: string; label?: string; small?: boolean }) {
  const [state, action, pending] = useActionState(makeResetLink, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {login ? <input type="hidden" name="login" value={login} /> : (
        <label className="flex-[1_1_260px] flex flex-col gap-1 text-sm font-semibold">E-mail ou identifiant du compte
          <input className="field" name="login" required autoComplete="off" /></label>
      )}
      <button className={`btn ${small ? '!min-h-0 !py-1.5 !px-3 text-sm' : ''}`} type="submit" disabled={pending}>{pending ? 'Un instant…' : label}</button>
      {state?.error && <p role="alert" className="basis-full m-0 text-sm text-warm-dark">{state.error}</p>}
      {state?.link && (
        <div className="basis-full flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm">
          <code className="flex-1 min-w-0 break-all select-all">{state.link}</code>
          <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(state.link!).then(() => setCopied(true)).catch(() => null); }}>{copied ? 'Copié ✓' : 'Copier'}</button>
          <span className="basis-full muted">Valable 48 h, une seule fois. Envoyez-le à {state.name} (SMS, messagerie…).</span>
        </div>
      )}
    </form>
  );
}
