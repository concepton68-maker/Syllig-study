'use client';
import { useActionState } from 'react';
import { chooseNewPassword } from './actions';

export function NewPasswordForm({ token, login }: { token: string; login: string }) {
  const [state, action, pending] = useActionState(chooseNewPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={token} />
      <input type="hidden" name="username" autoComplete="username" value={login} readOnly />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Nouveau mot de passe (8 caractères min.)
        <input className="field" name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Le même, une deuxième fois
        <input className="field" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-warm-dark bg-warm-soft rounded-lg px-3 py-2 m-0">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer et me connecter'}</button>
    </form>
  );
}
