'use client';
import { useActionState } from 'react';
import { loginAction } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Identifiant ou e-mail
        <input className="field" name="login" autoComplete="username" required autoFocus />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Mot de passe
        <input className="field" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <p role="alert" className="text-sm text-warm-dark bg-warm-soft rounded-lg px-3 py-2">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Connexion…' : 'Se connecter'}</button>
    </form>
  );
}
