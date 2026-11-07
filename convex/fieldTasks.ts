import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { audit, requireRole } from "./lib/auth";
import { computeLedger } from "./lib/ledger";
import { shownAt } from "./lib/shownAt";
import { materialMilestoneText } from "./projects";

/**
 * Field to-dos (role: field_worker, own projects only).
 *
 * Derived — never stored — from the ledger, so they disappear as soon as the work is recorded:
 *   receive  — an active pledge on a published need: "confirm the materials arrived" (+ photo)
 *   deliver  — stock received by the team but not yet delivered to the project site (+ photo)
 *   receipt  — a recorded expense with no receipt on file (+ photo of the receipt)
 *
 * Completing one records the custody event right away (the field team is nonprofit staff), but the
 * photo is private evidence and the timeline milestone stays "pending" until a coordinator approves
 * the photo (evidence.reviewEvidence flips linked milestones to "verified").
 */

const FIELD = ["field_worker"] as const;
const OPEN_STATUSES = new Set<Doc<"projects">["status"]>(["published"]);

export const todoKind = v.union(v.literal("receive"), v.literal("deliver"), v.literal("receipt"));

export type FieldTodo = {
  id: string;
  kind: "receive" | "deliver" | "receipt";
  projectId: Id<"projects">;
  needId: Id<"materialNeeds"> | null;
  pledgeId: Id<"pledges"> | null;
  expenseId: Id<"expenses"> | null;
  itemKey: string | null;
  nameEs: string;
  nameEn: string;
  unit: string;
  /** Suggested (and maximum) quantity to confirm. 0 for receipts. */
  qty: number;
  pledgeMode: Doc<"pledges">["mode"] | null;
  amount: number | null;
  currency: string | null;
  since: number;
};

async function receivedForPledge(ctx: QueryCtx, needId: Id<"materialNeeds">, pledgeId: Id<"pledges">) {
  const events = await ctx.db
    .query("materialEvents")
    .withIndex("by_need", (q) => q.eq("needId", needId))
    .take(2000);
  return events.filter((e) => e.pledgeId === pledgeId && e.eventType === "received").reduce((s, e) => s + e.qty, 0);
}

export async function computeTodos(ctx: QueryCtx, project: Doc<"projects">): Promise<FieldTodo[]> {
  if (!OPEN_STATUSES.has(project.status)) return [];
  const out: FieldTodo[] = [];
  const needs = await ctx.db
    .query("materialNeeds")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .take(100);
  for (const n of needs) {
    if (n.status !== "approved" && n.status !== "fulfilled") continue;
    const base = {
      projectId: project._id,
      needId: n._id,
      itemKey: n.itemKey,
      nameEs: n.nameEs,
      nameEn: n.nameEn,
      unit: n.unit,
      expenseId: null,
      amount: null,
      currency: null,
    };
    const active = await ctx.db
      .query("pledges")
      .withIndex("by_need_status", (q) => q.eq("needId", n._id).eq("status", "active"))
      .take(100);
    for (const p of active) {
      const remaining = p.qty - (await receivedForPledge(ctx, n._id, p._id));
      if (remaining <= 0) continue;
      out.push({ ...base, id: `receive:${p._id}`, kind: "receive", pledgeId: p._id, qty: remaining, pledgeMode: p.mode, since: shownAt(p) });
    }
    const l = await computeLedger(ctx, n._id);
    const inStock = l.received - l.delivered;
    if (inStock > 0) {
      const lastReceipt = await ctx.db
        .query("milestones")
        .withIndex("by_project_time", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(300);
      const since = lastReceipt.find((m) => m.type === "received")?.occurredAt ?? shownAt(project);
      out.push({ ...base, id: `deliver:${n._id}`, kind: "deliver", pledgeId: null, qty: inStock, pledgeMode: null, since });
    }
  }
  const expenses = await ctx.db
    .query("expenses")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .take(200);
  for (const e of expenses) {
    if (e.receiptStorageId || e.reviewStatus === "rejected") continue;
    out.push({
      id: `receipt:${e._id}`,
      kind: "receipt",
      projectId: project._id,
      needId: null,
      pledgeId: null,
      expenseId: e._id,
      itemKey: null,
      nameEs: e.category,
      nameEn: e.category,
      unit: "",
      qty: 0,
      pledgeMode: null,
      amount: e.amount,
      currency: e.currency,
      since: e.approvedAt ?? e._creationTime,
    });
  }
  const order = { receive: 0, deliver: 1, receipt: 2 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.since - b.since);
}

/** All open to-dos across the worker's own projects (field home). */
export const myTodos = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
      .order("desc")
      .take(50);
    const out: (FieldTodo & { projectTitleEs: string; projectTitleEn: string; publicAlias: string })[] = [];
    for (const p of projects) {
      for (const t of await computeTodos(ctx, p)) {
        out.push({ ...t, projectTitleEs: p.titleEs, projectTitleEn: p.titleEn, publicAlias: p.publicAlias });
      }
    }
    return out;
  },
});

