import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { audit, requireRole } from "./lib/auth";

/**
 * Weekly transparency reports. Exposed as `coordinator.*` via re-export (public listing lives in
 * public.listWeeklyReports). The snapshot is computed ONLY from actual records whose timestamps fall
 * in [periodStart, periodEnd). It contains aggregates only — no names, contacts or locations.
 */

const tokenArg = { sessionToken: v.string() };
const DAY = 24 * 60 * 60 * 1000;

export const weeklySnapshotValidator = v.object({
  pledgesCreated: v.number(),
  materials: v.array(
    v.object({
      itemKey: v.string(),
      nameEs: v.string(),
      nameEn: v.string(),
      unit: v.string(),
      pledged: v.number(),
      received: v.number(),
      delivered: v.number(),
      used: v.number(),
      verified: v.number(),
    }),
  ),
  financials: v.array(
    v.object({
      currency: v.string(),
      committed: v.number(),
      received: v.number(),
      allocated: v.number(),
      spent: v.number(),
    }),
  ),
  milestonesVerified: v.number(),
  evidenceApproved: v.number(),
  projectsPublished: v.number(),
  projectsPaused: v.number(),
});

export type WeeklySnapshot = typeof weeklySnapshotValidator.type;

const reportStatus = v.union(v.literal("draft"), v.literal("published"));

