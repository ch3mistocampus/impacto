import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { computeLedger } from "./lib/ledger";
import { audit } from "./lib/auth";
import { materialMilestoneText, pledgeModeValidator } from "./projects";

const DAY = 24 * 60 * 60 * 1000;
const PLEDGE_TTL = 14 * DAY;
const MAX_QTY = 100_000;

/**
 * Public (no-auth) pledge creation. Over-pledge check is transactional: the ledger is
 * recomputed inside this mutation, and Convex mutations are serializable.
 * Errors are ConvexError with data.code:
 *   INVALID_QTY | INVALID_DONOR | NEED_NOT_FOUND | NEED_NOT_OPEN | NEEDS_CONFIRMATION |
 *   PROJECT_NOT_PUBLISHED | OVERPLEDGE (data.available)
 */
export const create = mutation({
  args: {
    needId: v.id("materialNeeds"),
    qty: v.number(),
    mode: pledgeModeValidator,
    donorName: v.string(),
    donorContact: v.string(),
  },
  returns: v.object({ pledgeId: v.id("pledges"), followToken: v.string() }),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.qty) || args.qty < 1 || args.qty > MAX_QTY) {
      throw new ConvexError({ code: "INVALID_QTY" });
    }
    const donorName = args.donorName.trim();
    const donorContact = args.donorContact.trim();
    if (!donorName || donorName.length > 120 || !donorContact || donorContact.length > 200) {
      throw new ConvexError({ code: "INVALID_DONOR" });
    }
    const need = await ctx.db.get(args.needId);
    if (!need) throw new ConvexError({ code: "NEED_NOT_FOUND" });
    if (need.status !== "approved") throw new ConvexError({ code: "NEED_NOT_OPEN" });
    if (need.needsConfirmation || need.requestedQty === undefined) {
      throw new ConvexError({ code: "NEEDS_CONFIRMATION" });
    }
    const project = await ctx.db.get(need.projectId);
    if (!project || project.status !== "published") {
      throw new ConvexError({ code: "PROJECT_NOT_PUBLISHED" });
    }
    const ledger = await computeLedger(ctx, need._id);
    if (args.qty > ledger.availableToPledge) {
      throw new ConvexError({ code: "OVERPLEDGE", available: ledger.availableToPledge });
    }

    const now = Date.now();
    const followToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const pledgeId = await ctx.db.insert("pledges", {
      needId: need._id,
      projectId: project._id,
      donorName,
      donorContact,
      qty: args.qty,
      mode: args.mode,
      status: "active",
      followToken,
      expiresAt: now + PLEDGE_TTL,
    });
    // Public timeline entry: a pledge is a promise, explicitly NOT a delivery.
    const text = materialMilestoneText("pledge", args.qty, need);
    await ctx.db.insert("milestones", {
      projectId: project._id,
      type: "pledge",
      status: "verified",
      occurredAt: now,
      publicDescriptionEs: text.es,
      publicDescriptionEn: text.en,
    });
    await audit(ctx, undefined, "pledge", pledgeId, "create", `need=${need._id} qty=${args.qty} mode=${args.mode}`);
    return { pledgeId, followToken };
  },
});

async function release(
  ctx: MutationCtx,
  pledge: Doc<"pledges">,
  status: "canceled" | "expired",
) {
  await ctx.db.patch("pledges", pledge._id, { status });
  const need = await ctx.db.get(pledge.needId);
  if (need) {
    const text = materialMilestoneText(status === "canceled" ? "pledge_canceled" : "pledge_expired", pledge.qty, need);
    await ctx.db.insert("milestones", {
      projectId: pledge.projectId,
      type: "pledge",
      status: "verified",
      occurredAt: Date.now(),
      publicDescriptionEs: text.es,
      publicDescriptionEn: text.en,
    });
  }
  await audit(ctx, undefined, "pledge", pledge._id, status === "canceled" ? "cancel" : "expire", `qty=${pledge.qty}`);
}

/** Donor cancels their own active pledge via the follow token. Releases quantity. */
export const cancel = mutation({
  args: { followToken: v.string() },
  returns: v.object({ ok: v.boolean(), status: v.string() }),
  handler: async (ctx, args) => {
    const pledge = await ctx.db
      .query("pledges")
      .withIndex("by_follow_token", (q) => q.eq("followToken", args.followToken))
      .unique();
    if (!pledge) throw new ConvexError({ code: "NOT_FOUND" });
    if (pledge.status !== "active") return { ok: false, status: pledge.status };
    await release(ctx, pledge, "canceled");
    return { ok: true, status: "canceled" };
  },
});

/** Cron: expire active pledges past expiresAt. */
export const expireStale = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let n = 0;
    const needs = await ctx.db
      .query("materialNeeds")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(2000);
    for (const need of needs) {
      const active = await ctx.db
        .query("pledges")
        .withIndex("by_need_status", (q) => q.eq("needId", need._id).eq("status", "active"))
        .take(500);
      for (const p of active) {
        if (p.expiresAt < now) {
          await release(ctx, p, "expired");
          n++;
        }
      }
    }
    return n;
  },
});
