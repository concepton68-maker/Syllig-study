// Ce qui a changé entre deux versions d'un cours (maquette validée le 27/11/2026) : chaque valeur du document est repérée
// par un chemin lisible (« Évaluation · sujet 2 · q4 · réponse ») ; on compare valeur par valeur. Sans dépendance serveur.

type Line = { group: string; field: string; value: string };

const FIELD: Record<string, string> = {
  title: 'titre', prompt: 'énoncé', options: 'choix', answer: 'réponse', solution: 'corrigé', points: 'points', explanation: 'explication',
  quote: 'citation', text: 'texte', content: 'texte', items: 'liste', memo: 'fiche mémo', objectives: 'objectifs', essential: 'l’essentiel',
  duration_min: 'durée', total_points: 'barème total', conditions: 'conditions', tolerance: 'tolérance', type: 'type de question',
  lesson_part: 'partie de leçon', criteria: 'critères', rubric: 'grille', hint: 'indice', skills: 'compétences',
};
const label = (k: string) => FIELD[k] ?? k;
const str = (v: unknown) => typeof v === 'string' ? v : JSON.stringify(v);

/** Aplatit un document de cours en lignes (groupe lisible, champ, valeur). */
export function flatten(doc: Record<string, unknown>): Line[] {
  const out: Line[] = [];
  const walk = (v: unknown, group: string, field: string) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v) && v.every(x => typeof x !== 'object' || x === null)) { out.push({ group, field, value: v.map(str).join(' | ') }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, group, `${field} ${i + 1}`)); return; }
    if (typeof v === 'object') { for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, group, field ? `${field} · ${label(k)}` : label(k)); return; }
    out.push({ group, field, value: str(v) });
  };
  const d = doc as Record<string, any>;
  for (const k of ['code', 'level', 'subject', 'chapter', 'title', 'skills']) walk(d[k], 'Fiche du cours', label(k));
  const L = d.lesson ?? {};
  for (const k of ['duration_min', 'objectives', 'essential', 'memo']) walk(L[k], 'Leçon', label(k));
  (L.parts ?? []).forEach((p: Record<string, unknown>, i: number) => {
    const { checkpoint, ...rest } = p;
    walk(rest, `Leçon · partie ${i + 1}`, '');
    walk(checkpoint, `Leçon · partie ${i + 1} · point de contrôle`, '');
  });
  const E = d.exercises ?? {};
  for (const [k, v] of Object.entries(E)) if (k !== 'items') walk(v, 'Exercices', label(k));
  (E.items ?? []).forEach((q: Record<string, unknown>, i: number) => walk(q, `Exercices · ${q.id ?? `n° ${i + 1}`}`, ''));
  const V = d.evaluation ?? {};
  for (const [k, v] of Object.entries(V)) if (k !== 'variants') walk(v, 'Évaluation', label(k));
  (V.variants ?? []).forEach((va: Record<string, any>, s: number) => {
    walk(va.texts, `Évaluation · sujet ${s + 1} · textes`, '');
    (va.sections ?? []).forEach((se: Record<string, any>, k: number) => {
      const { questions, ...rest } = se;
      walk(rest, `Évaluation · sujet ${s + 1}`, `partie ${k + 1}`);
      (questions ?? []).forEach((q: Record<string, unknown>, i: number) => walk(q, `Évaluation · sujet ${s + 1} · ${q.id ?? `q${i + 1}`}`, ''));
    });
  });
  for (const [k, v] of Object.entries(d)) if (!['format', 'code', 'level', 'subject', 'chapter', 'title', 'skills', 'lesson', 'exercises', 'evaluation'].includes(k)) walk(v, 'Autre', k);
  return out;
}

export type Change = { group: string; field: string; before: string | null; after: string | null };

/** Les valeurs qui diffèrent, dans l'ordre du document. */
export function diffCourse(before: Record<string, unknown>, after: Record<string, unknown>): Change[] {
  // clé unique : groupe + champ, numérotée si le même chemin revient (deux questions au même identifiant)
  const keyed = (ls: Line[]) => { const seen = new Map<string, number>(); return ls.map(l => { const k = `${l.group}\u0000${l.field}`; const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); return { l, k: `${k}\u0000${n}` }; }); };
  const a = new Map(keyed(flatten(before)).map(x => [x.k, x.l]));
  const bk2 = keyed(flatten(after));
  const bk = new Set(bk2.map(x => x.k));
  const out: Change[] = [];
  for (const { l, k } of bk2) { const o = a.get(k); if (!o || o.value !== l.value) out.push({ group: l.group, field: l.field, before: o?.value ?? null, after: l.value }); }
  for (const [k, o] of a) if (!bk.has(k)) out.push({ group: o.group, field: o.field, before: o.value, after: null });
  return out;
}

/** Résumé court : les parties touchées (« Exercices · ex3, Évaluation · sujet 2 · q4 »). */
export function changeSummary(ch: Change[], max = 4) {
  const groups = [...new Set(ch.map(c => c.group))];
  return groups.length > max ? `${groups.slice(0, max).join(', ')} et ${groups.length - max} autre${groups.length - max > 1 ? 's' : ''}` : groups.join(', ');
}
