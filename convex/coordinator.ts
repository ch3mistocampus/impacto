import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { category, urgency, projectStatus, materialEventType } from "./schema";
import { audit, requireRole } from "./lib/auth";
import { computeLedger } from "./lib/ledger";
import {
  findPrivateLeak,
  ledgerValidator,
  materialMilestoneText,
  milestoneTypeValidator,
  pledgeModeValidator,
  pledgeStatusValidator,
  requireCoordinatorFor,
} from "./projects";

/**
 * Coordinator API. Every function: requireRole(coordinator) + same nonprofit (canSeePrivate).
 * Errors are ConvexError with data.code.
 */

const tokenArg = { sessionToken: v.string() };

const inboxItem = v.object({
  projectId: v.id("projects"),
  publicAlias: v.string(),
  category,
  titleEs: v.string(),
  titleEn: v.string(),
  urgency,
  status: projectStatus,
  region: v.union(v.string(), v.null()),
  createdAt: v.number(),
  publishedAt: v.union(v.number(), v.null()),
  safetyPauseReasonPublic: v.union(v.string(), v.null()),
  needsCount: v.number(),
  needsDraftCount: v.number(),
  needsConfirmationCount: v.number(),
  activePledgesCount: v.number(),
  isDemo: v.boolean(),
});

async function inboxRow(ctx: QueryCtx, p: Doc<"projects">) {
  const needs = await ctx.db
    .query("materialNeeds")
    .withIndex("by_project", (q) => q.eq("projectId", p._id))
    .take(100);
  const pledges = await ctx.db
    .query("pledges")
    .withIndex("by_project", (q) => q.eq("projectId", p._id))
    .take(500);
  return {
    projectId: p._id,
    publicAlias: p.publicAlias,
    category: p.category,
    titleEs: p.titleEs,
    titleEn: p.titleEn,
    urgency: p.urgency,
    status: p.status,
    region: p.region ?? null,
    createdAt: p._creationTime,
    publishedAt: p.publishedAt ?? null,
    safetyPauseReasonPublic: p.safetyPauseReasonPublic ?? null,
    needsCount: needs.length,
    needsDraftCount: needs.filter((n) => n.status === "draft").length,
    needsConfirmationCount: needs.filter((n) => n.needsConfirmation && n.status !== "rejected").length,
    activePledgesCount: pledges.filter((x) => x.status === "active").length,
    isDemo: p.isDemo,
  };
}

async function projectsByStatus(ctx: QueryCtx, nonprofitId: Id<"nonprofits"> | undefined, status: Doc<"projects">["status"]) {
  const rows = await ctx.db
    .query("projects")
    .withIndex("by_status", (q) => q.eq("status", status))
    .order("desc")
    .take(200);
  return rows.filter((p) => p.nonprofitId === nonprofitId);
}

