export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {/* Modernist: zero corner radius everywhere, including the mark. */}
      <rect width="40" height="40" fill="var(--color-accent-500)" />
      <path
        d="M12 28V12h11.5a3 3 0 0 1 1.9 5.3L22 20l3.4 2.7A3 3 0 0 1 23.5 28H12Z"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
