import Link from 'next/link';
import { RichText } from './RichText';
import { SupportTextView } from './CourseBlocks';
import { PageTitle } from './Shell';
import type { Review, Status } from '@/lib/review';
import type { SupportText } from '@/lib/course-format';

// « Revoir ensemble » : chaque question, sa réponse à côté du corrigé (maquette validée le 26/11/2026).
const TONE: Record<Status | 'info', string> = {
  ok: 'bg-brand-soft text-brand-dark', part: 'bg-[#FFF7E0] text-[#7A4A00]', ko: 'bg-warm-soft text-warm-dark', vide: 'bg-soft text-ink-2',
  attente: 'bg-soft text-ink-2', self_ok: 'bg-[#E7F8EE] text-[#1B5E3A]', self_ko: 'bg-warm-soft text-warm-dark', nc: 'bg-soft text-ink-2', info: 'bg-soft text-ink-2',
};
const ANSWER_BG: Partial<Record<Status, string>> = { ko: 'bg-warm-soft', part: 'bg-[#FFF7E0]', self_ko: 'bg-warm-soft' };

export function ReviewView({ r, name, back, all, base }: { r: Review; name: string; back: string; all: boolean; base: string }) {
  const badge = (s: Status) => ({ ok: 'Juste', part: 'En partie', ko: 'Fausse', vide: 'Sans réponse', attente: 'À corriger',
    self_ok: `Réussie selon ${name}`, self_ko: `À revoir selon ${name}`, nc: 'Non vérifiée' })[s];
  const todo = r.questions.filter(q => q.status !== 'ok');
  const list = all ? r.questions : todo;
  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href={back} className="text-sm font-semibold self-start min-h-11 inline-flex items-center">‹ La semaine</Link>
        <PageTitle kicker={`${r.kind === 'copie' ? 'Évaluation' : 'Exercices'} · ${r.subject}`} title={r.courseTitle} sub={`${name} · ${r.when}`}>
          <span className="flex items-center gap-4" data-review-score>
            <span className="text-[32px] font-bold leading-none whitespace-nowrap">{r.score.big}<span className="text-lg muted font-semibold"> {r.score.small}</span></span>
            {r.editHref && <Link className="btn btn-primary" href={r.editHref} data-edit-grade>{r.editLabel}</Link>}
          </span>
        </PageTitle>
      </div>
      <div className="flex flex-col gap-4">
        <ul className="list-none m-0 p-0 flex flex-wrap gap-2" aria-label="Résumé" data-review-chips>
          {r.chips.map(c => <li key={c.label} className={`pill text-sm font-semibold px-3 py-1.5 ${TONE[c.status]}`}>{c.label}</li>)}
        </ul>
        <nav aria-label="Afficher" className="flex gap-2">
          <Link href={base} aria-current={!all ? 'page' : undefined} className={`btn rounded-full ${!all ? 'btn-primary' : ''}`} data-filter="todo">À revoir ({todo.length})</Link>
          <Link href={`${base}${base.includes('?') ? '&' : '?'}tout=1`} aria-current={all ? 'page' : undefined} className={`btn rounded-full ${all ? 'btn-primary' : ''}`} data-filter="all">Toutes ({r.questions.length})</Link>
        </nav>
        {(r.texts as SupportText[]).length > 0 && (
          <details className="card">
            <summary className="cursor-pointer font-semibold">Texte du sujet</summary>
            <div className="mt-3 flex flex-col gap-3">{(r.texts as SupportText[]).map(t => <SupportTextView key={t.id} t={t} />)}</div>
          </details>
        )}
        {list.length === 0 && <p className="card m-0 text-[15px]">Tout est juste.</p>}
        {list.map(q => (
          <article key={q.id} className="card flex flex-col gap-3" data-review-q={q.status}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[16px] font-semibold leading-snug"><span className="muted mr-1.5">{q.n}.</span><RichText text={q.prompt} /></span>
              <span className={`pill shrink-0 text-[13px] font-bold ${TONE[q.status]}`}>{badge(q.status)}{q.points ? ` · ${q.points}` : ''}</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className={`rounded-xl px-3.5 py-3 flex flex-col gap-1 ${ANSWER_BG[q.status] ?? 'bg-surface-2'}`}>
                <span className="lbl">Réponse de {name}</span>
                <span className="text-[15px] whitespace-pre-wrap">{q.answerIsOption ? <RichText text={q.answer} /> : q.answer}</span>
              </div>
              <div className="rounded-xl px-3.5 py-3 flex flex-col gap-1 bg-brand-soft">
                <span className="lbl text-brand-dark">Corrigé</span>
                <span className="text-[15px]"><RichText text={q.expected} /></span>
                {q.solution && <details className="text-sm"><summary className="cursor-pointer font-semibold">Explication</summary><RichText text={q.solution} /></details>}
              </div>
            </div>
            {q.comment && <p className="m-0 text-sm"><strong>Commentaire : </strong>{q.comment}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
