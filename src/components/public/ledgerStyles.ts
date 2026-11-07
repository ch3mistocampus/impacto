import type { CSSProperties } from "react";

/** Inline patterns (kept here instead of globals.css, which is shared). */
export const HATCH_AMBER: CSSProperties = {
  backgroundColor: "var(--amber-soft)",
  backgroundImage:
    "repeating-linear-gradient(-45deg, var(--amber) 0 2px, transparent 2px 6px)",
};

/** Brick-course mortar lines laid over a fill, so bars read as courses of material. */
export function courses(fill: string, brick = 14): CSSProperties {
  return {
    backgroundColor: fill,
    backgroundImage: `repeating-linear-gradient(90deg, transparent 0 ${brick - 2}px, var(--surface) ${brick - 2}px ${brick}px)`,
  };
}
