// État vide : une icône, une phrase, une action — jamais une simple ligne grise
export function EmptyState({ title, text, action, icon = '✓' }: { title: string; text?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2">
      <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-xl bg-brand-soft text-brand inline-flex items-center justify-center text-lg spark-icon">{icon}</span>
      <div className="flex flex-col gap-1">
        <strong className="text-[17px]">{title}</strong>
        {text && <span className="muted text-sm">{text}</span>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// « Prioritaire » : pastille à contour, distincte des niveaux de maîtrise
export function PriorityPill() {
  return <span className="pill border border-warm text-warm bg-white">▲ Prioritaire</span>;
}
