'use client';
import Link from 'next/link';
import { useState } from 'react';

type S = { name: string; chapters: { name: string; courses: { title: string; priority?: string }[] }[] };

// Arbre à cocher : matière › chapitre › cours. Décocher un parent décoche ses enfants ; cocher un cours recoche ses parents.
export function ProposalTree({ id, level, subjects, ignored, action }: { id: string; level: string; subjects: S[]; ignored: string[]; action: (f: FormData) => void }) {
  const all = subjects.flatMap(s => [s.name, ...s.chapters.flatMap(c => [`${s.name}|${c.name}`, ...c.courses.map(x => `${s.name}|${c.name}|${x.title}`)])]);
  const [on, setOn] = useState(() => new Set(all));
  const [open, setOpen] = useState<string | null>(subjects[0]?.name ?? null);
  const toggle = (key: string, v: boolean) => setOn(prev => {
    const n = new Set(prev);
    for (const k of all) if (k === key || k.startsWith(key + '|')) v ? n.add(k) : n.delete(k);
    if (v) { const p = key.split('|'); for (let i = 1; i < p.length; i++) n.add(p.slice(0, i).join('|')); }
    return n;
  });
  const courses = (s: S) => s.chapters.reduce((a, c) => a + c.courses.filter(x => on.has(`${s.name}|${c.name}|${x.title}`)).length, 0);
  const kept = subjects.filter(s => on.has(s.name) && courses(s) > 0).length;
  return (
    <form action={action} className="card !p-0 flex flex-col min-h-0 h-full" data-proposal={id}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {subjects.map(s => {
          const sOn = on.has(s.name), isOpen = open === s.name;
          return (
            <div key={s.name} className="border-t border-soft first:border-t-0" data-prop-subject={s.name}>
              <div className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                <input type="checkbox" checked={sOn} onChange={e => toggle(s.name, e.target.checked)} aria-label={s.name} />
                <button type="button" className="font-bold text-left bg-transparent border-0 p-0 cursor-pointer" onClick={() => setOpen(isOpen ? null : s.name)} aria-expanded={isOpen}>
                  {isOpen ? '▾' : '▸'} <span className={sOn ? '' : 'muted'}>{s.name}</span></button>
                <span className="muted text-[13px]">{sOn ? `${s.chapters.length} chapitre${s.chapters.length > 1 ? 's' : ''} · ${courses(s)} cours` : 'décochée : ne sera pas ajoutée'}</span>
              </div>
              {isOpen && <div className="pb-2">
                {s.chapters.map(c => {
                  const ck = `${s.name}|${c.name}`;
                  return (
                    <div key={ck} className="pl-10 pr-4 py-1" data-prop-chapter={c.name}>
                      <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={on.has(ck)} onChange={e => toggle(ck, e.target.checked)} />
                        <strong className={on.has(ck) ? '' : 'muted'}>{c.name}</strong><span className="muted text-[13px]">· {c.courses.length} cours</span></label>
                      <ul className="list-none m-0 pl-7 py-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                        {c.courses.map(x => { const k = `${ck}|${x.title}`; return (
                          <li key={k}><label className="flex items-center gap-1.5" data-prop-course={x.title}><input type="checkbox" checked={on.has(k)} onChange={e => toggle(k, e.target.checked)} />
                            <span className={on.has(k) ? '' : 'muted line-through'}>{x.title}</span>{x.priority === 'prioritaire' && <span className="text-xs font-bold text-brand-dark">prioritaire</span>}</label></li>); })}
                      </ul>
                    </div>
                  );
                })}
              </div>}
            </div>
          );
        })}
        {ignored.length > 0 && <p className="m-0 px-4 py-2.5 border-t border-soft text-[13px] muted" data-prop-ignored>Écartées (hors de la liste officielle du niveau) : {ignored.join(', ')}.</p>}
      </div>
      {[...on].map(k => <input key={k} type="hidden" name="k" value={k} />)}
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-t border-line bg-soft rounded-b-2xl">
        <span className="text-[13px] muted flex-1 min-w-[240px]">Chaque matière est prise dans la liste officielle du niveau. Rien n’est ajouté tant que tu n’as pas cliqué. Les cours arrivent ensuite dans le catalogue, à rédiger.</span>
        <Link href={`/contenu/programmes?niveau=${level}`} className="btn">Annuler</Link>
        <button type="submit" className="btn btn-primary" disabled={!kept} data-prop-apply>Ajouter {kept > 1 ? `les ${kept} matières cochées` : kept ? 'la matière cochée' : '…'}</button>
      </div>
    </form>
  );
}
