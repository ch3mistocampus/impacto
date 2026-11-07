import type { CSSProperties } from "react";
import type { Stage } from "./types";

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

/**
 * One visual identity per stage. Promises are hatched amber; nonprofit-confirmed custody
 * deepens through sky (received → delivered → used); verified impact is the only leaf-green.
 */
export const STAGE_FILL: Record<Exclude<Stage, "requested">, CSSProperties> = {
  pledged: HATCH_AMBER,
  received: courses("color-mix(in srgb, var(--sky) 35%, transparent)"),
  delivered: courses("color-mix(in srgb, var(--sky) 65%, transparent)"),
  used: courses("var(--sky)"),
  verified: courses("var(--leaf)"),
};

export const STAGE_TEXT: Record<Stage, string> = {
  requested: "text-foreground",
  pledged: "text-amber",
  received: "text-sky",
  delivered: "text-sky",
  used: "text-sky",
  verified: "text-leaf",
};

/** Small square swatch style for legends/tiles. */
export function stageSwatch(stage: Stage): CSSProperties {
  if (stage === "requested") return { border: "2px solid color-mix(in srgb, var(--foreground) 45%, transparent)" };
  if (stage === "pledged") return HATCH_AMBER;
  const bg: Record<string, string> = {
    received: "color-mix(in srgb, var(--sky) 35%, transparent)",
    delivered: "color-mix(in srgb, var(--sky) 65%, transparent)",
    used: "var(--sky)",
    verified: "var(--leaf)",
  };
  return { backgroundColor: bg[stage] };
}
