export function Logo({ role }: { role?: string }) {
  return (
    <span className="flex items-center gap-2.5 mr-3">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r="13" fill="none" stroke="#2F4FD8" strokeWidth="2.5" />
        <path d="M15 6 L19 15 L15 24 L11 15 Z" fill="#2F4FD8" />
      </svg>
      <span className="font-[family-name:var(--font-display)] font-bold text-xl text-ink">Syllig Study</span>
      {role && <span className="pill bg-soft text-ink-2">{role}</span>}
    </span>
  );
}