export async function computeWeeklySnapshot(
  ctx: QueryCtx | MutationCtx,
  nonprofitId: Id<"nonprofits"> | undefined,
  periodStart: number,
  periodEnd: number,
): Promise<WeeklySnapshot> {
  const projCache = new Map<Id<"projects">, Doc<"projects"> | null>();
  const inOrg = async (projectId: Id<"projects"> | undefined) => {
    if (!projectId) return false;
    if (!projCache.has(projectId)) projCache.set(projectId, await ctx.db.get(projectId));
    const p = projCache.get(projectId);
    return !!p && p.nonprofitId === nonprofitId;
  };
  const inRange = (t: number) => t >= periodStart && t < periodEnd;

  type Mat = WeeklySnapshot["materials"][number];
  const mats = new Map<string, Mat>();
  const needCache = new Map<Id<"materialNeeds">, Doc<"materialNeeds"> | null>();
  const mat = async (needId: Id<"materialNeeds">) => {
    if (!needCache.has(needId)) needCache.set(needId, await ctx.db.get(needId));
    const n = needCache.get(needId);
    if (!n) return null;
    let m = mats.get(n.itemKey);
    if (!m) {
      m = { itemKey: n.itemKey, nameEs: n.nameEs, nameEn: n.nameEn, unit: n.unit, pledged: 0, received: 0, delivered: 0, used: 0, verified: 0 };
      mats.set(n.itemKey, m);
    }
    return m;
  };

  let pledgesCreated = 0;
  for (const p of await ctx.db
    .query("pledges")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", periodStart).lt("_creationTime", periodEnd))
    .take(5000)) {
    if (!(await inOrg(p.projectId))) continue;
    pledgesCreated++;
    const m = await mat(p.needId);
    if (m) m.pledged += p.qty;
  }
  for (const e of await ctx.db
    .query("materialEvents")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", periodStart).lt("_creationTime", periodEnd))
    .take(5000)) {
    if (!(await inOrg(e.projectId))) continue;
    const m = await mat(e.needId);
    if (!m) continue;
    if (e.eventType === "returned") m.received -= e.qty;
    else m[e.eventType] += e.qty;
  }

  type Fin = WeeklySnapshot["financials"][number];
  const fins = new Map<string, Fin>();
  const fin = (c: string) => {
    let f = fins.get(c);
    if (!f) fins.set(c, (f = { currency: c, committed: 0, received: 0, allocated: 0, spent: 0 }));
    return f;
  };
  for (const d of await ctx.db
    .query("donations")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", periodStart).lt("_creationTime", periodEnd))
    .take(5000)) {
    const ok = d.projectId ? await inOrg(d.projectId) : d.nonprofitId === nonprofitId;
    if (!ok) continue;
    if (d.status === "committed") fin(d.currency).committed += d.amount;
    else fin(d.currency).received += d.amount;
    if (d.status === "allocated") fin(d.currency).allocated += d.amount;
  }
  // Expenses count as spent in the period they were APPROVED.
  for (const e of await ctx.db.query("expenses").order("desc").take(5000)) {
    if (e.reviewStatus !== "approved" || e.approvedAt === undefined || !inRange(e.approvedAt)) continue;
    if (!(await inOrg(e.projectId))) continue;
    fin(e.currency).spent += e.amount;
  }

  let evidenceApproved = 0;
  for (const ev of await ctx.db.query("evidence").order("desc").take(5000)) {
    if (ev.reviewStatus !== "approved" || ev.reviewedAt === undefined || !inRange(ev.reviewedAt)) continue;
    if (await inOrg(ev.projectId)) evidenceApproved++;
  }

  let milestonesVerified = 0;
  let projectsPublished = 0;
  let projectsPaused = 0;
  const projects = await ctx.db.query("projects").take(2000);
  for (const p of projects) {
    if (p.nonprofitId !== nonprofitId) continue;
    if (p.publishedAt !== undefined && inRange(p.publishedAt)) projectsPublished++;
    const ms = await ctx.db
      .query("milestones")
      .withIndex("by_project_time", (q) => q.eq("projectId", p._id).gte("occurredAt", periodStart).lt("occurredAt", periodEnd))
      .take(1000);
    for (const m of ms) {
      if (m.status !== "verified") continue;
      if (m.type === "verified" || m.type === "outcome") milestonesVerified++;
      if (m.type === "paused") projectsPaused++;
    }
  }

  return {
    pledgesCreated,
    materials: [...mats.values()].sort((a, b) => a.itemKey.localeCompare(b.itemKey)),
    financials: [...fins.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    milestonesVerified,
    evidenceApproved,
    projectsPublished,
    projectsPaused,
  };
}

function ymd(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}
function fmt(n: number) {
  return n.toLocaleString("en-US");
}

/**
 * Auto-drafted bilingual summary built ONLY from snapshot numbers. Coordinator reviews/edits before publishing.
 * Deliberately short: per-material and financial detail lives in the snapshot table, not the prose.
 */
export function draftSummary(s: WeeklySnapshot): { es: string; en: string } {
  const sum = (k: "pledged" | "received" | "delivered" | "used" | "verified") =>
    s.materials.reduce((a, m) => a + m[k], 0);
  const verified = sum("verified");
  const pledged = sum("pledged");
  const delivered = sum("delivered");
  const es = `${fmt(verified)} unidades verificadas con evidencia. ${fmt(delivered)} entregadas, ${fmt(pledged)} nuevas comprometidas.`;
  const en = `${fmt(verified)} units verified with evidence. ${fmt(delivered)} delivered, ${fmt(pledged)} newly pledged.`;
  return { es, en };
}

export const generateWeeklyReport = mutation({
  args: { ...tokenArg, periodStart: v.number(), periodEnd: v.number() },
  returns: v.id("weeklyReports"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["coordinator"]);
    if (!user.nonprofitId) throw new ConvexError({ code: "FORBIDDEN" });
    if (!(args.periodEnd > args.periodStart) || args.periodEnd - args.periodStart > 31 * DAY) {
      throw new ConvexError({ code: "INVALID_PERIOD" });
    }
    const snapshot = await computeWeeklySnapshot(ctx, user.nonprofitId, args.periodStart, args.periodEnd);
    const text = draftSummary(snapshot);
    const id = await ctx.db.insert("weeklyReports", {
      nonprofitId: user.nonprofitId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      snapshot,
      summaryEs: text.es,
      summaryEn: text.en,
      status: "draft",
      generatedBy: user._id,
    });
    await audit(ctx, user._id, "weeklyReport", id, "generate", `${ymd(args.periodStart)}..${ymd(args.periodEnd)}`);
    return id;
  },
});

