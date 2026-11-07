import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { category } from "./schema";
import { computeLedger } from "./lib/ledger";
import {
  PUBLIC_STATUSES,
  financialRowValidator,
  isEvidencePublic,
  isPublicStatus,
  ledgerValidator,
  mergeFinancials,
  projectFinancials,
  publicEvidenceList,
  publicEvidenceValidator,
  pledgeModeValidator,
  pledgeStatusValidator,
  publicMilestoneValidator,
  publicPhotoUrl,
  publicTimeline,
} from "./projects";
import { sanitizeSnapshot, weeklySnapshotValidator } from "./weekly";

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
    pledgedTotal: v.number(),
    received: v.number(),
    delivered: v.number(),
    used: v.number(),
    verified: v.number(),
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
  const totals = { requested: 0, pledged: 0, pledgedTotal: 0, received: 0, delivered: 0, used: 0, verified: 0 };
  for (const n of needs) {
    totals.requested += n.ledger.requested ?? 0;
    totals.pledged += n.ledger.pledged;
    totals.pledgedTotal += n.ledger.pledgedTotal;
    totals.received += n.ledger.received;
    totals.delivered += n.ledger.delivered;
    totals.used += n.ledger.used;
    totals.verified += n.ledger.verified;
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
      /** Public impact: ONLY quantities with a `verified` event (Update 2). */
      itemsUsedVerified: v.number(),
      itemsDelivered: v.number(),
      itemsUsed: v.number(),
      itemsVerified: v.number(),
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
        itemsDelivered: 0,
        itemsUsed: 0,
        itemsVerified: 0,
        outcomesVerified: 0,
      };
      for (const p of projects) {
        for (const n of await publicNeeds(ctx, p._id)) {
          row.itemsRequested += n.ledger.requested ?? 0;
          row.itemsPledged += n.ledger.pledged;
          row.itemsReceived += n.ledger.received;
          row.itemsUsedVerified += n.ledger.verified;
          row.itemsDelivered += n.ledger.delivered;
          row.itemsUsed += n.ledger.used;
          row.itemsVerified += n.ledger.verified;
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
      /** Timestamp of the most recent record included (data "as of"). */
      asOf: v.number(),
      approvedAt: v.union(v.number(), v.null()),
      evidence: v.array(publicEvidenceValidator),
      financials: v.array(financialRowValidator),
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
    const timeline = await publicTimeline(ctx, id);
    return {
      project: await toCard(ctx, p),
      asOf: await projectAsOf(ctx, p),
      approvedAt: await approvedAtOf(ctx, p),
      evidence: await publicEvidenceList(ctx, id),
      financials: await projectFinancials(ctx, id),
      needs: await publicNeeds(ctx, id),
      timeline,
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

/** Exported for donor.myPledges (same per-pledge shape). */
export const followPledgeResult = v.object({
      pledgeId: v.id("pledges"),
      followToken: v.string(), // the caller's own token (echoed back)
      status: pledgeStatusValidator,
      qty: v.number(),
      receivedQty: v.number(),
      /** Per-pledge share of line-level stages (see followPledgeData for the attribution rule). */
      deliveredQty: v.number(),
      usedQty: v.number(),
      verifiedQty: v.number(),
      /** Timestamp of the most recent record for this pledge/need. */
      asOf: v.number(),
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
    });

export async function followPledgeData(ctx: QueryCtx, followToken: string) {
    if (!followToken) return null;
    const pledge = await ctx.db
      .query("pledges")
      .withIndex("by_follow_token", (q) => q.eq("followToken", followToken))
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
    // Attribution rule: delivered/used/verified events are recorded per material LINE (need), not
    // per pledge, because received materials are pooled. A pledge gets the line's stage quantity
    // proportional to its share of what the line has received:
    //   stageQty = round(line.stage * pledge.receivedQty / line.received)
    // capped at receivedQty and kept monotone (verified <= used <= delivered <= receivedQty).
    // A pledge with nothing received gets 0 for every later stage.
    const L = await computeLedger(ctx, need._id);
    const share = (x: number) => (L.received > 0 ? Math.round((x * receivedQty) / L.received) : 0);
    const deliveredQty = Math.min(receivedQty, share(L.delivered));
    const usedQty = Math.min(deliveredQty, share(L.used));
    const verifiedQty = Math.min(usedQty, share(L.verified));
    let asOf = pledge._creationTime;
    for (const e of events) asOf = Math.max(asOf, e._creationTime);
    return {
      pledgeId: pledge._id,
      followToken: pledge.followToken,
      status: pledge.status,
      qty: pledge.qty,
      receivedQty,
      deliveredQty,
      usedQty,
      verifiedQty,
      asOf,
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
        ledger: L,
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
}

export const followPledge = query({
  args: { followToken: v.string() },
  returns: v.union(v.null(), followPledgeResult),
  handler: async (ctx, args) => await followPledgeData(ctx, args.followToken),
});

/** Donor's own pledges (tokens stored client-side). Unknown tokens are skipped. Max 50. */
export const myPledges = query({
  args: { followTokens: v.array(v.string()) },
  returns: v.array(followPledgeResult),
  handler: async (ctx, args) => {
    const seen = new Set<string>();
    const out = [];
    for (const t of args.followTokens.slice(0, 50)) {
      if (!t || seen.has(t)) continue;
      seen.add(t);
      const r = await followPledgeData(ctx, t);
      if (r) out.push(r);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});

// ---------------------------------------------------------------------------
// Update 2: as-of, approval date, transparency dashboard, weekly reports
// ---------------------------------------------------------------------------

/** Most recent record timestamp for a project (no wall clock in queries). */
async function projectAsOf(ctx: QueryCtx, p: Doc<"projects">): Promise<number> {
  let t = Math.max(p._creationTime, p.publishedAt ?? 0, p.approvedAt ?? 0);
  const last = await ctx.db
    .query("milestones")
    .withIndex("by_project_time", (q) => q.eq("projectId", p._id))
    .order("desc")
    .first();
  if (last) t = Math.max(t, last.occurredAt);
  const lastEvent = await ctx.db
    .query("materialEvents")
    .withIndex("by_project", (q) => q.eq("projectId", p._id))
    .order("desc")
    .first();
  if (lastEvent) t = Math.max(t, lastEvent._creationTime);
  for (const e of await ctx.db.query("evidence").withIndex("by_project", (q) => q.eq("projectId", p._id)).take(200)) {
    if (isEvidencePublic(e)) t = Math.max(t, e.reviewedAt ?? e._creationTime);
  }
  const lastDonation = await ctx.db
    .query("donations")
    .withIndex("by_project", (q) => q.eq("projectId", p._id))
    .order("desc")
    .first();
  if (lastDonation) t = Math.max(t, lastDonation._creationTime);
  for (const e of await ctx.db.query("expenses").withIndex("by_project", (q) => q.eq("projectId", p._id)).take(500)) {
    if (e.approvedAt) t = Math.max(t, e.approvedAt);
  }
  return t;
}

async function approvedAtOf(ctx: QueryCtx, p: Doc<"projects">): Promise<number | null> {
  if (p.approvedAt) return p.approvedAt;
  const ms = await ctx.db
    .query("milestones")
    .withIndex("by_project_time", (q) => q.eq("projectId", p._id))
    .take(300);
  const approved = ms.find((m) => m.type === "approved" && m.status === "verified");
  return approved?.occurredAt ?? p.publishedAt ?? null;
}

const stageTotals = v.object({
  requested: v.number(),
  pledged: v.number(),
  pledgedTotal: v.number(),
  received: v.number(),
  delivered: v.number(),
  used: v.number(),
  verified: v.number(),
});

export const transparencyDashboard = query({
  args: {},
  returns: v.object({
    asOf: v.number(),
    categories: v.array(
      v.object({
        category,
        projects: v.array(projectCard),
        totals: stageTotals,
        financials: v.array(financialRowValidator),
      }),
    ),
    transparency: v.object({
      weeklyReportsPublished: v.number(),
      /** Approved receipt evidence + approved expenses with a receipt on file. */
      receiptsRecorded: v.number(),
      /** Approved handover_doc evidence. */
      handoversSigned: v.number(),
      /** Verified milestones of type "verified" (evidence-backed use) or "outcome". */
      milestonesVerified: v.number(),
      /** Material lines where delivered > verified (claims awaiting verification). */
      outstandingUnverified: v.number(),
    }),
  }),
  handler: async (ctx) => {
    let asOf = 0;
    const transparency = {
      weeklyReportsPublished: 0,
      receiptsRecorded: 0,
      handoversSigned: 0,
      milestonesVerified: 0,
      outstandingUnverified: 0,
    };
    const categories = [];
    const order: Record<string, number> = { published: 0, paused: 1, completed: 2 };
    for (const cat of CATEGORIES) {
      const projects = await publicProjects(ctx, cat);
      projects.sort((a, b) => order[a.status] - order[b.status] || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
      const cards = [];
      const totals = { requested: 0, pledged: 0, pledgedTotal: 0, received: 0, delivered: 0, used: 0, verified: 0 };
      const fins = [];
      for (const p of projects) {
        const card = await toCard(ctx, p);
        cards.push(card);
        totals.requested += card.totals.requested;
        totals.pledged += card.totals.pledged;
        totals.pledgedTotal += card.totals.pledgedTotal;
        totals.received += card.totals.received;
        totals.delivered += card.totals.delivered;
        totals.used += card.totals.used;
        totals.verified += card.totals.verified;
        fins.push(...(await projectFinancials(ctx, p._id)));
        asOf = Math.max(asOf, await projectAsOf(ctx, p));

        for (const n of await publicNeeds(ctx, p._id)) {
          if (n.ledger.delivered > n.ledger.verified) transparency.outstandingUnverified++;
        }
        for (const e of await ctx.db.query("evidence").withIndex("by_project", (q) => q.eq("projectId", p._id)).take(200)) {
          if (e.reviewStatus !== "approved") continue;
          if (e.type === "receipt") transparency.receiptsRecorded++;
          if (e.type === "handover_doc") transparency.handoversSigned++;
        }
        for (const e of await ctx.db.query("expenses").withIndex("by_project", (q) => q.eq("projectId", p._id)).take(500)) {
          if (e.reviewStatus === "approved" && e.receiptStorageId) transparency.receiptsRecorded++;
        }
        const ms = await ctx.db
          .query("milestones")
          .withIndex("by_project_time", (q) => q.eq("projectId", p._id))
          .take(300);
        transparency.milestonesVerified += ms.filter(
          (m) => m.status === "verified" && (m.type === "verified" || m.type === "outcome"),
        ).length;
      }
      categories.push({ category: cat, projects: cards, totals, financials: mergeFinancials(fins) });
    }
    const reports = await ctx.db
      .query("weeklyReports")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(500);
    transparency.weeklyReportsPublished = reports.length;
    for (const r of reports) asOf = Math.max(asOf, r.publishedAt ?? 0);
    return { asOf, categories, transparency };
  },
});

export const listWeeklyReports = query({
  args: {},
  returns: v.array(
    v.object({
      reportId: v.id("weeklyReports"),
      periodStart: v.number(),
      periodEnd: v.number(),
      publishedAt: v.number(),
      summaryEs: v.string(),
      summaryEn: v.string(),
      snapshot: weeklySnapshotValidator,
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("weeklyReports")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .take(100);
    const out = rows.map((r) => ({
      reportId: r._id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      publishedAt: r.publishedAt ?? r._creationTime,
      summaryEs: r.summaryEs,
      summaryEn: r.summaryEn,
      snapshot: sanitizeSnapshot(r.snapshot),
      isDemo: r.isDemo ?? false,
    }));
    out.sort((a, b) => b.periodEnd - a.periodEnd);
    return out;
  },
});
