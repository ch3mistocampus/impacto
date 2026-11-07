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
  pledgedTotal: v.number(),
  received: v.number(),
  delivered: v.number(),
  used: v.number(),
  verified: v.number(),
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
  v.literal("delivered"),
  v.literal("used"),
  v.literal("verified"),
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
  /** Set only when the linked evidence is approved for public view. */
  evidenceId: v.union(v.id("evidence"), v.null()),
});

export const evidenceTypeValidator = v.union(
  v.literal("receipt"),
  v.literal("delivery_photo"),
  v.literal("handover_doc"),
  v.literal("staff_note"),
  v.literal("before_photo"),
  v.literal("after_photo"),
);

/** Public financial row — original currency, never converted. */
export const financialRowValidator = v.object({
  currency: v.string(),
  received: v.number(),
  allocated: v.number(),
  spent: v.number(),
});

/** Public evidence item (approved + publicApproved only). */
export const publicEvidenceValidator = v.object({
  evidenceId: v.id("evidence"),
  type: evidenceTypeValidator,
  url: v.union(v.string(), v.null()),
  noteEs: v.union(v.string(), v.null()),
  noteEn: v.union(v.string(), v.null()),
  createdAt: v.number(),
});

export function isEvidencePublic(e: Doc<"evidence">): boolean {
  return e.reviewStatus === "approved" && e.publicApproved;
}

/** Public URL for evidence: ONLY the approved publicStorageId; never the private original. */
export async function publicEvidenceUrl(ctx: QueryCtx | MutationCtx, e: Doc<"evidence">): Promise<string | null> {
  if (!isEvidencePublic(e) || !e.publicStorageId) return null;
  return await ctx.storage.getUrl(e.publicStorageId);
}

export async function publicEvidenceList(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  const rows = await ctx.db
    .query("evidence")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(200);
  const out = [];
  for (const e of rows) {
    if (!isEvidencePublic(e)) continue;
    out.push({
      evidenceId: e._id,
      type: e.type,
      url: await publicEvidenceUrl(ctx, e),
      noteEs: e.noteEs ?? null,
      noteEn: e.noteEn ?? null,
      createdAt: e._creationTime,
    });
  }
  return out;
}

type FinRow = { currency: string; received: number; allocated: number; spent: number };

/**
 * Financials grouped by original currency. received = contributions with status received|allocated
 * (money in hand); allocated = status allocated; spent = approved expenses. Committed (promised)
 * money is NOT counted as received. No FX conversion.
 */
export async function projectFinancials(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<FinRow[]> {
  const map = new Map<string, FinRow>();
  const row = (c: string) => {
    let r = map.get(c);
    if (!r) {
      r = { currency: c, received: 0, allocated: 0, spent: 0 };
      map.set(c, r);
    }
    return r;
  };
  const donations = await ctx.db
    .query("donations")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(1000);
  for (const d of donations) {
    if (d.status === "received" || d.status === "allocated") row(d.currency).received += d.amount;
    if (d.status === "allocated") row(d.currency).allocated += d.amount;
  }
  const expenses = await ctx.db
    .query("expenses")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(1000);
  for (const e of expenses) {
    if (e.reviewStatus === "approved") row(e.currency).spent += e.amount;
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function mergeFinancials(rows: FinRow[]): FinRow[] {
  const map = new Map<string, FinRow>();
  for (const r of rows) {
    const cur = map.get(r.currency) ?? { currency: r.currency, received: 0, allocated: 0, spent: 0 };
    cur.received += r.received;
    cur.allocated += r.allocated;
    cur.spent += r.spent;
    map.set(r.currency, cur);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

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
    let photoUrl = await publicPhotoUrl(ctx, m.photoId);
    let evidenceId: Id<"evidence"> | null = null;
    if (m.evidenceId) {
      const ev = await ctx.db.get(m.evidenceId);
      if (ev && isEvidencePublic(ev)) {
        evidenceId = ev._id;
        if (!photoUrl) photoUrl = await publicEvidenceUrl(ctx, ev);
      }
    }
    out.push({
      milestoneId: m._id,
      type: m.type,
      occurredAt: m.occurredAt,
      descriptionEs: m.publicDescriptionEs,
      descriptionEn: m.publicDescriptionEn,
      photoUrl,
      evidenceId,
    });
  }
  return out;
}

function lowerFirst(s: string) {
  return s.length ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Bilingual, privacy-safe auto text for ledger milestones. */
export function materialMilestoneText(
  kind: "pledge" | "received" | "delivered" | "used" | "verified" | "returned" | "pledge_canceled" | "pledge_expired",
  qty: number,
  need: Pick<Doc<"materialNeeds">, "nameEs" | "nameEn">,
): { es: string; en: string } {
  const es = `${qty} ${lowerFirst(need.nameEs)}`;
  const en = `${qty} ${lowerFirst(need.nameEn)}`;
  switch (kind) {
    case "pledge":
      return { es: `Compromiso de donación: ${es} (comprometido, no entregado)`, en: `Pledge: ${en} (pledged, not delivered)` };
    case "received":
      return { es: `Recibido por el equipo: ${es}`, en: `Received by the team: ${en}` };
    case "delivered":
      return { es: `${es} entregados al proyecto`, en: `${en} delivered to the project` };
    case "used":
      return { es: `${es} utilizados en la obra (pendiente de verificación)`, en: `${en} used on site (pending verification)` };
    case "verified":
      return { es: `Uso verificado con evidencia: ${es}`, en: `Use verified with evidence: ${en}` };
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