async function requireReport(ctx: MutationCtx | QueryCtx, sessionToken: string, reportId: Id<"weeklyReports">) {
  const user = await requireRole(ctx, sessionToken, ["coordinator"]);
  const r = await ctx.db.get(reportId);
  if (!r) throw new ConvexError({ code: "NOT_FOUND", entity: "weeklyReport" });
  if (r.nonprofitId !== user.nonprofitId) throw new ConvexError({ code: "FORBIDDEN" });
  return { user, report: r };
}

export const updateWeeklyReport = mutation({
  args: { ...tokenArg, reportId: v.id("weeklyReports"), summaryEs: v.string(), summaryEn: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, report } = await requireReport(ctx, args.sessionToken, args.reportId);
    if (report.status !== "draft") throw new ConvexError({ code: "INVALID_STATUS", status: report.status });
    const es = args.summaryEs.trim();
    const en = args.summaryEn.trim();
    if (!es || !en || es.length > 10000 || en.length > 10000) throw new ConvexError({ code: "INVALID_FIELD" });
    await ctx.db.patch("weeklyReports", report._id, { summaryEs: es, summaryEn: en });
    await audit(ctx, user._id, "weeklyReport", report._id, "edit");
    return null;
  },
});

export const publishWeeklyReport = mutation({
  args: { ...tokenArg, reportId: v.id("weeklyReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, report } = await requireReport(ctx, args.sessionToken, args.reportId);
    if (report.status !== "draft") throw new ConvexError({ code: "INVALID_STATUS", status: report.status });
    await ctx.db.patch("weeklyReports", report._id, { status: "published", reviewedBy: user._id, publishedAt: Date.now() });
    await audit(ctx, user._id, "weeklyReport", report._id, "publish");
    return null;
  },
});

export const listWeeklyReports = query({
  args: tokenArg,
  returns: v.array(
    v.object({
      reportId: v.id("weeklyReports"),
      periodStart: v.number(),
      periodEnd: v.number(),
      snapshot: weeklySnapshotValidator,
      summaryEs: v.string(),
      summaryEn: v.string(),
      status: reportStatus,
      createdAt: v.number(),
      publishedAt: v.union(v.number(), v.null()),
      reviewedByName: v.union(v.string(), v.null()),
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["coordinator"]);
    const rows = await ctx.db.query("weeklyReports").order("desc").take(200);
    const out = [];
    for (const r of rows) {
      if (r.nonprofitId !== user.nonprofitId) continue;
      const rv = r.reviewedBy ? await ctx.db.get(r.reviewedBy) : null;
      out.push({
        reportId: r._id,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        snapshot: sanitizeSnapshot(r.snapshot),
        summaryEs: r.summaryEs,
        summaryEn: r.summaryEn,
        status: r.status,
        createdAt: r._creationTime,
        publishedAt: r.publishedAt ?? null,
        reviewedByName: rv?.name ?? null,
        isDemo: r.isDemo ?? false,
      });
    }
    return out;
  },
});

/** Rebuild the snapshot field-by-field so stored `any` can never leak extra keys. */
export function sanitizeSnapshot(raw: unknown): WeeklySnapshot {
  const s = (raw ?? {}) as Partial<WeeklySnapshot>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    pledgesCreated: num(s.pledgesCreated),
    materials: (Array.isArray(s.materials) ? s.materials : []).map((m) => ({
      itemKey: str(m.itemKey),
      nameEs: str(m.nameEs),
      nameEn: str(m.nameEn),
      unit: str(m.unit),
      pledged: num(m.pledged),
      received: num(m.received),
      delivered: num(m.delivered),
      used: num(m.used),
      verified: num(m.verified),
    })),
    financials: (Array.isArray(s.financials) ? s.financials : []).map((f) => ({
      currency: str(f.currency),
      committed: num(f.committed),
      received: num(f.received),
      allocated: num(f.allocated),
      spent: num(f.spent),
    })),
    milestonesVerified: num(s.milestonesVerified),
    evidenceApproved: num(s.evidenceApproved),
    projectsPublished: num(s.projectsPublished),
    projectsPaused: num(s.projectsPaused),
  };
}
