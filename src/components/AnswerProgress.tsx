'use client';
import { ArrowDown, Check } from 'lucide-react';

// Barre d'avancement d'un questionnaire (exercices, évaluation) : toute la largeur, en haut,
// avec un raccourci vers la prochaine question sans réponse (plus besoin de tout faire défiler).
export function AnswerProgress({ answered, total, onJump }: { answered: number; total: number; onJump?: () => void }) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  const left = total - answered;
  return (
    <div className="shrink-0 border-b border-line bg-surface-2 sticky top-0 max-lg:-top-6 z-10 lg:static rounded-t-[inherit] overflow-hidden shadow-[0_6px_12px_-10px_rgb(0_0_0/.3)] lg:shadow-none">
      <div className="h-2.5 bg-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}
        aria-label={`${answered} questions répondues sur ${total}`}>
        <div className="h-full bg-brand transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span><strong className="num">{answered} / {total}</strong> question{total > 1 ? 's' : ''} répondue{total > 1 ? 's' : ''} · <span className="muted">{pct} %</span></span>
        {left > 0
          ? onJump && <button type="button" onClick={onJump} className="inline-flex items-center gap-1.5 font-semibold text-brand-dark hover:underline">
              <ArrowDown size={15} aria-hidden="true" />Prochaine question sans réponse{left > 1 ? ` (${left} restantes)` : ''}</button>
          : <span className="inline-flex items-center gap-1.5 font-semibold text-brand-dark"><Check size={15} aria-hidden="true" />Tout est rempli</span>}
      </div>
    </div>
  );
}
