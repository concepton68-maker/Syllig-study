'use client';
import { useActionState } from 'react';
import { addChild, resetChildPassword } from './actions';
import { THEMES } from '@/lib/settings';

function Msg({ s }: { s: { error?: string; ok?: string } | undefined }) {
  if (s?.error) return <p role="alert" className="m-0 rounded-lg bg-warm-soft text-warm-dark px-3 py-2 text-sm">{s.error}</p>;
  if (s?.ok) return <p role="status" className="m-0 rounded-lg bg-brand-soft text-brand-ink px-3 py-2 text-sm">{s.ok}</p>;
  return null;
}

export function AddChildForm({ levels }: { levels: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addChild, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Prénom<input className="field" name="first_name" required /></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Niveau
          <select className="field" name="level">{levels.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Thème d’affichage
          <select className="field" name="theme" defaultValue="classique">{THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Identifiant de connexion<input className="field" name="login" required autoComplete="off" placeholder="ex. tom" /></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Mot de passe (8 caractères min.)<input className="field" name="password" type="password" required autoComplete="new-password" /></label>
      </div>
      <Msg s={state} />
      <div><button className="btn btn-primary" type="submit" disabled={pending}>Créer le compte</button></div>
    </form>
  );
}

export function ResetForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(resetChildPassword, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="student" value={studentId} />
      <label className="flex flex-col gap-1 text-sm font-semibold">Nouveau mot de passe<input className="field" name="password" type="password" required autoComplete="new-password" /></label>
      <button className="btn" type="submit" disabled={pending}>Modifier</button>
      <div className="basis-full"><Msg s={state} /></div>
    </form>
  );
}
