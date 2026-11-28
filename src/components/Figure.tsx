import type { Figure as F } from '@/lib/course-format';

// Schéma SVG d'un cours : affiché comme une image (data:), donc sans script ni ressource extérieure, quel que soit son contenu.
export const svgSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(/xmlns=/.test(svg) ? svg : svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"'))}`;

export function FigureView({ f, className = '' }: { f: Pick<F, 'svg' | 'alt' | 'caption'>; className?: string }) {
  return (
    <figure className={`m-0 flex flex-col items-center gap-1.5 ${className}`} data-figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={svgSrc(f.svg)} alt={f.alt} className="max-w-full w-[560px] h-auto rounded-xl bg-white border border-line p-2" />
      {f.caption && <figcaption className="text-sm muted text-center">{f.caption}</figcaption>}
    </figure>
  );
}
