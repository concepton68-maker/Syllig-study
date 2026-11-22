'use client';
import { useActionState, useState } from 'react';
import { resetCourseAction, resetStudentAction } from './actions';

export function ResetCourse({ studentId, courseId, title }: { studentId: string; courseId: number; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resetCourseAction, undefined);
  if (state?.ok) return <span role="status" className="text-sm text-brand-ink">{state.ok}</span>;
  if (!open) return <button className="btn" type="button" onClick={() => setOpen(true)}>Réinitialiser…</button>;
  return (
    <form action={action} className="basis-full rounded-xl border border-warm-mid bg-warm-soft p-4 flex flex-col gap-3">
      <input type="hidden" name="student" value={studentId} /><input type="hidden" name="course" value={courseId} />
      <strong className="text-sm text-warm-dark">Remettre « {title} » à zéro ?</strong>
      <span className="text-sm text-ink-2">Effacés : leçon validée, réponses aux exercices, toutes les tentatives d’évaluation et leurs notes, points de progrès gagnés sur ce cours. Le cours redevient « Pas encore commencé ». Le journal garde une trace de la réinitialisation.</span>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sessions" defaultChecked className="w-4 h-4" /> Effacer aussi le temps de travail passé sur ce cours</label>
      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Réinitialisation…' : 'Oui, réinitialiser ce cours'}</button>
        <button className="btn" type="button" onClick={() => setOpen(false)}>Annuler</button>
      </div>
      {state?.error && <span role="alert" className="text-sm text-warm-dark">{state.error}</span>}
    </form>
  );
}

export function ResetStudent({ studentId, firstName }: { studentId: string; firstName: string }) {
  const [state, action, pending] = useActionState(resetStudentAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="student" value={studentId} />
      <span className="text-sm text-ink-2">Efface toute la progression de {firstName} : leçons, exercices, évaluations, notes, points, révisions et temps de travail. Ne touche pas aux comptes, aux règles ni au thème.</span>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="purge" className="w-4 h-4" /> Effacer aussi le journal d’activité (irréversible ; sinon une trace de la réinitialisation y est ajoutée)</label>
      <label className="flex flex-col gap-1 text-sm font-semibold max-w-sm">Pour confirmer, tapez le prénom « {firstName} »
        <input className="field" name="confirm" autoComplete="off" required />
      </label>
      <div><button className="btn bg-warm text-white border-warm hover:bg-warm-dark hover:text-white" type="submit" disabled={pending}>{pending ? 'Réinitialisation…' : 'Réinitialiser tout le parcours'}</button></div>
      {state?.error && <span role="alert" className="text-sm text-warm-dark">{state.error}</span>}
      {state?.ok && <span role="status" className="text-sm text-brand-ink">{state.ok}</span>}
    </form>
  );
}
