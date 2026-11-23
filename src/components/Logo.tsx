// Logo « livre-aurore » : un soleil qui se lève derrière un livre ouvert (l'aube du savoir).
// Titrage : « Syllig » en Source Serif demi-gras, « STUDY » en Inter capitales espacées.
// Les couleurs suivent le thème : sur la barre sombre, variables --side-* ; sur fond clair, couleurs de marque.
const BOOK = 'M24 19.6 C19 15.6 11.6 15.2 4.6 17.4 V39 C11.6 36.8 19 37.2 24 41.2 C29 37.2 36.4 36.8 43.4 39 V17.4 C36.4 15.2 29 15.6 24 19.6Z';

export function LogoMark({ size = 36, onDark = false, id = 'lm' }: { size?: number; onDark?: boolean; id?: string }) {
  const p1 = onDark ? 'var(--side-ink)' : 'var(--color-brand-ink)';
  const p2 = onDark ? 'var(--logo-page, var(--side-ink-2))' : 'var(--color-brand)';
  const sun = 'var(--logo-sun, #E8799B)';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="#fff" /><path d={BOOK} fill="#000" />
      </mask>
      <circle cx="24" cy="17" r="9.5" style={{ fill: sun }} mask={`url(#${id})`} />
      <path d="M23.1 21 C18.6 17.6 11.8 17.3 6 19.1 V37.2 C11.8 35.5 18.6 35.8 23.1 39.2Z" style={{ fill: p1 }} />
      <path d="M24.9 21 C29.4 17.6 36.2 17.3 42 19.1 V37.2 C36.2 35.5 29.4 35.8 24.9 39.2Z" style={{ fill: p2 }} />
    </svg>
  );
}

export function Logo({ role, onDark = false, size = 'md', id }: { role?: string; onDark?: boolean; size?: 'md' | 'lg'; id: string }) {
  const big = size === 'lg';
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={big ? 52 : 40} onDark={onDark} id={id} />
      <span className="flex flex-col leading-none">
        <span className={`font-[family-name:var(--font-serif)] font-semibold tracking-[-0.015em] ${big ? 'text-[30px]' : 'text-[24px]'}`}
          style={{ color: onDark ? 'var(--side-ink)' : 'var(--color-brand-ink)' }}>Syllig</span>
        <span className={`font-[family-name:var(--font-sans)] font-semibold tracking-[.48em] pl-[2px] ${big ? 'text-[11.5px] mt-1.5' : 'text-[9.5px] mt-1'}`}
          style={{ color: onDark ? 'var(--logo-page, var(--side-ink-2))' : 'var(--color-brand)' }}>STUDY</span>
      </span>
      {role && <span className="ml-1 self-start mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.1em]"
        style={{ background: 'rgb(255 255 255 / .12)', color: 'var(--side-ink-2)' }}>{role}</span>}
    </span>
  );
}
