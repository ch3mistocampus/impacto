import { shownAt } from "./lib/shownAt";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { contributionStatus } from "./schema";
import { audit, requireRole } from "./lib/auth";
import { requireCoordinatorFor } from "./projects";

/**
 * Financials (coordinator only). Exposed as `coordinator.*` via re-export.
 * Always the original currency and exact amount; never FX-converted. Every change is audited.
 */

const tokenArg = { sessionToken: v.string() };

function cleanCurrency(c: string): string {
  const cur = c.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) throw new ConvexError({ code: "INVALID_CURRENCY" });
  return cur;
}
function checkAmount(a: number) {
  if (!Number.isFinite(a) || a <= 0 || a > 1e9) throw new ConvexError({ code: "INVALID_AMOUNT" });
}
function opt(s: string | undefined, max = 200): string | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  if (t.length > max) throw new ConvexError({ code: "INVALID_FIELD" });
  return t;
}

async function coordinatorScope(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
  projectId: Id<"projects"> | undefined,
) {
  if (projectId) return await requireCoordinatorFor(ctx, sessionToken, projectId);
  const user = await requireRole(ctx, sessionToken, ["coordinator"]);
  if (!user.nonprofitId) throw new ConvexError({ code: "FORBIDDEN" });
  return { user, project: null };
}

export const recordContribution = mutation({
  args: {
    ...tokenArg,
    projectId: v.optional(v.id("projects")),
    amount: v.number(),
    currency: v.string(),
    status: contributionStatus,
    donorName: v.optional(v.string()),
    externalReference: v.optional(v.string()),
  },
  returns: v.id("donations"),
  handler: async (ctx, args) => {
    const { user } = await coordinatorScope(ctx, args.sessionToken, args.projectId);
    checkAmount(args.amount);
    const currency = cleanCurrency(args.currency);
    if (args.status === "allocated" && !args.projectId) throw new ConvexError({ code: "ALLOCATION_NEEDS_PROJECT" });
    const id = await ctx.db.insert("donations", {
      projectId: args.projectId,
      nonprofitId: user.nonprofitId,
      amount: args.amount,
      currency,
      status: args.status,
      donorName: opt(args.donorName, 120),
      externalReference: opt(args.externalReference),
      recordedBy: user._id,
    });
    await audit(ctx, user._id, "contribution", id, "create", `${args.amount} ${currency} ${args.status} project=${args.projectId ?? "-"}`);
    return id;
  },
});

/** committed -> received -> allocated (allocated requires a project). */
export const updateContributionStatus = mutation({
  args: {
    ...tokenArg,
    donationId: v.id("donations"),
    status: contributionStatus,
    projectId: v.optional(v.id("projects")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.donationId);
    if (!d) throw new ConvexError({ code: "NOT_FOUND", entity: "contribution" });
    const projectId = args.projectId ?? d.projectId;
    const { user } = await coordinatorScope(ctx, args.sessionToken, projectId);
    if (d.projectId) await requireCoordinatorFor(ctx, args.sessionToken, d.projectId);
    else if (d.nonprofitId && d.nonprofitId !== user.nonprofitId) throw new ConvexError({ code: "FORBIDDEN" });
    if (args.status === "allocated" && !projectId) throw new ConvexError({ code: "ALLOCATION_NEEDS_PROJECT" });
    await ctx.db.patch("donations", d._id, { status: args.status, projectId });
    await audit(ctx, user._id, "contribution", d._id, "updateStatus", `${d.status}->${args.status} project=${d.projectId ?? "-"}->${projectId ?? "-"}`);
    return null;
  },
});