const clean = (s: string | undefined, max = 1000) => {
  const t = s?.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Complete a to-do with a photo (required). Returns the new evidence id (pending review). */
export const completeTodo = mutation({
  args: {
    sessionToken: v.string(),
    projectId: v.id("projects"),
    kind: todoKind,
    needId: v.optional(v.id("materialNeeds")),
    pledgeId: v.optional(v.id("pledges")),
    expenseId: v.optional(v.id("expenses")),
    qty: v.optional(v.number()),
    photoStorageId: v.id("_storage"),
    noteEs: v.optional(v.string()),
    noteEn: v.optional(v.string()),
  },
  returns: v.object({ evidenceId: v.id("evidence") }),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.createdBy !== user._id) throw new ConvexError({ code: "NOT_FOUND" });
    if (!OPEN_STATUSES.has(project.status)) throw new ConvexError({ code: "INVALID_STATUS", status: project.status });
    const noteEs = clean(args.noteEs);
    const noteEn = clean(args.noteEn);
    const now = Date.now();

    if (args.kind === "receipt") {
      if (!args.expenseId) throw new ConvexError({ code: "INVALID_EXPENSE" });
      const expense = await ctx.db.get(args.expenseId);
      if (!expense || expense.projectId !== project._id) throw new ConvexError({ code: "INVALID_EXPENSE" });
      if (expense.receiptStorageId) throw new ConvexError({ code: "ALREADY_DONE" });
      const amt = `${expense.amount.toLocaleString("en-US")} ${expense.currency}`;
      const evidenceId = await ctx.db.insert("evidence", {
        projectId: project._id,
        expenseId: expense._id,
        type: "receipt",
        privateStorageId: args.photoStorageId,
        noteEs: noteEs ?? `Recibo del gasto: ${amt} — ${expense.category}`,
        noteEn: noteEn ?? `Receipt for expense: ${amt} — ${expense.category}`,
        reviewStatus: "pending",
        publicApproved: false,
        uploadedBy: user._id,
      });
      await ctx.db.patch("expenses", expense._id, { receiptStorageId: args.photoStorageId });
      // Attach to the expense's timeline entry (if approved already) so the proof shows there.
      const ms = await ctx.db
        .query("milestones")
        .withIndex("by_project_time", (q) => q.eq("projectId", project._id))
        .take(300);
      const m = ms.find((x) => x.type === "expense" && x.expenseId === expense._id && !x.evidenceId);
      if (m) await ctx.db.patch("milestones", m._id, { evidenceId });
      await audit(ctx, user._id, "evidence", evidenceId, "field.uploadReceipt", `expense=${expense._id}`);
      return { evidenceId };
    }

    if (!args.needId) throw new ConvexError({ code: "INVALID_NEED" });
    const need = await ctx.db.get(args.needId);
    if (!need || need.projectId !== project._id) throw new ConvexError({ code: "INVALID_NEED" });
    if (need.status !== "approved" && need.status !== "fulfilled") throw new ConvexError({ code: "NEED_NOT_OPEN" });
    const qty = args.qty ?? 0;
    if (!Number.isInteger(qty) || qty < 1) throw new ConvexError({ code: "INVALID_QTY" });
    const before = await computeLedger(ctx, need._id);

    let pledge: Doc<"pledges"> | null = null;
    let pledgeReceived = 0;
    if (args.kind === "receive") {
      if (!args.pledgeId) throw new ConvexError({ code: "INVALID_PLEDGE" });
      pledge = await ctx.db.get(args.pledgeId);
      if (!pledge || pledge.needId !== need._id) throw new ConvexError({ code: "INVALID_PLEDGE" });
      if (pledge.status !== "active") throw new ConvexError({ code: "PLEDGE_NOT_ACTIVE", status: pledge.status });
      pledgeReceived = await receivedForPledge(ctx, need._id, pledge._id);
      if (pledgeReceived + qty > pledge.qty) throw new ConvexError({ code: "EXCEEDS_PLEDGE", available: pledge.qty - pledgeReceived });
    } else if (before.delivered + qty > before.received) {
      throw new ConvexError({ code: "DELIVERED_EXCEEDS_RECEIVED", available: Math.max(0, before.received - before.delivered) });
    }

    const eventType = args.kind === "receive" ? ("received" as const) : ("delivered" as const);
    const text = materialMilestoneText(eventType, qty, need);
    const evidenceId = await ctx.db.insert("evidence", {
      projectId: project._id,
      needId: need._id,
      type: "delivery_photo",
      privateStorageId: args.photoStorageId,
      noteEs: noteEs ? `${text.es} — ${noteEs}` : `Foto del equipo de campo: ${text.es.charAt(0).toLowerCase()}${text.es.slice(1)}`,
      noteEn: noteEn ? `${text.en} — ${noteEn}` : `Field team photo: ${text.en.charAt(0).toLowerCase()}${text.en.slice(1)}`,
      reviewStatus: "pending",
      publicApproved: false,
      uploadedBy: user._id,
    });
    const eventId = await ctx.db.insert("materialEvents", {
      needId: need._id,
      projectId: project._id,
      pledgeId: pledge?._id,
      eventType,
      qty,
      evidenceId,
      noteEs,
      noteEn,
      verifiedBy: user._id,
    });
    await ctx.db.patch("evidence", evidenceId, { materialEventId: eventId });
    if (pledge && pledgeReceived + qty >= pledge.qty) {
      await ctx.db.patch("pledges", pledge._id, { status: "fulfilled" });
      await audit(ctx, user._id, "pledge", pledge._id, "fulfilled", `qty=${pledge.qty} by=field`);
    }
    // Pending until the nonprofit reviews the photo; public timeline shows verified only.
    await ctx.db.insert("milestones", {
      projectId: project._id,
      type: eventType,
      status: "pending",
      occurredAt: now,
      publicDescriptionEs: text.es,
      publicDescriptionEn: text.en,
      evidenceId,
    });
    await audit(ctx, user._id, "materialEvent", eventId, `field.${eventType}`, `need=${need._id} qty=${qty} pledge=${pledge?._id ?? "-"}`);
    return { evidenceId };
  },
});

export const generateUploadUrl = mutation({
  args: { sessionToken: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, [...FIELD]);
    return await ctx.storage.generateUploadUrl();
  },
});
