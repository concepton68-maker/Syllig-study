import Link from 'next/link';
import type { SubjectSummary } from '@/lib/subject-summary';

// Bilan « matière par matière » (maquette validée le 26/11/2026) : notes une par une, moyenne avec leur nombre, cours acquis, cours à revoir.
const fr = (n: number) => n.toLocaleString('fr-FR');
const date = (s: string) => new Date(s).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });

function Notes({ notes }: { notes: SubjectSummary['notes'] }) {
  const shown = notes.slice(-12);
  const W = 260, H = 70, y = (n: number) => 8 + (1 - n / 20) * 46;
  const x = (i: number) => shown.length === 1 ? W / 2 : 16 + (i * (W - 32)) / (shown.length - 1);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[70px] block" role="img" aria-label={`Notes, de la plus ancienne à la plus récente : ${shown.map(n => `${fr(n.note)}/20`).join(', ')}`}>
        <line x1="0" x2={W} y1={y(10)} y2={y(10)} stroke="var(--color-line-strong)" strokeDasharray="4 4" />
        {shown.length > 1 && <polyline points={shown.map((n, i) => `${x(i)},${y(n.note)}`).join(' ')} fill="none" stroke="var(--color-brand)" strokeWidth="2" />}
        {shown.map((n, i) => <circle key={n.id} cx={x(i)} cy={y(n.note)} r="5" fill="var(--color-brand)" stroke="var(--color-white)" strokeWidth="2" />)}
        {shown.map((n, i) => <text key={`t${n.id}`} x={x(i)} y={n.note < 5 ? y(n.note) - 9 : y(n.note) + 18} fontSize="11" textAnchor="middle" fill="var(--color-ink-2)">{fr(n.note)}</text>)}
      </svg>
      <div className="absolute inset-0 flex">
        {shown.map(n => <span key={n.id} tabIndex={0} className="flex-1" data-tip={`${n.title} · ${date(n.at)} · ${fr(n.note)}/20`} />)}
      </div>
    </div>
  );
}

export function SubjectCards({ s }: { s: { subjects: SubjectSummary[] } }) {
  return (
    <section aria-labelledby="matieres" className="flex flex-col gap-3" data-subject-cards>
      <h2 id="matieres" className="text-lg font-semibold m-0">Matière par matière <span className="muted font-normal text-sm">· notes depuis le 1er septembre</span></h2>
      {s.subjects.length === 0 ? <p className="card m-0 text-sm muted">Pas encore de cours commencé.</p> : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {s.subjects.map(m => (
            <article key={m.subject} className="card flex flex-col gap-3" data-subject={m.subject}>
              <div className="flex justify-between items-baseline gap-2"><strong className="text-[17px]">{m.subject}</strong>
                <span className="text-[13px] muted">{m.notes.length ? `${m.notes.length} copie${m.notes.length > 1 ? 's' : ''} notée${m.notes.length > 1 ? 's' : ''}` : 'aucune copie notée'}</span></div>
              {m.avg !== null && <div className="flex items-baseline gap-1.5" data-avg><strong className="text-[28px] leading-none">{fr(m.avg)}</strong><span className="muted">/20{m.notes.length > 1 ? ' de moyenne' : ''}</span></div>}
              {m.notes.length > 0 && <Notes notes={m.notes} />}
              <div className="flex justify-between text-sm" data-acquired><span>Cours acquis</span><strong>{m.acquired} / {m.published}</strong></div>
              <div className="flex flex-wrap gap-1.5 items-center text-[13px]" data-review><span className="muted">À revoir :</span>
                {m.review.length === 0 ? <span className="muted">rien pour l’instant</span>
                  : m.review.map(r => <Link key={r.href} href={r.href} className="pill bg-warm-soft text-warm-dark font-semibold no-underline !whitespace-normal" data-tip={`${r.missed} question${r.missed > 1 ? 's' : ''} à 0 point ou sans réponse dans la dernière copie`}>{r.title}</Link>)}
              </div>
            </article>
          ))}
        </div>
      )}
      <span className="text-xs muted">Notes : chaque copie notée depuis le 1er septembre, tentatives comprises. Pointillés : 10/20. Acquis : au moins une évaluation à 14/20 ou plus, depuis l’inscription, sur les cours disponibles. Graphique : les 12 dernières notes. À revoir : cours dont la dernière copie notée a une question à 0 point ou sans réponse.</span>
    </section>
  );
}
