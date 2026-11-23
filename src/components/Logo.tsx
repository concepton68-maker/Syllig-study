// Logo : boussole + nom. Sur la barre latérale sombre, les couleurs viennent des variables --side-*.
export function Logo({ role, onDark = false }: { role?: string; onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <defs>
          <linearGradient id="lg-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: onDark ? 'var(--side-accent)' : 'var(--color-brand)' }} />
            <stop offset="1" style={{ stopColor: onDark ? 'var(--side-accent-2)' : 'var(--color-brand-dark)' }} />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="32" height="32" rx="10" fill="url(#lg-logo)" />
        <circle cx="17" cy="17" r="9.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" />
        <path d="M17 8.5 L20.2 17 L17 25.5 L13.8 17 Z" fill="#fff" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-display)] font-bold text-[19px] tracking-tight" style={{ color: onDark ? 'var(--side-ink)' : 'var(--color-ink)' }}>Syllig Study</span>
        {role && <span className="text-[11px] font-semibold uppercase tracking-[.12em] mt-1" style={{ color: onDark ? 'var(--side-ink-2)' : 'var(--color-muted)' }}>{role}</span>}
      </span>
    </span>
  );
}
