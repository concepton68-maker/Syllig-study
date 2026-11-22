// Mise en page « écran fixe » : sur grand écran, la barre du haut et les titres restent en place,
// seules les zones de contenu défilent. Sur téléphone, défilement simple.

export function Screen({ top, children, className = '' }: { top?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-1 lg:min-h-0">
      {top && <div className="shrink-0">{top}</div>}
      <div className={`flex flex-col gap-6 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pane lg:pr-1 lg:pb-2 [&>*]:shrink-0 ${className}`}>{children}</div>
    </div>
  );
}

// Colonnes qui défilent chacune de leur côté
export function Panes({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap gap-6 items-start lg:flex-nowrap lg:items-stretch lg:flex-1 lg:min-h-0 ${className}`}>{children}</div>;
}

export function Pane({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-w-0 flex flex-col gap-6 lg:h-full lg:min-h-0 lg:overflow-y-auto pane lg:pr-1 lg:pb-2 [&>*]:shrink-0 ${className}`}>{children}</div>;
}

// Écran fait d'un en-tête fixe puis de colonnes
export function PaneScreen({ top, children }: { top?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-1 lg:min-h-0">
      {top && <div className="shrink-0">{top}</div>}
      {children}
    </div>
  );
}
