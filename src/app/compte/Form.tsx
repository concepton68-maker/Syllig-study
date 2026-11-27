'use client';
import { useActionState } from 'react';
import { changeOwnPassword, saveWeekly } from './actions';

export function ChangePasswordForm({ login }: { login: string }) {
  const [state, action, pending] = useActionState(changeOwnPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="username" autoComplete="username" value={login} readOnly />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Mot de passe actuel
        <input className="field" name="current" type="password" autoComplete="current-password" required /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Nouveau mot de passe (8 caractères min.)
        <input className="field" name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Le même, une deuxième fois
        <input className="field" name="confirm" type="password" autoComplete="new-password" required minLength={8} /></label>
      {state?.error && <p role="alert" className="text-sm text-warm-dark bg-warm-soft rounded-lg px-3 py-2 m-0">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm bg-brand-soft text-brand-ink rounded-lg px-3 py-2 m-0">{state.ok}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Changer mon mot de passe'}</button>
    </form>
  );
}

export function WeeklyForm({ email, on }: { email: string; on: boolean }) {
  const [state, action, pending] = useActionState(saveWeekly, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" data-weekly-form>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Mon adresse e-mail
        <input className="field" name="email" type="email" defaultValue={email} autoComplete="email" /></label>
      <label className="flex items-start gap-2.5 text-[15px]">
        <input type="checkbox" name="weekly" defaultChecked={on} className="w-5 h-5 mt-0.5 accent-[var(--color-brand)]" />
        <span><strong>Recevoir le message chaque lundi à 7 h</strong><span className="block muted text-sm">Un message par enfant suivi, avec son prénom et ses résultats de la semaine.</span></span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-warm-dark bg-warm-soft rounded-lg px-3 py-2 m-0">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm bg-brand-soft text-brand-ink rounded-lg px-3 py-2 m-0">{state.ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>Enregistrer</button>
        <button className="btn" type="submit" name="test" value="1" disabled={pending}>M’envoyer un message d’essai</button>
      </div>
    </form>
  );
}
