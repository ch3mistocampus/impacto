import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { category } from "./schema";
import { computeLedger } from "./lib/ledger";
import {
  PUBLIC_STATUSES,
  isPublicStatus,
  ledgerValidator,
  pledgeModeValidator,
  pledgeStatusValidator,
  publicMilestoneValidator,
  publicPhotoUrl,
  publicTimeline,
} from "./projects";

/**
 * PUBLIC queries — no auth. Every return object is built field-by-field (allowlist).
 * Never return: projectPrivate, donorContact, other donors' names, createdBy/approvedBy ids,
 * private photos, nonprofit-internal notes.
 */

const CATEGORIES = ["roof_shelter", "reconstruction", "heal_sow"] as const;
const publicStatus = v.union(v.literal("published"), v.literal("paused"), v.literal("completed"));
const urgency = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

const projectCard = v.object({
  projectId: v.id("projects"),
  publicAlias: v.string(),
  category,
  titleEs: v.string(),
  titleEn: v.string(),
  summaryEs: v.string(),
  summaryEn: v.string(),
  urgency,
  status: publicStatus,
  region: v.union(v.string(), v.null()),
  publishedAt: v.union(v.number(), v.null()),
  safetyPauseReasonPublic: v.union(v.string(), v.null()),
  coverPhotoUrl: v.union(v.string(), v.null()),
  isDemo: v.boolean(),
  needsCount: v.number(),
  totals: v.object({
    requested: v.number(),
    pledged: v.number(),
    received: v.number(),
    used: v.number(),
  }),
});

const publicNeed = v.object({
  needId: v.id("materialNeeds"),
  itemKey: v.string(),
  nameEs: v.string(),
  nameEn: v.string(),
  unit: v.string(),
  needsConfirmation: v.boolean(),
  status: v.union(v.literal("approved"), v.literal("fulfilled")),
  verified: v.boolean(),
  ledger: ledgerValidator,
});

async function publicNeeds(ctx: QueryCtx, projectId: Id<"projects">) {
  const needs = await ctx.db
    .query("materialNeeds")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(100);
  const out = [];
  for (const n of needs) {
    if (n.status !== "approved" && n.status !== "fulfilled") continue;
    out.push({
      needId: n._id,
      itemKey: n.itemKey,
      nameEs: n.nameEs,
      nameEn: n.nameEn,
      unit: n.unit,
      needsConfirmation: n.needsConfirmation,
      status: n.status,
      verified: n.verifiedBy !== undefined,
      ledger: await computeLedger(ctx, n._id),
    });
  }
  return out;
}

async function toCard(ctx: QueryCtx, p: Doc<"projects">) {
  if (!isPublicStatus(p.status)) throw new Error("not public");
  const needs = await publicNeeds(ctx, p._id);
  const totals = { requested: 0, pledged: 0, received: 0, used: 0 };
  for (const n of needs) {
    totals.requested += n.ledger.requested ?? 0;
    totals.pledged += n.ledger.pledged;
    totals.received += n.ledger.received;
    totals.used += n.ledger.used;
  }
  return {
    projectId: p._id,
    publicAlias: p.publicAlias,
    category: p.category,
    titleEs: p.titleEs,
    titleEn: p.titleEn,
    summaryEs: p.summaryEs,
    summaryEn: p.summaryEn,
    urgency: p.urgency,
    status: p.status,
    region: p.region ?? null,
    publishedAt: p.publishedAt ?? null,
    safetyPauseReasonPublic: p.status === "paused" ? (p.safetyPauseReasonPublic ?? null) : null,
    coverPhotoUrl: await publicPhotoUrl(ctx, p.coverPhotoId),
    isDemo: p.isDemo,
    needsCount: needs.length,
    totals,
  };
}

