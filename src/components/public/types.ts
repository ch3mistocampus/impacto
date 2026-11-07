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

/** Category → token classes. Kept as literal strings so Tailwind picks them up. */
export const CATEGORY_STYLE: Record<
  Category,
  { text: string; bg: string; soft: string; border: string; image: string; emoji: string }
> = {
  roof_shelter: {
    text: "text-clay",
    bg: "bg-clay",
    soft: "bg-clay-soft",
    border: "border-clay",
    image: "/brand/roof_shelter.png",
    emoji: "🏠",
  },
  reconstruction: {
    text: "text-brick",
    bg: "bg-brick",
    soft: "bg-brick-soft",
    border: "border-brick",
    image: "/brand/reconstruction.png",
    emoji: "🧱",
  },
  heal_sow: {
    text: "text-leaf",
    bg: "bg-leaf",
    soft: "bg-leaf-soft",
    border: "border-leaf",
    image: "/brand/heal_sow.png",
    emoji: "🌱",
  },
};

export function isCategory(x: unknown): x is Category {
  return x === "roof_shelter" || x === "reconstruction" || x === "heal_sow";
}
