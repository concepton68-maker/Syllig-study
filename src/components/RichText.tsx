// Mise en forme légère autorisée dans les contenus : **gras**, *italique*, retours à la ligne.
import { Fragment } from 'react';

export function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((seg, j) =>
            seg.startsWith('**') && seg.endsWith('**') && seg.length > 4 ? <strong key={j}>{seg.slice(2, -2)}</strong>
            : seg.startsWith('*') && seg.endsWith('*') && seg.length > 2 ? <em key={j}>{seg.slice(1, -1)}</em>
            : <Fragment key={j}>{seg}</Fragment>)}
        </Fragment>
      ))}
    </>
  );
}
