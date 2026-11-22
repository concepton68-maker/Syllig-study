'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { buildPrompt, DEFAULT_OPTIONS, type PromptContext, type PromptOptions } from '@/lib/prompt-builder';

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold flex-[1_1_150px]">{label}
      <input className="field" type="number" min={min} max={max} value={value} onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />
    </label>
  );
}

export function Generator({ ctx }: { ctx: PromptContext }) {
  const [o, setO] = useState<PromptOptions>(DEFAULT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof PromptOptions>(k: K, v: PromptOptions[K]) => { setO({ ...o, [k]: v }); setCopied(false); };
  const prompt = useMemo(() => buildPrompt(ctx, o), [ctx, o]);
  const copy = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `consigne-${ctx.code}.md`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0">
      <section className="card flex-[1_1_340px] lg:max-w-[420px] flex flex-col gap-4 lg:h-full lg:overflow-y-auto pane [&>*]:shrink-0">
        <h2 className="text-lg font-semibold">Réglages</h2>
        <div className="flex flex-wrap gap-3">
          <Num label="Leçon (min)" value={o.lessonMinutes} min={10} max={90} onChange={n => set('lessonMinutes', n)} />
          <Num label="Parties min." value={o.partsMin} min={2} max={8} onChange={n => set('partsMin', n)} />
          <Num label="Parties max." value={o.partsMax} min={2} max={10} onChange={n => set('partsMax', n)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Num label="Exercices" value={o.exercises} min={4} max={20} onChange={n => set('exercises', n)} />
          <Num label="Évaluation (min)" value={o.evalMinutes} min={10} max={60} onChange={n => set('evalMinutes', n)} />
          <Num label="Sujets d’évaluation" value={o.evalVariants} min={1} max={3} onChange={n => set('evalVariants', n)} />
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">Demandes particulières (facultatif)
          <textarea className="field min-h-28" value={o.remarks} onChange={e => set('remarks', e.target.value)}
            placeholder="Ex. : insister sur les erreurs fréquentes de signe ; prendre des exemples tirés du sport ; l’élève a du mal avec la rédaction." />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 w-5 h-5" checked={o.includeExample} onChange={e => set('includeExample', e.target.checked)} />
          <span><strong>Inclure l’exemple C001 dans la consigne</strong><span className="block muted">Recommandé : un seul copier-coller suffit. Décochez si vous joignez le fichier à part.</span></span>
        </label>
        <div className="rounded-xl bg-soft px-4 py-3 text-sm flex flex-col gap-1.5">
          <strong>Ensuite</strong>
          <span>1. Copiez la consigne et collez-la dans une nouvelle conversation Claude.</span>
          <span>2. Copiez le JSON que Claude renvoie.</span>
          <span>3. <Link href="/contenu/importer">Importez-le</Link> : il est contrôlé puis enregistré en brouillon pour relecture.</span>
        </div>
      </section>
      <section className="card flex-[999_1_560px] min-w-0 flex flex-col gap-3 lg:h-full lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Consigne prête pour Claude</h2>
          <div className="flex gap-2">
            <button className="btn btn-primary" type="button" onClick={copy}>{copied ? 'Copiée ✓' : 'Copier la consigne'}</button>
            <button className="btn" type="button" onClick={download}>Télécharger (.md)</button>
          </div>
        </div>
        <span className="muted text-xs">{prompt.length.toLocaleString('fr-FR')} caractères</span>
        <textarea readOnly className="field font-mono text-xs min-h-[480px] lg:min-h-0 lg:flex-1 resize-none" value={prompt} aria-label="Consigne générée" />
      </section>
    </div>
  );
}
