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
  seeds: (
    <g {...P}>
      <path d="M14 10h20l-2 28H16z" />
      <path d="M24 30c0-5 0-8 0-10M24 22c-4 0-6-3-6-5 4 0 6 2 6 5zM24 20c4 0 6-3 6-5-4 0-6 2-6 5z" />
    </g>
  ),
  soil: (
    <g {...P}>
      <path d="M6 30c6-6 30-6 36 0" />
      <path d="M6 30c0 5 36 5 36 0" />
      <path d="M14 26l2-6M24 24V14M34 26l-2-6" />
      <path d="M24 16c-3 0-5-2-5-4 3 0 5 1 5 4z" />
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
