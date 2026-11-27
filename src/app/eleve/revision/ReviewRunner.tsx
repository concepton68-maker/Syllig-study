'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { RichText } from '@/components/RichText';
import type { PublicQ, Answered, Summary } from '@/lib/revisions';
import { answerReview } from './actions';

// Révision du jour (maquette validée le 26/11/2026) : une question à la fois, corrigée aussitôt, puis la suivante.
// `training` : « M'entraîner » sur un cours (maquette validée le 27/11/2026) — même déroulé, fin différente, sans calendrier
export function ReviewRunner({ sessionId, questions, answered: initial, training }: { sessionId: string; questions: PublicQ[]; answered: Answered[]; training?: { courseId: number; title: string } }) {
  const [answered, setAnswered] = useState<Answered[]>(initial);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cur, setCur] = useState(() => questions.findIndex(q => !initial.some(a => a.idx === q.idx)));
  const [value, setValue] = useState('');
  const [multi, setMulti] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const q = questions[cur];
  const res = q ? answered.find(a => a.idx === q.idx) : undefined;
  const ok = answered.filter(a => a.correct).length;

  const send = (v: string) => {
    if (!q || res || pending || !v.trim()) return;
    start(async () => {
      const r = await answerReview(sessionId, q.idx, v);
      if (!r) return;
      setAnswered(a => [...a.filter(x => x.idx !== q.idx), r.result]);
      if (r.summary) setSummary(r.summary);
    });
  };
  const next = () => { setValue(''); setMulti([]); setCur(questions.findIndex(x => !answered.some(a => a.idx === x.idx))); };

  if ((cur === -1 || (!q && summary)) && training) {
    const base = `/eleve/cours/${training.courseId}`;
    const missed = answered.filter(a => !a.correct);
    const parts = [...new Set(missed.map(a => a.part).filter((p): p is number => p !== null))].sort((a, b) => a - b);
    const short = (t: string) => { const x = t.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim(); return x.length > 60 ? x.slice(0, 57) + '…' : x; };
    return (
      <section className="card flex flex-col gap-4 max-w-xl" data-training-done>
        <span className="lbl">Entraînement terminé · {training.title}</span>
        <span className="text-[30px] font-bold leading-none" data-review-score>{ok} juste{ok > 1 ? 's' : ''} sur {questions.length}</span>
        <ol className="list-none m-0 p-0 flex flex-col">
          {questions.map((x, i) => { const a = answered.find(y => y.idx === x.idx); return (
            <li key={x.idx} className="flex justify-between gap-3 py-2 border-t border-soft text-sm"><span>{i + 1} · {short(x.prompt)}</span>
              <strong className={a?.correct ? 'text-brand-dark' : 'text-warm-dark'}>{a?.correct ? 'Juste' : 'À revoir'}</strong></li>); })}
        </ol>
        {parts.map(p => <Link key={p} href={`${base}/lecon?debut=1#partie-${p}`} className="flex justify-between items-center gap-3 rounded-xl bg-warm-soft px-3 py-2.5 no-underline text-ink" data-reread-part={p}>
          <span className="text-sm"><strong>La partie {p} de la leçon</strong></span><span className="font-semibold text-brand-dark">Relire ›</span></Link>)}
        <a className="btn btn-primary min-h-[52px]" href={`${base}/entrainement`} data-train-again>5 autres questions</a>
        <Link className="btn min-h-[52px]" href={base}>Retour au cours</Link>
        <span className="text-xs muted">Ta note du cours ne change pas.</span>
      </section>
    );
  }
  if (cur === -1 || (!q && summary)) {
    return (
      <section className="card flex flex-col gap-4 max-w-xl" data-review-done>
        <h1 className="text-2xl font-bold m-0">Révision faite</h1>
        <span className="text-[32px] font-bold leading-none" data-review-score>{ok} / {questions.length}</span>
        {summary && <ul className="list-none m-0 p-0 flex flex-col gap-2">
          {summary.map(s => (
            <li key={s.course_id} className={`flex justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ${s.passed ? 'bg-surface-2' : 'bg-warm-soft'}`} data-next={s.next_days}>
              <span>{s.title} <span className="muted">· {s.ok}/{s.total}</span></span><strong className="whitespace-nowrap">{s.next_days === 1 ? 'demain' : `dans ${s.next_days} jours`}</strong>
            </li>))}
        </ul>}
        <span className="text-sm muted">Réussi : on revoit plus tard. Raté : on revoit plus tôt.</span>
        <Link className="btn btn-primary self-start" href="/eleve">Terminer</Link>
      </section>
    );
  }
  const opts = q.options ?? [];
  return (
    <section className="card flex flex-col gap-4 max-w-xl" data-review-q={q.idx}>
      <div className="flex justify-between items-center gap-3 text-sm"><span className="muted">{q.course}</span><strong>Question {answered.length + (res ? 0 : 1)} sur {questions.length}</strong></div>
      <div className="h-1.5 rounded-full bg-track"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${(answered.length / questions.length) * 100}%` }} /></div>
      <h1 className="text-xl font-semibold m-0 leading-snug"><RichText text={q.prompt} /></h1>
      {q.type === 'qcm' ? (
        <div className="flex flex-col gap-2.5">
          {opts.map((o, k) => {
            const chosen = q.multi ? multi.includes(k) : false;
            const tone = res ? (res.expected.split(' ; ').includes(o) ? 'border-brand bg-brand-soft text-brand-dark' : res.given.split(' ; ').includes(o) ? 'border-warm-dark bg-warm-soft text-warm-dark' : 'border-line') : chosen ? 'border-brand bg-brand-soft' : 'border-line';
            return <button key={k} type="button" disabled={!!res || pending} data-option={k}
              onClick={() => q.multi ? setMulti(m => m.includes(k) ? m.filter(x => x !== k) : [...m, k]) : send(String(k))}
              className={`min-h-[52px] text-left px-4 rounded-xl border-[1.5px] bg-white font-semibold text-[15px] ${tone}`}><RichText text={o} /></button>;
          })}
          {q.multi && !res && <button type="button" className="btn btn-primary self-start" disabled={!multi.length || pending} onClick={() => send(multi.sort().join(','))}>Valider</button>}
        </div>
      ) : (
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(value); }}>
          <input className="field flex-1" value={value} onChange={e => setValue(e.target.value)} disabled={!!res} aria-label="Ta réponse" inputMode={q.type === 'numeric' ? 'decimal' : 'text'} autoComplete="off" />
          {!res && <button className="btn btn-primary" type="submit" disabled={!value.trim() || pending}>Valider</button>}
        </form>
      )}
      {res && (
        <div className={`rounded-xl px-4 py-3 flex flex-col gap-1 ${res.correct ? 'bg-brand-soft text-brand-dark' : 'bg-warm-soft text-warm-dark'}`} data-review-result={res.correct ? 'juste' : 'faux'}>
          <strong>{res.correct ? 'Juste' : 'Pas tout à fait'}</strong>
          {!res.correct && <span className="text-sm text-ink">Réponse attendue : <RichText text={res.expected} /></span>}
          {res.solution && <span className="text-sm text-ink"><RichText text={res.solution} /></span>}
        </div>
      )}
      {res && <button type="button" className="btn btn-primary min-h-[52px]" onClick={next} data-review-next>{answered.length >= questions.length ? 'Voir le résultat' : 'Suivante'}</button>}
      {training && <span className="text-xs muted">Corrigé tout de suite. Ça ne change pas ta note du cours.</span>}
    </section>
  );
}
