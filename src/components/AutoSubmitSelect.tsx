'use client';
// Liste déroulante qui enregistre dès qu'on change de valeur (pas de bouton « Appliquer »)
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={e => { props.onChange?.(e); e.currentTarget.form?.requestSubmit(); }} />;
}
