import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type ReviewData = FunctionReturnType<typeof api.coordinator.getProjectForReview>;
export type ReviewProject = ReviewData["project"];
export type ReviewPrivate = NonNullable<ReviewData["private"]>;
export type ReviewNeed = ReviewData["needs"][number];
export type ReviewPhoto = ReviewData["photos"][number];
export type ReviewPledge = ReviewData["pledges"][number];
export type ReviewReport = ReviewData["fieldReports"][number];
export type ReviewMilestone = ReviewData["milestones"][number];
export type InboxData = FunctionReturnType<typeof api.coordinator.inbox>;
export type InboxItem = InboxData["inReview"][number];

const STOP = new Set([
  "familia", "family", "señor", "señora", "senor", "senora", "sr", "sra", "don", "doña", "dona",
  "de", "del", "la", "los", "las", "y", "calle", "street", "barrio", "carr", "carretera", "km",
]);

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function distinctiveTokens(s: string | null | undefined, minLen: number) {
  if (!s) return [];
  return norm(s)
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length >= minLen && !STOP.has(t));
}

/**
 * Mirrors server-side findPrivateLeak (convex/projects.ts) for live warnings.
 * Server re-checks on publish; this is only the early warning.
 */
export function containsPrivate(text: string, privateValue: string | null | undefined, minLen = 4): boolean {
  if (!privateValue?.trim() || !text.trim()) return false;
  const n = norm(text);
  if (n.includes(norm(privateValue.trim()))) return true;
  const words = new Set(n.split(/[^a-z0-9ñ]+/));
  return distinctiveTokens(privateValue, minLen).some((t) => words.has(t));
}

export const CATEGORY_ALIAS: Record<string, { es: string; en: string }> = {
  roof_shelter: { es: "Techo y Refugio", en: "Roof and Shelter" },
  reconstruction: { es: "Reconstrucción", en: "Reconstruction" },
  heal_sow: { es: "Sanar y Sembrar", en: "Heal and Sow" },
};

/** Suggest an anonymous alias like "Reconstrucción 015" from category + project id. */
export function suggestAlias(category: string, projectId: string, locale: "es" | "en") {
  let h = 0;
  for (const c of projectId) h = (h * 31 + c.charCodeAt(0)) % 997;
  const n = String((h % 900) + 10).padStart(3, "0");
  const base = CATEGORY_ALIAS[category]?.[locale] ?? (locale === "es" ? "Proyecto" : "Project");
  return `${base} ${n}`;
}
