/**
 * Impacto brand mark ("Three causes"): one glyph per program, read left to right —
 * roof (techo y abrigo), brick (reconstrucción), sprout (sanar y sembrar).
 * Decorative: always pair it with the "Impacto" wordmark or an accessible label.
 * Brand exception: this is the one place red/gold/green appear as identity colours rather than
 * ledger-stage colours (see globals.css). Don't reuse these glyph colours to encode categories.
 * The same artwork lives in src/app/icon.svg and public/brand/icon-*.png.
 */
export function BrandMark({ className = "", height = 24 }: { className?: string; height?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 96 32"
      height={height}
      width={(height * 96) / 32}
      className={`shrink-0 ${className}`}
    >
      <path
        d="M4 26 16 12 28 26"
        fill="none"
        stroke="var(--red)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="36" y="13" width="24" height="13" rx="2" fill="var(--gold)" />
      <path
        d="M80 28C71 28 67 21 67 12c9 0 13 6 13 16Zm0 0c0-10 4-16 13-16 0 9-4 16-13 16Z"
        fill="var(--emerald)"
      />
    </svg>
  );
}