export const inbox = query({
  args: tokenArg,
  returns: v.object({
    inReview: v.array(inboxItem),
    active: v.array(inboxItem), // published + paused (for delivery verification)
    completed: v.array(inboxItem),
    counts: v.object({
      inReview: v.number(),
      published: v.number(),
      paused: v.number(),
      completed: v.number(),
      activePledges: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["coordinator"]);
    if (!user.nonprofitId) throw new ConvexError({ code: "FORBIDDEN" });
    const inReview = [];
    for (const p of await projectsByStatus(ctx, user.nonprofitId, "in_review")) inReview.push(await inboxRow(ctx, p));
    const published = [];
    for (const p of await projectsByStatus(ctx, user.nonprofitId, "published")) published.push(await inboxRow(ctx, p));
    const paused = [];
    for (const p of await projectsByStatus(ctx, user.nonprofitId, "paused")) paused.push(await inboxRow(ctx, p));
    const completed = [];
    for (const p of await projectsByStatus(ctx, user.nonprofitId, "completed")) completed.push(await inboxRow(ctx, p));
    const active = [...published, ...paused];
    return {
      inReview,
      active,
      completed,
      counts: {
        inReview: inReview.length,
        published: published.length,
        paused: paused.length,
        completed: completed.length,
        activePledges: active.reduce((s, r) => s + r.activePledgesCount, 0),
      },
    };
  },
});

const needEventLog = v.object({
  eventId: v.id("materialEvents"),
  eventType: materialEventType,
  qty: v.number(),
  createdAt: v.number(),
  actorName: v.union(v.string(), v.null()),
  noteEs: v.union(v.string(), v.null()),
  noteEn: v.union(v.string(), v.null()),
  evidenceId: v.union(v.id("evidence"), v.null()),
  pledgeId: v.union(v.id("pledges"), v.null()),
});

const reviewNeed = v.object({
  needId: v.id("materialNeeds"),
  itemKey: v.string(),
  nameEs: v.string(),
  nameEn: v.string(),
  unit: v.string(),
  requestedQty: v.union(v.number(), v.null()),
  needsConfirmation: v.boolean(),
  aiSuggested: v.boolean(),
  status: v.union(v.literal("draft"), v.literal("approved"), v.literal("fulfilled"), v.literal("rejected")),
  verified: v.boolean(),
  ledger: ledgerValidator,
  /** Material event log for this need, newest first. */
  events: v.array(needEventLog),
});

const reviewPledge = v.object({
  pledgeId: v.id("pledges"),
  needId: v.id("materialNeeds"),
  projectId: v.id("projects"),
  publicAlias: v.string(),
  needNameEs: v.string(),
  needNameEn: v.string(),
  itemKey: v.string(),
  unit: v.string(),
  donorName: v.string(),
  donorContact: v.string(),
  qty: v.number(),
  receivedQty: v.number(),
  mode: pledgeModeValidator,
  status: pledgeStatusValidator,
  createdAt: v.number(),
  expiresAt: v.number(),
});

async function pledgeRows(ctx: QueryCtx, project: Doc<"projects">) {
  const pledges = await ctx.db
    .query("pledges")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .order("desc")
    .take(500);
  const events = await ctx.db
    .query("materialEvents")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .take(2000);
  const needCache = new Map<Id<"materialNeeds">, Doc<"materialNeeds"> | null>();
  const out = [];
  for (const pl of pledges) {
    if (!needCache.has(pl.needId)) needCache.set(pl.needId, await ctx.db.get(pl.needId));
    const need = needCache.get(pl.needId);
    if (!need) continue;
    out.push({
      pledgeId: pl._id,
      needId: pl.needId,
      projectId: pl.projectId,
      publicAlias: project.publicAlias,
      needNameEs: need.nameEs,
      needNameEn: need.nameEn,
      itemKey: need.itemKey,
      unit: need.unit,
      donorName: pl.donorName,
      donorContact: pl.donorContact,
      qty: pl.qty,
      receivedQty: events
        .filter((e) => e.pledgeId === pl._id && e.eventType === "received")
        .reduce((s, e) => s + e.qty, 0),
      mode: pl.mode,
      status: pl.status,
      createdAt: pl._creationTime,
      expiresAt: pl.expiresAt,
    });
  }
  return out;
}

export const getProjectForReview = query({
  args: { ...tokenArg, projectId: v.id("projects") },
  returns: v.object({
    project: v.object({
      projectId: v.id("projects"),
      publicAlias: v.string(),
      category,
      titleEs: v.string(),
      titleEn: v.string(),
      summaryEs: v.string(),
      summaryEn: v.string(),
      urgency,
      status: projectStatus,
      region: v.union(v.string(), v.null()),
      createdAt: v.number(),
      createdByName: v.union(v.string(), v.null()),
      publishedAt: v.union(v.number(), v.null()),
      safetyPauseReasonPublic: v.union(v.string(), v.null()),
      coverPhotoId: v.union(v.id("photos"), v.null()),
      isDemo: v.boolean(),
      approvedAt: v.union(v.number(), v.null()),
    }),
    private: v.union(
      v.null(),
      v.object({
        beneficiaryName: v.union(v.string(), v.null()),
        privateAddress: v.union(v.string(), v.null()),
        contact: v.union(v.string(), v.null()),
        privateNotes: v.union(v.string(), v.null()),
      }),
    ),
    fieldReports: v.array(
      v.object({
        reportId: v.id("fieldReports"),
        createdAt: v.number(),
        transcriptOriginal: v.string(),
        language: v.union(v.literal("es"), v.literal("en")),
        transcriptTranslated: v.union(v.string(), v.null()),
        audioUrl: v.union(v.string(), v.null()),
        draftExtraction: v.any(),
        aiStatus: v.union(v.literal("none"), v.literal("pending"), v.literal("done"), v.literal("error")),
        missingQuestions: v.array(v.string()),
        reviewStatus: v.union(
          v.literal("draft"),
          v.literal("submitted"),
          v.literal("approved"),
          v.literal("changes_requested"),
        ),
      }),
    ),
    needs: v.array(reviewNeed),
    photos: v.array(
      v.object({
        photoId: v.id("photos"),
        url: v.union(v.string(), v.null()),
        visibility: v.union(v.literal("private"), v.literal("publicApproved")),
        reviewStatus: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
        captionEs: v.union(v.string(), v.null()),
        captionEn: v.union(v.string(), v.null()),
      }),
    ),
    pledges: v.array(reviewPledge),
    milestones: v.array(
      v.object({
        milestoneId: v.id("milestones"),
        type: milestoneTypeValidator,
        status: v.union(v.literal("pending"), v.literal("verified")),
        occurredAt: v.number(),
        descriptionEs: v.string(),
        descriptionEn: v.string(),
        photoId: v.union(v.id("photos"), v.null()),
        evidenceId: v.union(v.id("evidence"), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { project: p } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    const priv = await ctx.db
      .query("projectPrivate")
      .withIndex("by_project", (q) => q.eq("projectId", p._id))
      .first();
    const creator = await ctx.db.get(p.createdBy);
    const reports = await ctx.db
      .query("fieldReports")
      .withIndex("by_project", (q) => q.eq("projectId", p._id))
      .take(50);
    const fieldReports = [];
    for (const r of reports) {
      fieldReports.push({
        reportId: r._id,
        createdAt: r._creationTime,
        transcriptOriginal: r.transcriptOriginal,
        language: r.language,
        transcriptTranslated: r.transcriptTranslated ?? null,
        audioUrl: r.audioStorageId ? await ctx.storage.getUrl(r.audioStorageId) : null,
        draftExtraction: r.draftExtraction ?? null,
        aiStatus: r.aiStatus,
        missingQuestions: r.missingQuestions ?? [],
        reviewStatus: r.reviewStatus,
      });
    }
    const needRows = await ctx.db
      .query("materialNeeds")
      .withIndex("by_project", (q) => q.eq("projectId", p._id))
      .take(100);
    const allEvents = await ctx.db
      .query("materialEvents")
      .withIndex("by_project", (q) => q.eq("projectId", p._id))
      .order("desc")
      .take(2000);
    const actorNames = new Map<Id<"users">, string | null>();
    const eventsByNeed = new Map<Id<"materialNeeds">, (typeof needEventLog.type)[]>();
    for (const e of allEvents) {
      if (!actorNames.has(e.verifiedBy)) actorNames.set(e.verifiedBy, (await ctx.db.get(e.verifiedBy))?.name ?? null);
      const list = eventsByNeed.get(e.needId) ?? [];
      list.push({
        eventId: e._id,
        eventType: e.eventType,
        qty: e.qty,
        createdAt: e._creationTime,
        actorName: actorNames.get(e.verifiedBy) ?? null,
        noteEs: e.noteEs ?? null,
        noteEn: e.noteEn ?? null,
        evidenceId: e.evidenceId ?? null,
        pledgeId: e.pledgeId ?? null,
      });
      eventsByNeed.set(e.needId, list);
    }
    const needs = [];
    for (const n of needRows) {
      needs.push({
        needId: n._id,
        itemKey: n.itemKey,
        nameEs: n.nameEs,
        nameEn: n.nameEn,
        unit: n.unit,
        requestedQty: n.requestedQty ?? null,
        needsConfirmation: n.needsConfirmation,
        aiSuggested: n.aiSuggested,
        status: n.status,
        verified: n.verifiedBy !== undefined,
        ledger: await computeLedger(ctx, n._id),
        events: eventsByNeed.get(n._id) ?? [],
      });
    }
    const photoRows = await ctx.db
      .query("photos")
      .withIndex("by_project", (q) => q.eq("projectId", p._id))
      .take(100);
    const photos = [];
    for (const ph of photoRows) {
      photos.push({
        photoId: ph._id,
        url: await ctx.storage.getUrl(ph.storageId),
        visibility: ph.visibility,
        reviewStatus: ph.reviewStatus,
        captionEs: ph.captionEs ?? null,
        captionEn: ph.captionEn ?? null,
      });
    }
    const ms = await ctx.db
      .query("milestones")
      .withIndex("by_project_time", (q) => q.eq("projectId", p._id))
      .take(300);
    return {
      project: {
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
        createdAt: p._creationTime,
        createdByName: creator?.name ?? null,
        publishedAt: p.publishedAt ?? null,
        safetyPauseReasonPublic: p.safetyPauseReasonPublic ?? null,
        coverPhotoId: p.coverPhotoId ?? null,
        isDemo: p.isDemo,
        approvedAt: p.approvedAt ?? (p.approvedBy ? (p.publishedAt ?? null) : null),
      },
      private: priv
        ? {
            beneficiaryName: priv.beneficiaryName ?? null,
            privateAddress: priv.privateAddress ?? null,
            contact: priv.contact ?? null,
            privateNotes: priv.privateNotes ?? null,
          }
        : null,
      fieldReports,
      needs,
      photos,
      pledges: await pledgeRows(ctx, p),
      milestones: ms.map((m) => ({
        milestoneId: m._id,
        type: m.type,
        status: m.status,
        occurredAt: m.occurredAt,
        descriptionEs: m.publicDescriptionEs,
        descriptionEn: m.publicDescriptionEn,
        photoId: m.photoId ?? null,
        evidenceId: m.evidenceId ?? null,
      })),
    };
  },
});

export const updateNeed = mutation({
  args: {
    ...tokenArg,
    needId: v.id("materialNeeds"),
    requestedQty: v.optional(v.union(v.number(), v.null())), // null clears (=> needs confirmation)
    nameEs: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    unit: v.optional(v.string()),
    itemKey: v.optional(v.string()),
    needsConfirmation: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("draft"), v.literal("approved"), v.literal("rejected"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId);
    if (!need) throw new ConvexError({ code: "NOT_FOUND", entity: "need" });
    const { user } = await requireCoordinatorFor(ctx, args.sessionToken, need.projectId);

    const patch: Partial<Doc<"materialNeeds">> = {};
    let requestedQty = need.requestedQty;
    if (args.requestedQty !== undefined) {
      if (args.requestedQty === null) {
        requestedQty = undefined;
      } else {
        if (!Number.isInteger(args.requestedQty) || args.requestedQty < 1) {
          throw new ConvexError({ code: "INVALID_QTY" });
        }
        requestedQty = args.requestedQty;
      }
      patch.requestedQty = requestedQty;
    }
    let needsConfirmation = args.needsConfirmation ?? need.needsConfirmation;
    // Setting a concrete qty without saying otherwise confirms it.
    if (args.requestedQty !== undefined && args.requestedQty !== null && args.needsConfirmation === undefined) {
      needsConfirmation = false;
    }
    if (requestedQty === undefined) needsConfirmation = true;
    patch.needsConfirmation = needsConfirmation;
    for (const k of ["nameEs", "nameEn", "unit", "itemKey"] as const) {
      const val = args[k];
      if (val !== undefined) {
        if (!val.trim()) throw new ConvexError({ code: "INVALID_FIELD", field: k });
        patch[k] = val.trim();
      }
    }
    if (args.status !== undefined) patch.status = args.status;

    if (requestedQty !== undefined && args.requestedQty !== undefined) {
      const ledger = await computeLedger(ctx, need._id);
      const committed = Math.max(ledger.pledged, ledger.received);
      if (requestedQty < committed) {
        throw new ConvexError({ code: "QTY_BELOW_COMMITTED", committed });
      }
    }
    patch.verifiedBy = user._id;
    await ctx.db.patch("materialNeeds", need._id, patch);
    await audit(ctx, user._id, "materialNeed", need._id, "update", JSON.stringify({ ...args, sessionToken: undefined }));
    return null;
  },
});

export const addNeed = mutation({
  args: {
    ...tokenArg,
    projectId: v.id("projects"),
    itemKey: v.string(),
    nameEs: v.string(),
    nameEn: v.string(),
    unit: v.string(),
    requestedQty: v.optional(v.number()),
  },
  returns: v.id("materialNeeds"),
  handler: async (ctx, args) => {
    const { user } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    if (args.requestedQty !== undefined && (!Number.isInteger(args.requestedQty) || args.requestedQty < 1)) {
      throw new ConvexError({ code: "INVALID_QTY" });
    }
    const id = await ctx.db.insert("materialNeeds", {
      projectId: args.projectId,
      itemKey: args.itemKey,
      nameEs: args.nameEs,
      nameEn: args.nameEn,
      unit: args.unit,
      requestedQty: args.requestedQty,
      needsConfirmation: args.requestedQty === undefined,
      aiSuggested: false,
      status: "approved",
      verifiedBy: user._id,
    });
    await audit(ctx, user._id, "materialNeed", id, "create", `${args.itemKey} qty=${args.requestedQty ?? "?"}`);
    return id;
  },
});

export const approveAndPublish = mutation({
  args: {
    ...tokenArg,
    projectId: v.id("projects"),
    publicAlias: v.string(),
    titleEs: v.string(),
    titleEn: v.string(),
    summaryEs: v.string(),
    summaryEn: v.string(),
    /** Also approve every still-draft need (default false). */
    approveDraftNeeds: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    if (project.status !== "in_review" && project.status !== "draft") {
      throw new ConvexError({ code: "INVALID_STATUS", status: project.status });
    }
    const fields = {
      publicAlias: args.publicAlias.trim(),
      titleEs: args.titleEs.trim(),
      titleEn: args.titleEn.trim(),
      summaryEs: args.summaryEs.trim(),
      summaryEn: args.summaryEn.trim(),
    };
    for (const [k, val] of Object.entries(fields)) {
      if (!val) throw new ConvexError({ code: "INVALID_FIELD", field: k });
    }
    const priv = await ctx.db
      .query("projectPrivate")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .first();
    const leak = findPrivateLeak(priv?.beneficiaryName, fields);
    if (leak) throw new ConvexError({ code: "ALIAS_CONTAINS_PRIVATE", field: leak });

    const now = Date.now();
    await ctx.db.patch("projects", project._id, {
      ...fields,
      status: "published",
      approvedBy: user._id,
      approvedAt: now,
      publishedAt: now,
      safetyPauseReasonPublic: undefined,
    });
    const needs = await ctx.db
      .query("materialNeeds")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(100);
    if (args.approveDraftNeeds) {
      for (const n of needs) {
        if (n.status === "draft") await ctx.db.patch("materialNeeds", n._id, { status: "approved", verifiedBy: user._id });
      }
    }
    const reports = await ctx.db
      .query("fieldReports")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(50);
    for (const r of reports) {
      if (r.reviewStatus !== "approved") await ctx.db.patch("fieldReports", r._id, { reviewStatus: "approved" });
    }
    // Field-reported milestones become publicly visible once a coordinator verifies the project.
    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_project_time", (q) => q.eq("projectId", project._id))
      .take(300);
    for (const m of existing) {
      if (m.type === "need_reported" && m.status === "pending") {
        await ctx.db.patch("milestones", m._id, { status: "verified", verifiedBy: user._id });
      }
    }
    await ctx.db.insert("milestones", {
      projectId: project._id,
      type: "approved",
      status: "verified",
      verifiedBy: user._id,
      occurredAt: now,
      publicDescriptionEs: "Necesidades revisadas y aprobadas por Espejo de Agua",
      publicDescriptionEn: "Needs reviewed and approved by Espejo de Agua",
    });
    await ctx.db.insert("milestones", {
      projectId: project._id,
      type: "published",
      status: "verified",
      verifiedBy: user._id,
      occurredAt: now + 1,
      publicDescriptionEs: `Proyecto publicado como «${fields.publicAlias}»`,
      publicDescriptionEn: `Project published as “${fields.publicAlias}”`,
    });
    await audit(ctx, user._id, "project", project._id, "approveAndPublish", `${project.status}->published alias=${fields.publicAlias}`);
    return null;
  },
});

export const requestChanges = mutation({
  args: { ...tokenArg, projectId: v.id("projects"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    if (project.status !== "in_review") throw new ConvexError({ code: "INVALID_STATUS", status: project.status });
    await ctx.db.patch("projects", project._id, { status: "draft" });
    const reports = await ctx.db
      .query("fieldReports")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(50);
    for (const r of reports) {
      const patch: Partial<Doc<"fieldReports">> = { reviewStatus: "changes_requested" };
      if (args.note?.trim()) patch.missingQuestions = [...(r.missingQuestions ?? []), args.note.trim()];
      await ctx.db.patch("fieldReports", r._id, patch);
    }
    await audit(ctx, user._id, "project", project._id, "requestChanges", args.note);
    return null;
  },
});

export const pause = mutation({
  args: { ...tokenArg, projectId: v.id("projects"), reasonPublicEs: v.string(), reasonPublicEn: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    if (project.status !== "published") throw new ConvexError({ code: "INVALID_STATUS", status: project.status });
    const reason = args.reasonPublicEs.trim();
    if (!reason) throw new ConvexError({ code: "INVALID_FIELD", field: "reasonPublicEs" });
    const priv = await ctx.db
      .query("projectPrivate")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .first();
    const leak = findPrivateLeak(priv?.beneficiaryName, { reasonPublicEs: reason, reasonPublicEn: args.reasonPublicEn ?? "" });
    if (leak) throw new ConvexError({ code: "ALIAS_CONTAINS_PRIVATE", field: leak });
    await ctx.db.patch("projects", project._id, { status: "paused", safetyPauseReasonPublic: reason });
    await ctx.db.insert("milestones", {
      projectId: project._id,
      type: "paused",
      status: "verified",
      verifiedBy: user._id,
      occurredAt: Date.now(),
      publicDescriptionEs: `Proyecto en pausa: ${reason}`,
      publicDescriptionEn: `Project paused: ${args.reasonPublicEn?.trim() || reason}`,
    });
    await audit(ctx, user._id, "project", project._id, "pause", reason);
    return null;
  },
});

export const resume = mutation({
  args: { ...tokenArg, projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    if (project.status !== "paused") throw new ConvexError({ code: "INVALID_STATUS", status: project.status });
    await ctx.db.patch("projects", project._id, { status: "published", safetyPauseReasonPublic: undefined });
    await ctx.db.insert("milestones", {
      projectId: project._id,
      type: "published",
      status: "verified",
      verifiedBy: user._id,
      occurredAt: Date.now(),
      publicDescriptionEs: "Proyecto reanudado",
      publicDescriptionEn: "Project resumed",
    });
    await audit(ctx, user._id, "project", project._id, "resume");
    return null;
  },
});

export const complete = mutation({
  args: { ...tokenArg, projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    if (project.status !== "published" && project.status !== "paused") {
      throw new ConvexError({ code: "INVALID_STATUS", status: project.status });
    }
    await ctx.db.patch("projects", project._id, { status: "completed", safetyPauseReasonPublic: undefined });
    await audit(ctx, user._id, "project", project._id, "complete");
    return null;
  },
});

export const recordMaterialEvent = mutation({
  args: {
    ...tokenArg,
    needId: v.id("materialNeeds"),
    pledgeId: v.optional(v.id("pledges")),
    /** received → delivered → used → verified (order enforced); returned = back out of stock. */
    eventType: materialEventType,
    qty: v.number(),
    noteEs: v.optional(v.string()),
    noteEn: v.optional(v.string()),
    evidencePhotoId: v.optional(v.id("photos")),
    evidenceId: v.optional(v.id("evidence")),
  },
  returns: v.object({ eventId: v.id("materialEvents"), ledger: ledgerValidator, pledgeFulfilled: v.boolean() }),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId);
    if (!need) throw new ConvexError({ code: "NOT_FOUND", entity: "need" });
    const { user } = await requireCoordinatorFor(ctx, args.sessionToken, need.projectId);
    if (!Number.isInteger(args.qty) || args.qty < 1) throw new ConvexError({ code: "INVALID_QTY" });
    if (need.status !== "approved" && need.status !== "fulfilled") {
      throw new ConvexError({ code: "NEED_NOT_OPEN", status: need.status });
    }
    if (args.evidencePhotoId) {
      const ph = await ctx.db.get(args.evidencePhotoId);
      if (!ph || ph.projectId !== need.projectId) throw new ConvexError({ code: "INVALID_PHOTO" });
    }
    let evidence: Doc<"evidence"> | null = null;
    if (args.evidenceId) {
      evidence = await ctx.db.get(args.evidenceId);
      if (!evidence || evidence.projectId !== need.projectId) throw new ConvexError({ code: "INVALID_EVIDENCE" });
      if (evidence.needId && evidence.needId !== need._id) throw new ConvexError({ code: "INVALID_EVIDENCE" });
    }
    const before = await computeLedger(ctx, need._id);

    let pledge: Doc<"pledges"> | null = null;
    if (args.pledgeId) {
      if (args.eventType !== "received") throw new ConvexError({ code: "PLEDGE_ONLY_ON_RECEIPT" });
      pledge = await ctx.db.get(args.pledgeId);
      if (!pledge || pledge.needId !== need._id) throw new ConvexError({ code: "INVALID_PLEDGE" });
      if (pledge.status !== "active") throw new ConvexError({ code: "PLEDGE_NOT_ACTIVE", status: pledge.status });
    }
    // Stage order: delivered <= received, used <= delivered, verified <= used.
    if (args.eventType === "delivered" && before.delivered + args.qty > before.received) {
      throw new ConvexError({ code: "DELIVERED_EXCEEDS_RECEIVED", available: Math.max(0, before.received - before.delivered) });
    }
    if (args.eventType === "used" && before.used + args.qty > before.delivered) {
      throw new ConvexError({ code: "USED_EXCEEDS_DELIVERED", available: Math.max(0, before.delivered - before.used) });
    }
    if (args.eventType === "verified" && before.verified + args.qty > before.used) {
      throw new ConvexError({ code: "VERIFIED_EXCEEDS_USED", available: Math.max(0, before.used - before.verified) });
    }
    // Only stock still at the nonprofit (received, not yet delivered) can be returned.
    if (args.eventType === "returned" && args.qty > before.received - before.delivered) {
      throw new ConvexError({ code: "RETURN_EXCEEDS_STOCK", available: Math.max(0, before.received - before.delivered) });
    }

    let pledgeFulfilled = false;
    let pledgeReceived = 0;
    if (pledge) {
      const events = await ctx.db
        .query("materialEvents")
        .withIndex("by_need", (q) => q.eq("needId", need._id))
        .take(2000);
      pledgeReceived = events
        .filter((e) => e.pledgeId === pledge._id && e.eventType === "received")
        .reduce((s, e) => s + e.qty, 0);
      if (pledgeReceived + args.qty > pledge.qty) {
        throw new ConvexError({ code: "EXCEEDS_PLEDGE", available: pledge.qty - pledgeReceived });
      }
    }

    const eventId = await ctx.db.insert("materialEvents", {
      needId: need._id,
      projectId: need.projectId,
      pledgeId: args.pledgeId,
      eventType: args.eventType,
      qty: args.qty,
      evidencePhotoId: args.evidencePhotoId,
      evidenceId: args.evidenceId,
      noteEs: args.noteEs?.trim() || undefined,
      noteEn: args.noteEn?.trim() || undefined,
      verifiedBy: user._id,
    });
    if (evidence && !evidence.materialEventId) {
      await ctx.db.patch("evidence", evidence._id, { materialEventId: eventId, needId: need._id });
    }
    if (pledge && pledgeReceived + args.qty >= pledge.qty) {
      await ctx.db.patch("pledges", pledge._id, { status: "fulfilled" });
      pledgeFulfilled = true;
      await audit(ctx, user._id, "pledge", pledge._id, "fulfilled", `qty=${pledge.qty}`);
    }

    const text = materialMilestoneText(args.eventType, args.qty, need);
    const es = args.noteEs?.trim() ? `${text.es} — ${args.noteEs.trim()}` : text.es;
    const en = args.noteEn?.trim() ? `${text.en} — ${args.noteEn.trim()}` : text.en;
    await ctx.db.insert("milestones", {
      projectId: need.projectId,
      type: args.eventType === "returned" ? "received" : args.eventType,
      status: "verified",
      verifiedBy: user._id,
      occurredAt: Date.now(),
      publicDescriptionEs: es,
      publicDescriptionEn: en,
      photoId: args.evidencePhotoId,
      evidenceId: args.evidenceId,
    });

    const after = await computeLedger(ctx, need._id);
    if (after.requested !== null && after.used >= after.requested && need.status === "approved") {
      await ctx.db.patch("materialNeeds", need._id, { status: "fulfilled" });
    }
    await audit(
      ctx,
      user._id,
      "materialEvent",
      eventId,
      args.eventType,
      `need=${need._id} qty=${args.qty} pledge=${args.pledgeId ?? "-"} evidence=${args.evidenceId ?? "-"}`,
    );
    return { eventId, ledger: after, pledgeFulfilled };
  },
});

export const listPledges = query({
  args: {
    ...tokenArg,
    projectId: v.optional(v.id("projects")),
    status: v.optional(pledgeStatusValidator),
  },
  returns: v.array(reviewPledge),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["coordinator"]);
    let projects: Doc<"projects">[];
    if (args.projectId) {
      const { project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
      projects = [project];
    } else {
      projects = [];
      for (const s of ["published", "paused", "completed"] as const) {
        projects.push(...(await projectsByStatus(ctx, user.nonprofitId, s)));
      }
    }
    const out = [];
    for (const p of projects) {
      for (const row of await pledgeRows(ctx, p)) {
        if (!args.status || row.status === args.status) out.push(row);
      }
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});

export const approvePhoto = mutation({
  args: {
    ...tokenArg,
    photoId: v.id("photos"),
    approve: v.optional(v.boolean()), // default true; false => rejected + private
    captionEs: v.optional(v.string()),
    captionEn: v.optional(v.string()),
    setAsCover: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo) throw new ConvexError({ code: "NOT_FOUND", entity: "photo" });
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, photo.projectId);
    const approve = args.approve ?? true;
    const patch: Partial<Doc<"photos">> = approve
      ? { visibility: "publicApproved", reviewStatus: "approved" }
      : { visibility: "private", reviewStatus: "rejected" };
    if (args.captionEs !== undefined) patch.captionEs = args.captionEs;
    if (args.captionEn !== undefined) patch.captionEn = args.captionEn;
    await ctx.db.patch("photos", photo._id, patch);
    if (approve && args.setAsCover) {
      await ctx.db.patch("projects", project._id, { coverPhotoId: photo._id });
    } else if (!approve && project.coverPhotoId === photo._id) {
      await ctx.db.patch("projects", project._id, { coverPhotoId: undefined });
    }
    await audit(ctx, user._id, "photo", photo._id, approve ? "approvePublic" : "reject");
    return null;
  },
});

export const addMilestone = mutation({
  args: {
    ...tokenArg,
    projectId: v.id("projects"),
    type: v.optional(v.union(v.literal("outcome"), v.literal("expense"))),
    descriptionEs: v.string(),
    descriptionEn: v.string(),
    photoId: v.optional(v.id("photos")),
  },
  returns: v.id("milestones"),
  handler: async (ctx, args) => {
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    const es = args.descriptionEs.trim();
    const en = args.descriptionEn.trim() || es;
    if (!es) throw new ConvexError({ code: "INVALID_FIELD", field: "descriptionEs" });
    const priv = await ctx.db
      .query("projectPrivate")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .first();
    const leak = findPrivateLeak(priv?.beneficiaryName, { descriptionEs: es, descriptionEn: en });
    if (leak) throw new ConvexError({ code: "ALIAS_CONTAINS_PRIVATE", field: leak });
    if (args.photoId) {
      const ph = await ctx.db.get(args.photoId);
      if (!ph || ph.projectId !== project._id) throw new ConvexError({ code: "INVALID_PHOTO" });
    }
    const id = await ctx.db.insert("milestones", {
      projectId: project._id,
      type: args.type ?? "outcome",
      status: "verified",
      verifiedBy: user._id,
      occurredAt: Date.now(),
      publicDescriptionEs: es,
      publicDescriptionEn: en,
      photoId: args.photoId,
    });
    await audit(ctx, user._id, "milestone", id, "add", args.type ?? "outcome");
    return id;
  },
});

// ---- Update 2: evidence, financials, weekly reports (implemented in sibling modules) ----
export { generateEvidenceUploadUrl, addEvidence, reviewEvidence, listEvidence } from "./evidence";
export {
  recordContribution,
  updateContributionStatus,
  recordExpense,
  approveExpense,
  financials,
} from "./financials";
export { generateWeeklyReport, updateWeeklyReport, publishWeeklyReport, listWeeklyReports } from "./weekly";