export const recordExpense = mutation({
  args: {
    ...tokenArg,
    projectId: v.id("projects"),
    amount: v.number(),
    currency: v.string(),
    category: v.string(),
    supplierRegion: v.optional(v.string()),
    localLabor: v.optional(v.boolean()),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("expenses"),
  handler: async (ctx, args) => {
    const { user } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    checkAmount(args.amount);
    const currency = cleanCurrency(args.currency);
    const category = opt(args.category, 80);
    if (!category) throw new ConvexError({ code: "INVALID_FIELD", field: "category" });
    const id = await ctx.db.insert("expenses", {
      projectId: args.projectId,
      amount: args.amount,
      currency,
      category,
      receiptStorageId: args.receiptStorageId,
      reviewStatus: "pending",
      recordedBy: user._id,
      supplierRegion: opt(args.supplierRegion, 80),
      localLabor: args.localLabor,
    });
    await audit(ctx, user._id, "expense", id, "create", `${args.amount} ${currency} ${category} receipt=${args.receiptStorageId ? "yes" : "no"}`);
    return id;
  },
});

export const approveExpense = mutation({
  args: { ...tokenArg, expenseId: v.id("expenses"), approve: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.expenseId);
    if (!e) throw new ConvexError({ code: "NOT_FOUND", entity: "expense" });
    const { user } = await requireCoordinatorFor(ctx, args.sessionToken, e.projectId);
    const now = Date.now();
    const wasApproved = e.reviewStatus === "approved";
    await ctx.db.patch("expenses", e._id, {
      reviewStatus: args.approve ? "approved" : "rejected",
      approvedBy: user._id,
      approvedAt: args.approve ? now : undefined,
    });
    if (args.approve && !wasApproved) {
      const amt = `${e.amount.toLocaleString("en-US")} ${e.currency}`;
      const receiptEs = e.receiptStorageId ? " (recibo registrado)" : "";
      const receiptEn = e.receiptStorageId ? " (receipt on file)" : "";
      await ctx.db.insert("milestones", {
        projectId: e.projectId,
        type: "expense",
        expenseId: e._id,
        status: "verified",
        verifiedBy: user._id,
        occurredAt: now,
        publicDescriptionEs: `Gasto aprobado: ${amt} — ${e.category}${receiptEs}`,
        publicDescriptionEn: `Expense approved: ${amt} — ${e.category}${receiptEn}`,
      });
    }
    await audit(ctx, user._id, "expense", e._id, args.approve ? "approve" : "reject", `${e.reviewStatus}->${args.approve ? "approved" : "rejected"}`);
    return null;
  },
});

const currencyRow = v.object({
  currency: v.string(),
  committed: v.number(),
  received: v.number(),
  allocated: v.number(),
  spent: v.number(),
  pendingExpenses: v.number(),
});

