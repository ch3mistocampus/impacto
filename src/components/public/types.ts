export type Category = "roof_shelter" | "reconstruction" | "heal_sow";
export const CATEGORIES: Category[] = ["roof_shelter", "reconstruction", "heal_sow"];

/** Mirrors convex/lib/ledger.ts NeedLedger (structural, so either side can be passed). */
export type Ledger = {
  requested: number | null;
  pledged: number;
  received: number;
  delivered: number;
  used: number;
  verified: number;
  availableToPledge: number;
};

/** The six separate measures, in order. Never merge them; public "impact" = verified only. */
export type Stage = "requested" | "pledged" | "received" | "delivered" | "used" | "verified";
export const STAGES: Stage[] = ["requested", "pledged", "received", "delivered", "used", "verified"];
export type StageTotals = Record<Stage, number>;

/** Public project statuses (DB values) — labels are mapped in the UI only. */
export type PublicStatus = "published" | "paused" | "completed";

/**
 * Category → token classes. Tricolor: programs are told apart by SHAPE, never colour, so every
 * category maps to the same neutral ink/paper classes. Render `<CategoryMark category=… />`
 * (src/components/ui/tricolor.tsx) next to the label to distinguish programs. `image` points
 * to a generated program illustration, used only when no approved cover photo is available.
 */
const NEUTRAL = {
  text: "text-foreground",
  bg: "bg-foreground",
  soft: "bg-paper",
  border: "border-rule",
} as const;

export const CATEGORY_STYLE: Record<
  Category,
  { text: string; bg: string; soft: string; border: string; image: string }
> = {
  roof_shelter: { ...NEUTRAL, image: "/brand/roof_shelter.webp" },
  reconstruction: { ...NEUTRAL, image: "/brand/reconstruction.webp" },
  heal_sow: { ...NEUTRAL, image: "/brand/heal_sow.webp" },
};

export function isCategory(x: unknown): x is Category {
  return x === "roof_shelter" || x === "reconstruction" || x === "heal_sow";
}
