import type { Block, SupportText } from '@/lib/course-format';
import { RichText } from './RichText';

const CALLOUT: Record<string, { label: string; cls: string }> = {
  retiens: { label: 'Je retiens', cls: 'bg-brand-soft text-[#1E2A78]' },
  definition: { label: 'Définition', cls: 'bg-brand-soft text-[#1E2A78]' },
  essentiel: { label: 'L’essentiel', cls: 'bg-brand-soft text-[#1E2A78]' },
  methode: { label: 'Méthode', cls: 'bg-soft text-ink-2' },
  plus: { label: 'Pour aller plus loin', cls: 'bg-soft text-ink-2' },
  attention: { label: 'Attention', cls: 'bg-warm-soft text-warm-dark' },
};

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return <p className="prose-lesson m-0"><RichText text={block.text} /></p>;
    case 'heading':
      return <h3 className="text-lg font-semibold mt-2">{block.text}</h3>;
    case 'list': {
      const L = block.ordered ? 'ol' : 'ul';
      return <L className={`prose-lesson m-0 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((it, i) => <li key={i}><RichText text={it} /></li>)}</L>;
    }
    case 'table':
      return (
        <div className="overflow-x-auto border border-line rounded-xl">
          <table className="tbl min-w-[520px]">
            {block.caption && <caption className="text-left px-3 py-2 text-sm font-semibold">{block.caption}</caption>}
            {block.columns && <thead><tr>{block.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>}
            <tbody>{block.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 ? 'font-semibold' : ''}><RichText text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'callout': {
      const c = CALLOUT[block.kind];
      return (
        <div className={`rounded-xl px-4 py-3.5 ${c.cls}`}>
          <strong className="text-sm">{block.title ?? c.label}</strong>
          <p className="mt-1 mb-0 text-[15px] leading-relaxed"><RichText text={block.text} /></p>
        </div>
      );
    }
    case 'quote':
      return <blockquote className="prose-lesson italic border-l-4 border-brand-mid pl-4 m-0"><RichText text={block.text} />{block.source && <footer className="not-italic text-sm muted mt-1">{block.source}</footer>}</blockquote>;
    case 'formula':
      return <pre className="bg-soft rounded-lg px-4 py-3 overflow-x-auto text-[15px]">{block.latex}</pre>;
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.url} alt={block.alt} className="max-w-full rounded-lg" />;
  }
}

export function SupportTextView({ t }: { t: SupportText }) {
  return (
    <section className="rounded-xl border border-line bg-[#FCFCFD] px-5 py-4">
      <div className="lbl mb-2">{t.label}</div>
      <div className="prose-lesson flex flex-col gap-2">{t.paragraphs.map((p, i) => <p key={i} className="m-0"><RichText text={p} /></p>)}</div>
      {t.source && <p className="muted text-xs mt-2 mb-0">{t.source}</p>}
    </section>
  );
}

export function Stars({ n }: { n?: number }) {
  if (!n) return null;
  return <span aria-label={`niveau ${n} sur 3`} className="text-warm">{'★'.repeat(n)}</span>;
}
