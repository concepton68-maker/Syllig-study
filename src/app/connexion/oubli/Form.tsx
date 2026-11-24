'use client';
import { useActionState } from 'react';
import { requestReset } from './actions';

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  if (state?.done) return (
    <div role="status" className="flex flex-col gap-3 text-[15px]">
      <strong className="text-lg">Demande envoyée ✓</strong>
      <p className="m-0"><strong>Compte élève</strong> : ton parent voit ta demande dans son espace, rubrique « À faire ». Il te donne un nouveau mot de passe.</p>
      <p className="m-0"><strong>Compte parent</strong> : l’administrateur de la plateforme voit la demande et t’envoie un lien pour choisir un nouveau mot de passe.</p>
    </div>
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Identifiant ou e-mail
        <input className="field" name="login" autoComplete="username" required autoFocus />
      </label>
      {state?.error && <p role="alert" className="text-sm text-warm-dark bg-warm-soft rounded-lg px-3 py-2 m-0">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Envoi…' : 'Demander un nouveau mot de passe'}</button>
    </form>
  );
}