export const financials = query({
  args: { ...tokenArg, projectId: v.optional(v.id("projects")) },
  returns: v.object({
    byCurrency: v.array(currencyRow),
    /** Alias of byCurrency (coordinator UI). */
    totals: v.array(currencyRow),
    contributions: v.array(
      v.object({
        donationId: v.id("donations"),
        contributionId: v.id("donations"), // alias of donationId
        recordedByName: v.union(v.string(), v.null()),
        projectId: v.union(v.id("projects"), v.null()),
        publicAlias: v.union(v.string(), v.null()),
        amount: v.number(),
        currency: v.string(),
        status: contributionStatus,
        donorName: v.union(v.string(), v.null()),
        externalReference: v.union(v.string(), v.null()),
        createdAt: v.number(),
      }),
    ),
    expenses: v.array(
      v.object({
        expenseId: v.id("expenses"),
        projectId: v.id("projects"),
        publicAlias: v.union(v.string(), v.null()),
        amount: v.number(),
        currency: v.string(),
        category: v.string(),
        supplierRegion: v.union(v.string(), v.null()),
        localLabor: v.union(v.boolean(), v.null()),
        receiptUrl: v.union(v.string(), v.null()),
        reviewStatus: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
        approvedAt: v.union(v.number(), v.null()),
        approvedByName: v.union(v.string(), v.null()),
        recordedByName: v.union(v.string(), v.null()),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { user } = await coordinatorScope(ctx, args.sessionToken, args.projectId);
    let donations: Doc<"donations">[] = [];
    let expenses: Doc<"expenses">[] = [];
    if (args.projectId) {
      const pid = args.projectId;
      donations = await ctx.db.query("donations").withIndex("by_project", (q) => q.eq("projectId", pid)).take(1000);
      expenses = await ctx.db.query("expenses").withIndex("by_project", (q) => q.eq("projectId", pid)).take(1000);
    } else {
      const all = await ctx.db.query("donations").order("desc").take(2000);
      const projCache = new Map<Id<"projects">, Doc<"projects"> | null>();
      const proj = async (id: Id<"projects">) => {
        if (!projCache.has(id)) projCache.set(id, await ctx.db.get(id));
        return projCache.get(id) ?? null;
      };
      for (const d of all) {
        if (d.projectId) {
          if ((await proj(d.projectId))?.nonprofitId === user.nonprofitId) donations.push(d);
        } else if (d.nonprofitId === user.nonprofitId) donations.push(d);
      }
      for (const e of await ctx.db.query("expenses").order("desc").take(2000)) {
        if ((await proj(e.projectId))?.nonprofitId === user.nonprofitId) expenses.push(e);
      }
    }
    const map = new Map<string, { currency: string; committed: number; received: number; allocated: number; spent: number; pendingExpenses: number }>();
    const row = (c: string) => {
      let r = map.get(c);
      if (!r) map.set(c, (r = { currency: c, committed: 0, received: 0, allocated: 0, spent: 0, pendingExpenses: 0 }));
      return r;
    };
    for (const d of donations) {
      if (d.status === "committed") row(d.currency).committed += d.amount;
      else row(d.currency).received += d.amount;
      if (d.status === "allocated") row(d.currency).allocated += d.amount;
    }
    for (const e of expenses) {
      if (e.reviewStatus === "approved") row(e.currency).spent += e.amount;
      else if (e.reviewStatus === "pending") row(e.currency).pendingExpenses += e.amount;
    }
    const aliasCache = new Map<Id<"projects">, string | null>();
    const alias = async (id: Id<"projects"> | undefined) => {
      if (!id) return null;
      if (!aliasCache.has(id)) aliasCache.set(id, (await ctx.db.get(id))?.publicAlias ?? null);
      return aliasCache.get(id) ?? null;
    };
    const nameCache = new Map<Id<"users">, string | null>();
    const userName = async (id: Id<"users"> | undefined) => {
      if (!id) return null;
      if (!nameCache.has(id)) nameCache.set(id, (await ctx.db.get(id))?.name ?? null);
      return nameCache.get(id) ?? null;
    };
    const contributions = [];
    for (const d of donations) {
      contributions.push({
        donationId: d._id,
        contributionId: d._id,
        recordedByName: await userName(d.recordedBy),
        projectId: d.projectId ?? null,
        publicAlias: await alias(d.projectId),
        amount: d.amount,
        currency: d.currency,
        status: d.status,
        donorName: d.donorName ?? null,
        externalReference: d.externalReference ?? null,
        createdAt: shownAt(d),
      });
    }
    const expenseRows = [];
    for (const e of expenses) {
      expenseRows.push({
        expenseId: e._id,
        projectId: e.projectId,
        publicAlias: await alias(e.projectId),
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        supplierRegion: e.supplierRegion ?? null,
        localLabor: e.localLabor ?? null,
        receiptUrl: e.receiptStorageId ? await ctx.storage.getUrl(e.receiptStorageId) : null,
        reviewStatus: e.reviewStatus,
        approvedAt: e.approvedAt ?? null,
        approvedByName: await userName(e.approvedBy),
        recordedByName: await userName(e.recordedBy),
        createdAt: shownAt(e),
      });
    }
    contributions.sort((a, b) => b.createdAt - a.createdAt);
    expenseRows.sort((a, b) => b.createdAt - a.createdAt);
    const byCurrency = [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
    return {
      byCurrency,
      totals: byCurrency,
      contributions,
      expenses: expenseRows,
    };
  },
});