async function publicProjects(
  ctx: QueryCtx,
  cat: Doc<"projects">["category"] | undefined,
  statuses: readonly Doc<"projects">["status"][] = PUBLIC_STATUSES,
) {
  const out: Doc<"projects">[] = [];
  for (const s of statuses) {
    const rows = cat
      ? await ctx.db
          .query("projects")
          .withIndex("by_category_status", (q) => q.eq("category", cat).eq("status", s))
          .take(200)
      : await ctx.db
          .query("projects")
          .withIndex("by_status", (q) => q.eq("status", s))
          .take(200);
    out.push(...rows);
  }
  return out;
}

export const impactTotals = query({
  args: {},
  returns: v.array(
    v.object({
      category,
      projectsPublished: v.number(),
      itemsRequested: v.number(),
      itemsPledged: v.number(),
      itemsReceived: v.number(),
      itemsUsedVerified: v.number(),
      outcomesVerified: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const result = [];
    for (const cat of CATEGORIES) {
      const projects = await publicProjects(ctx, cat);
      const row = {
        category: cat,
        projectsPublished: projects.length,
        itemsRequested: 0,
        itemsPledged: 0,
        itemsReceived: 0,
        itemsUsedVerified: 0,
        outcomesVerified: 0,
      };
      for (const p of projects) {
        for (const n of await publicNeeds(ctx, p._id)) {
          row.itemsRequested += n.ledger.requested ?? 0;
          row.itemsPledged += n.ledger.pledged;
          row.itemsReceived += n.ledger.received;
          row.itemsUsedVerified += n.ledger.used;
        }
        const ms = await ctx.db
          .query("milestones")
          .withIndex("by_project_time", (q) => q.eq("projectId", p._id))
          .take(300);
        row.outcomesVerified += ms.filter((m) => m.type === "outcome" && m.status === "verified").length;
      }
      result.push(row);
    }
    return result;
  },
});

export const listPublishedProjects = query({
  args: { category: v.optional(category) },
  returns: v.array(projectCard),
  handler: async (ctx, args) => {
    const projects = await publicProjects(ctx, args.category);
    const order: Record<string, number> = { published: 0, paused: 1, completed: 2 };
    projects.sort(
      (a, b) => order[a.status] - order[b.status] || (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
    );
    const out = [];
    for (const p of projects) out.push(await toCard(ctx, p));
    return out;
  },
});

export const getProject = query({
  // string (not v.id) so a malformed URL param returns null instead of throwing.
  args: { projectId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      project: projectCard,
      needs: v.array(publicNeed),
      timeline: v.array(publicMilestoneValidator),
      photos: v.array(
        v.object({
          photoId: v.id("photos"),
          url: v.string(),
          captionEs: v.union(v.string(), v.null()),
          captionEn: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("projects", args.projectId);
    if (!id) return null;
    const p = await ctx.db.get(id);
    if (!p || !isPublicStatus(p.status)) return null;
    const photoRows = await ctx.db
      .query("photos")
      .withIndex("by_project_visibility", (q) => q.eq("projectId", id).eq("visibility", "publicApproved"))
      .take(50);
    const photos = [];
    for (const ph of photoRows) {
      if (ph.reviewStatus !== "approved") continue;
      const url = await ctx.storage.getUrl(ph.storageId);
      if (!url) continue;
      photos.push({
        photoId: ph._id,
        url,
        captionEs: ph.captionEs ?? null,
        captionEn: ph.captionEn ?? null,
      });
    }
    return {
      project: await toCard(ctx, p),
      needs: await publicNeeds(ctx, id),
      timeline: await publicTimeline(ctx, id),
      photos,
    };
  },
});

export const donorDeck = query({
  args: { category: v.optional(category), itemKey: v.optional(v.string()) },
  returns: v.array(
    v.object({
      needId: v.id("materialNeeds"),
      projectId: v.id("projects"),
      publicAlias: v.string(),
      category,
      itemKey: v.string(),
      nameEs: v.string(),
      nameEn: v.string(),
      unit: v.string(),
      ledger: ledgerValidator,
      summaryEs: v.string(),
      summaryEn: v.string(),
      titleEs: v.string(),
      titleEn: v.string(),
      region: v.union(v.string(), v.null()),
      urgency,
      verified: v.boolean(),
      photoUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    // Only published (not paused/completed) projects; only approved, pledgeable needs.
    const projects = await publicProjects(ctx, args.category, ["published"]);
    const rank = { high: 0, medium: 1, low: 2 } as const;
    projects.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    const cards = [];
    for (const p of projects) {
      const cover = await publicPhotoUrl(ctx, p.coverPhotoId);
      const needs = await ctx.db
        .query("materialNeeds")
        .withIndex("by_project", (q) => q.eq("projectId", p._id))
        .take(100);
      for (const n of needs) {
        if (n.status !== "approved") continue;
        if (args.itemKey && n.itemKey !== args.itemKey) continue;
        const ledger = await computeLedger(ctx, n._id);
        if (ledger.availableToPledge <= 0) continue;
        cards.push({
          needId: n._id,
          projectId: p._id,
          publicAlias: p.publicAlias,
          category: p.category,
          itemKey: n.itemKey,
          nameEs: n.nameEs,
          nameEn: n.nameEn,
          unit: n.unit,
          ledger,
          summaryEs: p.summaryEs,
          summaryEn: p.summaryEn,
          titleEs: p.titleEs,
          titleEn: p.titleEn,
          region: p.region ?? null,
          urgency: p.urgency,
          verified: n.verifiedBy !== undefined,
          ...(cover ? { photoUrl: cover } : {}),
        });
      }
    }
    return cards;
  },
});

export const followPledge = query({
  args: { followToken: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      pledgeId: v.id("pledges"),
      status: pledgeStatusValidator,
      qty: v.number(),
      receivedQty: v.number(),
      mode: pledgeModeValidator,
      donorName: v.string(), // the follower's own name only
      createdAt: v.number(),
      expiresAt: v.number(),
      need: v.object({
        needId: v.id("materialNeeds"),
        itemKey: v.string(),
        nameEs: v.string(),
        nameEn: v.string(),
        unit: v.string(),
        ledger: ledgerValidator,
      }),
      project: v.union(
        v.null(),
        v.object({
          projectId: v.id("projects"),
          publicAlias: v.string(),
          category,
          titleEs: v.string(),
          titleEn: v.string(),
          status: publicStatus,
          safetyPauseReasonPublic: v.union(v.string(), v.null()),
        }),
      ),
      timeline: v.array(publicMilestoneValidator),
    }),
  ),
  handler: async (ctx, args) => {
    if (!args.followToken) return null;
    const pledge = await ctx.db
      .query("pledges")
      .withIndex("by_follow_token", (q) => q.eq("followToken", args.followToken))
      .unique();
    if (!pledge) return null;
    const need = await ctx.db.get(pledge.needId);
    if (!need) return null;
    const p = await ctx.db.get(pledge.projectId);
    const isPub = !!p && isPublicStatus(p.status);
    const events = await ctx.db
      .query("materialEvents")
      .withIndex("by_need", (q) => q.eq("needId", need._id))
      .take(500);
    const receivedQty = events
      .filter((e) => e.pledgeId === pledge._id && e.eventType === "received")
      .reduce((s, e) => s + e.qty, 0);
    return {
      pledgeId: pledge._id,
      status: pledge.status,
      qty: pledge.qty,
      receivedQty,
      mode: pledge.mode,
      donorName: pledge.donorName,
      createdAt: pledge._creationTime,
      expiresAt: pledge.expiresAt,
      need: {
        needId: need._id,
        itemKey: need.itemKey,
        nameEs: need.nameEs,
        nameEn: need.nameEn,
        unit: need.unit,
        ledger: await computeLedger(ctx, need._id),
      },
      project:
        p && isPublicStatus(p.status)
          ? {
              projectId: p._id,
              publicAlias: p.publicAlias,
              category: p.category,
              titleEs: p.titleEs,
              titleEn: p.titleEn,
              status: p.status,
              safetyPauseReasonPublic: p.status === "paused" ? (p.safetyPauseReasonPublic ?? null) : null,
            }
          : null,
      timeline: isPub ? await publicTimeline(ctx, pledge.projectId) : [],
    };
  },
});
