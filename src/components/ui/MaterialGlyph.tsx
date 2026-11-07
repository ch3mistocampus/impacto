/**
 * Fine line drawings of each material (engraving-like, to sit with Bodoni). Replaces emoji.
 * Drawn on a 48×48 grid, 1.5px strokes in currentColor, so they inherit ink colour and scale.
 */
const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const GLYPHS: Record<string, React.ReactNode> = {
  bricks: (
    <g {...P}>
      <rect x="5" y="10" width="18" height="8" />
      <rect x="25" y="10" width="18" height="8" />
      <rect x="14" y="20" width="20" height="8" />
      <path d="M5 20h7M36 20h7M5 28h7M36 28h7" />
      <rect x="5" y="30" width="18" height="8" />
      <rect x="25" y="30" width="18" height="8" />
    </g>
  ),
  cement_bag: (
    <g {...P}>
      <path d="M12 9c4 2 20 2 24 0l3 30c-5 2-25 2-30 0z" />
      <path d="M11 15c5 1.6 21 1.6 26 0" />
      <path d="M17 26h14M19 31h10" />
    </g>
  ),
  zinc_sheet: (
    <g {...P}>
      <path d="M6 16l36-4v20L6 36z" />
      <path d="M12 15.3v20M18 14.6v20M24 14v20M30 13.3v20M36 12.6v20" />
    </g>
  ),
  wood_beam: (
    <g {...P}>
      <path d="M6 20l30-8 6 6-30 8z" />
      <path d="M6 20v8l6 6v-8M12 34l30-8v-8" />
      <ellipse cx="9" cy="27" rx="1.6" ry="2.6" transform="rotate(-30 9 27)" />
    </g>
  ),
  nails: (
    <g {...P}>
      <path d="M14 8h8M18 8v30l-1.5 3" />
      <path d="M28 12h8M32 12v26l-1.5 3" />
    </g>
  ),
  tarp: (
    <g {...P}>
      <path d="M6 34L24 12l18 22z" />
      <path d="M24 12v22M15 23l-2 11M33 23l2 11" />
      <path d="M4 38h40" />
    </g>
  ),
  paint: (
    <g {...P}>
      <path d="M12 16h24v20a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z" />
      <ellipse cx="24" cy="16" rx="12" ry="3" />
      <path d="M14 16c0-8 20-8 20 0" />
      <path d="M18 26h12" />
    </g>
  ),
  rebar: (
    <g {...P}>
      <path d="M8 34L38 8M12 38L42 12" />
      <path d="M12 28l3 3M17 23.5l3 3M22 19l3 3M27 14.5l3 3M32 10l3 3" />
    </g>
  ),
  water_tank: (
    <g {...P}>
      <ellipse cx="24" cy="12" rx="12" ry="3.5" />
      <path d="M12 12v22c0 2 5.4 3.5 12 3.5S36 36 36 34V12" />
      <path d="M12 20c0 2 5.4 3.5 12 3.5S36 22 36 20M12 28c0 2 5.4 3.5 12 3.5S36 30 36 28" />
    </g>
  ),
  tools: (
    <g {...P}>
      <path d="M10 38l16-16" />
      <path d="M24 16a6 6 0 0 1 8-6l-4 4 2 4 4 2 4-4a6 6 0 0 1-6 8" />
      <path d="M38 38L24 24M16 10l-4 4 6 6 4-4z" />
    </g>
  ),
  facilitator: (
    <g {...P}>
      <circle cx="15" cy="15" r="4.5" />
      <circle cx="33" cy="15" r="4.5" />
      <path d="M7 36c0-6 3.6-10 8-10s8 4 8 10M25 36c0-6 3.6-10 8-10s8 4 8 10" />
      <path d="M21 9c1.6-2 4.4-2 6 0" />
    </g>
  ),
  venue: (
    <g {...P}>
      <path d="M5 20L24 9l19 11" />
      <path d="M9 18v20M39 18v20M5 38h38" />
      <path d="M17 38v-6h14v6M17 32l-2 6M31 32l2 6" />
    </g>
  ),
  meals: (
    <g {...P}>
      <path d="M8 22h32c0 9-7 15-16 15S8 31 8 22z" />
      <path d="M6 22h36M20 37h8" />
      <path d="M18 17c0-3 2-3 2-6M24 17c0-3 2-3 2-6M30 17c0-3 2-3 2-6" />
    </g>
  ),
  transport: (
    <g {...P}>
      <path d="M6 32V16a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v16z" />
      <path d="M6 22h36M15 12v10M24 12v10M33 12v10" />
      <circle cx="14" cy="34" r="3.5" />
      <circle cx="34" cy="34" r="3.5" />
    </g>
  ),
  sports_kit: (
    <g {...P}>
      <circle cx="24" cy="24" r="15" />
      <path d="M24 17l6.7 4.9-2.6 7.9h-8.2l-2.6-7.9z" />
      <path d="M24 17V9M30.7 21.9l7.6-2.5M28.1 29.8l4.7 6.4M19.9 29.8l-4.7 6.4M17.3 21.9l-7.6-2.5" />
    </g>
  ),
  art_supplies: (
    <g {...P}>
      <path d="M10 40V24a8 8 0 0 1 16 0v16z" />
      <circle cx="15" cy="23" r="1" />
      <circle cx="21" cy="23" r="1" />
      <path d="M15 29c2 2 4 2 6 0" />
      <path d="M32 40l4-24 3 .5-4 24zM36 16l1.5-5 1.5 5.5" />
    </g>
  ),
  generic: (
    <g {...P}>
      <path d="M8 16l16-8 16 8v18l-16 8-16-8z" />
      <path d="M8 16l16 8 16-8M24 24v18" />
    </g>
  ),
};

export function MaterialGlyph({
  itemKey,
  label,
  className = "size-12",
}: {
  itemKey?: string;
  /** Accessible name. Omit when the material name is already printed next to the glyph. */
  label?: string;
  className?: string;
}) {
  const g = (itemKey && GLYPHS[itemKey]) || GLYPHS.generic;
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {g}
    </svg>
  );
}
