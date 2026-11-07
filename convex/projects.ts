import { v, ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole, canSeePrivate } from "./lib/auth";

/**
 * Shared helpers for Lane A (public / pledges / coordinator / seed).
 * No Convex functions are registered here — only validators and helpers.
 */

export const PUBLIC_STATUSES = ["published", "paused", "completed"] as const;
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

export function isPublicStatus(s: Doc<"projects">["status"]): s is PublicStatus {
  return (PUBLIC_STATUSES as readonly string[]).includes(s);
}

export const ledgerValidator = v.object({
  requested: v.union(v.number(), v.null()),
  pledged: v.number(),
  received: v.number(),
  used: v.number(),
  availableToPledge: v.number(),
});

export const pledgeModeValidator = v.union(
  v.literal("have_materials"),
  v.literal("will_buy"),
  v.literal("request_instructions"),
);

export const pledgeStatusValidator = v.union(
  v.literal("active"),
  v.literal("fulfilled"),
  v.literal("canceled"),
  v.literal("expired"),
);

export const milestoneTypeValidator = v.union(
  v.literal("need_reported"),
  v.literal("approved"),
  v.literal("published"),
  v.literal("pledge"),
  v.literal("received"),
  v.literal("used"),
  v.literal("expense"),
  v.literal("outcome"),
  v.literal("paused"),
);

/** Public milestone (timeline entry) — allowlisted. */
export const publicMilestoneValidator = v.object({
  milestoneId: v.id("milestones"),
  type: milestoneTypeValidator,
  occurredAt: v.number(),
  descriptionEs: v.string(),
  descriptionEn: v.string(),
  photoUrl: v.union(v.string(), v.null()),
});

/** Signed URL for a photo ONLY if it is approved for public view; else null. */
export async function publicPhotoUrl(
  ctx: QueryCtx | MutationCtx,
  photoId: Id<"photos"> | undefined,
): Promise<string | null> {
  if (!photoId) return null;
  const photo = await ctx.db.get(photoId);
  if (!photo || photo.visibility !== "publicApproved" || photo.reviewStatus !== "approved") return null;
  return await ctx.storage.getUrl(photo.storageId);
}

/** Verified milestones only, chronological, allowlisted. */
export async function publicTimeline(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  const ms = await ctx.db
    .query("milestones")
    .withIndex("by_project_time", (q) => q.eq("projectId", projectId))
    .take(300);
  const out = [];
  for (const m of ms) {
    if (m.status !== "verified") continue;
    out.push({
      milestoneId: m._id,
      type: m.type,
      occurredAt: m.occurredAt,
      descriptionEs: m.publicDescriptionEs,
      descriptionEn: m.publicDescriptionEn,
      photoUrl: await publicPhotoUrl(ctx, m.photoId),
    });
  }
  return out;
}

function lowerFirst(s: string) {
  return s.length ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Bilingual, privacy-safe auto text for ledger milestones. */
export function materialMilestoneText(
  kind: "pledge" | "received" | "used" | "returned" | "pledge_canceled" | "pledge_expired",
  qty: number,
  need: Pick<Doc<"materialNeeds">, "nameEs" | "nameEn">,
): { es: string; en: string } {
  const es = `${qty} ${lowerFirst(need.nameEs)}`;
  const en = `${qty} ${lowerFirst(need.nameEn)}`;
  switch (kind) {
    case "pledge":
      return { es: `Compromiso de donación: ${es} (comprometido, no entregado)`, en: `Pledge: ${en} (pledged, not delivered)` };
    case "received":
      return { es: `Recibido y verificado: ${es}`, en: `Received and verified: ${en}` };
    case "used":
      return { es: `Uso verificado: ${es}`, en: `Verified use: ${en}` };
    case "returned":
      return { es: `Devuelto: ${es}`, en: `Returned: ${en}` };
    case "pledge_canceled":
      return { es: `Compromiso cancelado: ${es} vuelven a estar disponibles`, en: `Pledge canceled: ${en} available again` };
    case "pledge_expired":
      return { es: `Compromiso vencido: ${es} vuelven a estar disponibles`, en: `Pledge expired: ${en} available again` };
  }
}

/** Coordinator of the project's nonprofit, or throw. */
export async function requireCoordinatorFor(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
  projectId: Id<"projects">,
): Promise<{ user: Doc<"users">; project: Doc<"projects"> }> {
  const user = await requireRole(ctx, sessionToken, ["coordinator"]);
  const project = await ctx.db.get(projectId);
  if (!project) throw new ConvexError({ code: "NOT_FOUND", entity: "project" });
  if (!(await canSeePrivate(ctx, user, projectId))) throw new ConvexError({ code: "FORBIDDEN" });
  return { user, project };
}

const NAME_STOPWORDS = new Set([
  "familia", "family", "señor", "señora", "senor", "senora", "sr", "sra", "don", "doña", "dona", "de", "del", "la", "los", "las", "y",
]);

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Returns the offending field name if any public text contains the beneficiary name
 * (full name, or any distinctive token ≥ 4 chars). Null if clean.
 */
export function findPrivateLeak(
  beneficiaryName: string | undefined,
  fields: Record<string, string>,
): string | null {
  if (!beneficiaryName || !beneficiaryName.trim()) return null;
  const full = norm(beneficiaryName.trim());
  const tokens = full
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length >= 4 && !NAME_STOPWORDS.has(t));
  for (const [key, value] of Object.entries(fields)) {
    const n = norm(value);
    if (n.includes(full)) return key;
    const words = new Set(n.split(/[^a-z0-9ñ]+/));
    if (tokens.some((t) => words.has(t))) return key;
  }
  return null;
}
