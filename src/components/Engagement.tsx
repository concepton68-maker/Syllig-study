import { HeartHandshake } from 'lucide-react';
import { QUADRANT, THRESHOLD, type Engagement, type Axis } from '@/lib/engagement';

// « Ne veut pas » ou « n'arrive pas » : carte investissement × compréhension, avec le détail de chaque mesure.
const C_S = '#2F4FD8', C_C = '#00b894';
const CONF = { insuffisant: 'Pas encore assez de données', indicatif: 'Indicatif', solide: 'Fiable' };

function AxisBlock({ title, sub, axis, color, testid }: { title: string; sub: string; axis: Axis; color: string; testid: string }) {
  return (
    <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-2" data-axis={testid}>
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold">{title}</span>
        <strong className="ml-auto text-2xl tabular-nums" data-axis-score>{axis.score === null ? '—' : `${axis.score} %`}</strong>
      </div>
      <span className="muted text-[13px] -mt-1">{sub}</span>
      <div className="h-2.5 rounded-full bg-track overflow-hidden" role="img" aria-label={`${title} : ${axis.score ?? 'non mesuré'} %`}>
        {axis.score !== null && <div className="h-full rounded-full" style={{ width: `${axis.score}%`, background: color }} />}
      </div>
      {axis.parts.length === 0 && <span className="muted text-sm">Pas encore mesuré.</span>}
      <ul className="list-none m-0 p-0 flex flex-col gap-1.5 text-sm">
        {axis.parts.map(p => (
          <li key={p.key} className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-soft pt-1.5">
            <span>{p.label}<span className="block muted text-[13px]">{p.fact}</span></span>
            <strong className="tabular-nums">{p.score} %</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Map({ e }: { e: Engagement }) {
  const P = 300, pad = 34, inner = P - pad - 8;
  const X = (v: number) => pad + (v / 100) * inner, Y = (v: number) => 8 + (1 - v / 100) * inner;
  const S = e.serieux.score, C = e.comprehension.score;
  const zone = (q: keyof typeof QUADRANT, x: number, y: number, anchor: 'start' | 'end') => (
    <text x={x} y={y} fontSize={11} fontWeight={600} textAnchor={anchor} fill={e.quadrant === q ? 'var(--color-ink)' : 'var(--color-muted-2)'}>{QUADRANT[q].short}</text>
  );
  return (
    <svg viewBox={`0 0 ${P} ${P}`} className="w-full max-w-[340px] h-auto block mx-auto" role="img"
      aria-label={`Carte : investissement ${S ?? '—'} %, compréhension ${C ?? '—'} %`}>
      <rect x={X(THRESHOLD)} y={Y(100)} width={X(100) - X(THRESHOLD)} height={Y(THRESHOLD) - Y(100)} fill="var(--color-brand-soft)" />
      <rect x={X(0)} y={Y(100)} width={inner} height={inner} fill="none" stroke="var(--color-line-strong)" />
      <line x1={X(THRESHOLD)} x2={X(THRESHOLD)} y1={Y(0)} y2={Y(100)} stroke="var(--color-line-strong)" strokeDasharray="4 3" />
      <line x1={X(0)} x2={X(100)} y1={Y(THRESHOLD)} y2={Y(THRESHOLD)} stroke="var(--color-line-strong)" strokeDasharray="4 3" />
      {zone('investissement', X(2), Y(96), 'start')}{zone('reussite', X(98), Y(96), 'end')}
      {zone('decrochage', X(2), Y(2), 'start')}{zone('difficulte', X(98), Y(2), 'end')}
      <text x={X(50)} y={P - 2} fontSize={11} textAnchor="middle" fill="var(--color-muted)">Investissement (sérieux) →</text>
      <text x={10} y={Y(50)} fontSize={11} textAnchor="middle" fill="var(--color-muted)" transform={`rotate(-90 10 ${Y(50)})`}>Compréhension →</text>
      {S !== null && C !== null && <circle data-overall cx={X(S)} cy={Y(C)} r={11} fill={C_S} stroke="#fff" strokeWidth={2.5} />}
      {e.subjects.map((s, i) => (
        <g key={s.subject} data-subject={s.subject}>
          <circle cx={X(s.serieux)} cy={Y(s.comprehension)} r={9} fill="#fff" stroke="var(--color-ink-2)" strokeWidth={1.5} />
          <text x={X(s.serieux)} y={Y(s.comprehension) + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill="var(--color-ink)">{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

export function EngagementCard({ e, name }: { e: Engagement; name: string }) {
  const q = e.quadrant ? QUADRANT[e.quadrant] : null;
  return (
    <section className="card flex flex-col gap-4" aria-labelledby="engagement" data-engagement={e.quadrant ?? 'aucun'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="engagement" className="text-xl font-semibold m-0 flex items-center gap-2 mr-auto"><HeartHandshake size={20} aria-hidden="true" />Ne veut pas, ou n’arrive pas ?</h2>
        <span className={`pill ${e.confidence === 'solide' ? 'bg-brand-soft text-brand-dark' : e.confidence === 'indicatif' ? 'bg-soft text-ink-2' : 'bg-warm-soft text-warm-dark'}`} data-confidence={e.confidence}>{CONF[e.confidence]}</span>
      </div>
      <p className="muted text-sm m-0">Deux mesures séparées, sur les 4 dernières semaines et tous les cours faits. La compréhension n’est calculée que sur le travail fait sérieusement : une copie bâclée mesure le manque de sérieux, pas la compréhension.</p>
      <div className="flex flex-wrap gap-6 items-start">
        <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-3">
          <Map e={e} />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs muted">
            <span className="flex items-center gap-1.5"><i className="inline-block size-3 rounded-full" style={{ background: C_S }} />{name}, toutes matières</span>
            <span>Pointillés : seuil de {THRESHOLD} %</span>
          </div>
          {e.subjects.length > 0 && (
            <ol className="list-none m-0 p-0 flex flex-col gap-1 text-sm" aria-label="Par matière">
              {e.subjects.map((s, i) => (
                <li key={s.subject} className="flex items-center gap-2">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink-2 text-[11px] font-bold">{i + 1}</span>
                  <span className="mr-auto">{s.subject}</span>
                  <span className="muted text-[13px] tabular-nums">investissement {s.serieux} % · compréhension {s.comprehension} %</span>
                </li>
              ))}
              <li className="muted text-[12px] pt-1">Par matière : lecture des leçons et effort en évaluation seulement ; la régularité et la concentration se mesurent toutes matières confondues.</li>
            </ol>
          )}
        </div>
        <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-3">
          {q ? (
            <div className="rounded-xl bg-soft p-4 flex flex-col gap-2">
              <span className="lbl">Profil actuel</span>
              <strong className="text-lg" data-quadrant-title>{q.title}</strong>
              <span className="text-sm">{q.meaning}</span>
              {e.near_limit && <span className="text-[13px] muted">Proche de la limite : à confirmer au prochain bilan.</span>}
              <span className="lbl mt-1">Ce qui aide le plus</span>
              <ul className="m-0 pl-5 text-sm flex flex-col gap-1">{q.todo.map(t => <li key={t}>{t}</li>)}</ul>
            </div>
          ) : (
            <div className="rounded-xl bg-soft p-4 text-sm flex flex-col gap-1"><strong>Pas encore de profil</strong><span>{e.confidence_why}</span></div>
          )}
          {e.confidence !== 'insuffisant' && <span className="muted text-[13px]">{e.confidence_why}</span>}
          {e.excluded_evals > 0 && <span className="text-[13px] rounded-lg bg-warm-soft text-warm-dark px-3 py-2">{e.excluded_evals} évaluation{e.excluded_evals > 1 ? 's' : ''} rendue{e.excluded_evals > 1 ? 's' : ''} trop vite ou à moitié vide{e.excluded_evals > 1 ? 's' : ''} : comptée{e.excluded_evals > 1 ? 's' : ''} dans l’investissement, pas dans la compréhension.</span>}
          {e.trend.drop && <span className="text-[13px] rounded-lg bg-warm-soft text-warm-dark px-3 py-2" data-trend>
            Activité en baisse : {e.trend.last14} min ces 14 derniers jours contre {e.trend.prev14} min les 14 jours d’avant.
            {e.trend.after_bad_grade ? ' La baisse suit une note faible : possible découragement, à aborder avec bienveillance.' : ''}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-6 border-t border-line pt-4">
        <AxisBlock testid="serieux" title="Investissement" sub="Est-ce qu’il travaille, régulièrement et sérieusement ?" axis={e.serieux} color={C_S} />
        <AxisBlock testid="comprehension" title="Compréhension" sub="Quand il travaille sérieusement, est-ce que c’est compris ?" axis={e.comprehension} color={C_C} />
      </div>
    </section>
  );
}
