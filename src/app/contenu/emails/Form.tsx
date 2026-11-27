'use client';
import { useActionState } from 'react';
import { saveMail, testMail } from './actions';

const Msg = ({ s }: { s?: { ok?: string; error?: string } }) => <>
  {s?.error && <p role="alert" className="text-sm text-warm-dark bg-warm-soft rounded-lg px-3 py-2 m-0">{s.error}</p>}
  {s?.ok && <p role="status" className="text-sm bg-brand-soft text-brand-ink rounded-lg px-3 py-2 m-0">{s.ok}</p>}</>;

export function MailForm({ v }: { v: { host: string; port: number; user: string; hint: string; from: string } | null }) {
  const [state, action, pending] = useActionState(saveMail, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Serveur (SMTP)<input className="field" name="host" defaultValue={v?.host ?? ''} placeholder="smtp-relay.brevo.com" required /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Port<input className="field" name="port" inputMode="numeric" defaultValue={String(v?.port ?? 587)} required /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Identifiant<input className="field" name="user" defaultValue={v?.user ?? ''} autoComplete="off" /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Mot de passe ou clé {v?.hint && <span className="muted font-normal">(enregistré : {v.hint} ; laisser vide pour le garder)</span>}<input className="field" name="pass" type="password" autoComplete="new-password" /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">Adresse d’expédition<input className="field" name="from" defaultValue={v?.from ?? ''} placeholder="Syllig Study <bonjour@syllig.com>" required /></label>
      <div className="sm:col-span-2 flex flex-col gap-2"><Msg s={state} /><button className="btn btn-primary self-start" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button></div>
    </form>
  );
}
export function TestForm() {
  const [state, action, pending] = useActionState(testMail, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold flex-1 min-w-[220px]">Envoyer un e-mail d’essai à<input className="field" name="to" type="email" required /></label>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Envoi…' : 'Envoyer'}</button>
      <div className="basis-full"><Msg s={state} /></div>
    </form>
  );
}
