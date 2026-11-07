import type { CSSProperties } from "react";
import type { Stage } from "./types";
import { PLEDGED_HATCH, STAGE_TEXT as KIT_STAGE_TEXT, stageFill } from "@/components/ui/tricolor";

/**
 * Thin adapter over the Tricolor kit (src/components/ui/tricolor.tsx), which is the source of
 * truth for stage colour. Pledged = hatched gold, custody = navy tints, verified = esmeralda.
 */
export const HATCH_AMBER: CSSProperties = { background: PLEDGED_HATCH };

/** Kept for API compatibility; Tricolor bars are plain fills (no mortar lines). */
export function courses(fill: string): CSSProperties {
  return { background: fill };
}

export const STAGE_FILL: Record<Exclude<Stage, "requested">, CSSProperties> = {
  pledged: { background: stageFill("pledged") },
  received: { background: stageFill("received") },
  delivered: { background: stageFill("delivered") },
  used: { background: stageFill("used") },
  verified: { background: stageFill("verified") },
};

export const STAGE_TEXT: Record<Stage, string> = KIT_STAGE_TEXT;

export function stageSwatch(stage: Stage): CSSProperties {
  if (stage === "requested") return { boxShadow: "inset 0 0 0 1px var(--foreground)" };
  if (stage === "pledged") return { background: PLEDGED_HATCH, boxShadow: "inset 0 0 0 1px var(--gold)" };
  return { background: stageFill(stage) };
}
