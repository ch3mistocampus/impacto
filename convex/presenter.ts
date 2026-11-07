import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { category, projectStatus, role } from "./schema";
import { computeLedger } from "./lib/ledger";
import { ledgerValidator } from "./projects";

/**
 * PRESENTER (read-only, no auth) — feeds the /demo console for the 3-minute judging run.
 *
 * Privacy contract: returns ONLY the live demo project's non-identifying fields (alias, status,
 * category, need names/quantities) plus aggregate ledger numbers and recent event metadata
 * (type, quantity, time, actor ROLE). Never projectPrivate, donor names/contacts, user names,
 * notes, evidence, photos or any free text written by people. Only `isDemo` projects qualify.
 */

/** Alias of the seeded live-demo project (convex/seedData.ts, key "live_demo"). */
export const LIVE_DEMO_ALIAS = "Reconstrucción 021";

const needStatus = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("fulfilled"),
  v.literal("rejected"),
);

const presenterEvent = v.object({
  kind: v.union(
    v.literal("pledge"),
    v.literal("received"),
    v.literal("delivered"),
    v.literal("used"),
    v.literal("verified"),
    v.literal("returned"),
  ),
  /** For pledges: active | fulfilled | canceled | expired. Null for material events. */
  pledgeStatus: v.union(
    v.literal("active"),
    v.literal("fulfilled"),
    v.literal("canceled"),
    v.literal("expired"),
    v.null(),
  ),
  qty: v.number(),
  at: v.number(),
  /** Role of who recorded it (never a name). Pledges are always "donor". */
  actorRole: v.union(role, v.null()),
});

const presenterNeed = v.object({
  needId: v.id("materialNeeds"),
  itemKey: v.string(),
  nameEs: v.string(),
  nameEn: v.string(),
  unit: v.string(),
  status: needStatus,
  needsConfirmation: v.boolean(),
  aiSuggested: v.boolean(),
  ledger: ledgerValidator,
  activePledgeCount: v.number(),
  latestEvents: v.array(presenterEvent),
});

const MAX_EVENTS = 6;

async function findLiveProject(ctx: QueryCtx): Promise<Doc<"projects"> | null> {
  let best: Doc<"projects"> | null = null;
  const statuses: Doc<"projects">["status"][] = ["in_review", "published", "paused", "completed", "draft"];
  for (const s of statuses) {
    const rows = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", s))
      .take(300);
    for (const p of rows) {
      if (!p.isDemo || p.publicAlias !== LIVE_DEMO_ALIAS) continue;
      if (!best || p._creationTime > best._creationTime) best = p;
    }
  }
  return best;
}

async function needEvents(ctx: QueryCtx, needId: Id<"materialNeeds">) {
  const roleCache = new Map<Id<"users">, Doc<"users">["role"] | null>();
  const roleOf = async (id: Id<"users">) => {
    if (!roleCache.has(id)) roleCache.set(id, (await ctx.db.get(id))?.role ?? null);
    return roleCache.get(id) ?? null;
  };

  const events = await ctx.db
    .query("materialEvents")
    .withIndex("by_need", (q) => q.eq("needId", needId))
    .order("desc")
    .take(MAX_EVENTS);
  const out: {
    kind: "pledge" | Doc<"materialEvents">["eventType"];
    pledgeStatus: Doc<"pledges">["status"] | null;
    qty: number;
    at: number;
    actorRole: Doc<"users">["role"] | null;
  }[] = [];
  for (const e of events) {
    out.push({ kind: e.eventType, pledgeStatus: null, qty: e.qty, at: e._creationTime, actorRole: await roleOf(e.verifiedBy) });
  }

  let activePledgeCount = 0;
  for (const status of ["active", "fulfilled", "canceled", "expired"] as const) {
    const pledges = await ctx.db
      .query("pledges")
      .withIndex("by_need_status", (q) => q.eq("needId", needId).eq("status", status))
      .order("desc")
      .take(MAX_EVENTS);
    if (status === "active") activePledgeCount = pledges.length;
    for (const p of pledges) {
      out.push({ kind: "pledge", pledgeStatus: p.status, qty: p.qty, at: p._creationTime, actorRole: "donor" });
    }
  }
  out.sort((a, b) => b.at - a.at);
  return { latestEvents: out.slice(0, MAX_EVENTS), activePledgeCount };
}

/**
 * The live demo project ("Reconstrucción 021") with every need's six-stage ledger and its most
 * recent pledge/material events. `null` if it has not been seeded. Ids change on every reset,
 * so the console looks the project up here instead of hard-coding them.
 */
export const liveDemo = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      projectId: v.id("projects"),
      publicAlias: v.string(),
      category,
      status: projectStatus,
      region: v.union(v.string(), v.null()),
      publishedAt: v.union(v.number(), v.null()),
      bricksNeedId: v.union(v.id("materialNeeds"), v.null()),
      needs: v.array(presenterNeed),
    }),
  ),
  handler: async (ctx) => {
    const p = await findLiveProject(ctx);
    if (!p) return null;
    const rows = await ctx.db
      .query("materialNeeds")
      .withIndex("by_project", (q) => q.eq("projectId", p._id))
      .take(50);
    const needs = [];
    for (const n of rows) {
      const { latestEvents, activePledgeCount } = await needEvents(ctx, n._id);
      needs.push({
        needId: n._id,
        itemKey: n.itemKey,
        nameEs: n.nameEs,
        nameEn: n.nameEn,
        unit: n.unit,
        status: n.status,
        needsConfirmation: n.needsConfirmation,
        aiSuggested: n.aiSuggested,
        ledger: await computeLedger(ctx, n._id),
        activePledgeCount,
        latestEvents,
      });
    }
    const bricks = needs.find((n) => n.itemKey === "bricks");
    return {
      projectId: p._id,
      publicAlias: p.publicAlias,
      category: p.category,
      status: p.status,
      region: p.region ?? null,
      publishedAt: p.publishedAt ?? null,
      bricksNeedId: bricks?.needId ?? null,
      needs,
    };
  },
});
