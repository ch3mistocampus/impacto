import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { audit, requireRole } from "./lib/auth";
import { evidenceTypeValidator, findPrivateLeak, requireCoordinatorFor } from "./projects";

/**
 * Evidence API (coordinator only, same nonprofit). Exposed as `coordinator.*` via re-export.
 * Originals (privateStorageId) are never returned by public queries. Public sees only
 * reviewStatus "approved" && publicApproved, served from publicStorageId.
 */

const tokenArg = { sessionToken: v.string() };
const MAX_NOTE = 2000;

export const generateEvidenceUploadUrl = mutation({
  args: tokenArg,
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, ["coordinator"]);
    return await ctx.storage.generateUploadUrl();
  },
});

function cleanNote(s: string | undefined): string | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  if (t.length > MAX_NOTE) throw new ConvexError({ code: "INVALID_FIELD", field: "note" });
  return t;
}

export const addEvidence = mutation({
  args: {
    ...tokenArg,
    projectId: v.id("projects"),
    needId: v.optional(v.id("materialNeeds")),
    materialEventId: v.optional(v.id("materialEvents")),
    type: evidenceTypeValidator,
    /** Uploaded original (EXIF-stripped client-side). Stored as privateStorageId. */
    storageId: v.optional(v.id("_storage")),
    noteEs: v.optional(v.string()),
    noteEn: v.optional(v.string()),
  },
  returns: v.id("evidence"),
  handler: async (ctx, args) => {
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    if (args.needId) {
      const need = await ctx.db.get(args.needId);
      if (!need || need.projectId !== project._id) throw new ConvexError({ code: "INVALID_NEED" });
    }
    let needId = args.needId;
    if (args.materialEventId) {
      const ev = await ctx.db.get(args.materialEventId);
      if (!ev || ev.projectId !== project._id) throw new ConvexError({ code: "INVALID_EVENT" });
      if (needId && ev.needId !== needId) throw new ConvexError({ code: "INVALID_EVENT" });
      needId = ev.needId;
    }
    const noteEs = cleanNote(args.noteEs);
    const noteEn = cleanNote(args.noteEn);
    if (!args.storageId && !noteEs && !noteEn) throw new ConvexError({ code: "EMPTY_EVIDENCE" });
    const id = await ctx.db.insert("evidence", {
      projectId: project._id,
      needId,
      materialEventId: args.materialEventId,
      type: args.type,
      privateStorageId: args.storageId,
      noteEs,
      noteEn,
      reviewStatus: "pending",
      publicApproved: false,
      uploadedBy: user._id,
    });
    if (args.materialEventId) {
      const ev = await ctx.db.get(args.materialEventId);
      if (ev && !ev.evidenceId) await ctx.db.patch("materialEvents", ev._id, { evidenceId: id });
    }
    await audit(ctx, user._id, "evidence", id, "add", `type=${args.type} file=${args.storageId ? "yes" : "no"}`);
    return id;
  },
});

export const reviewEvidence = mutation({
  args: {
    ...tokenArg,
    evidenceId: v.id("evidence"),
    /** true => approved and visible publicly (notes + publicStorageId if any); false => rejected, private. */
    approve: v.boolean(),
    /** A redacted copy to show publicly instead of the original. */
    publicStorageId: v.optional(v.id("_storage")),
    /** Coordinator explicitly confirms the ORIGINAL file is safe to publish as-is. */
    usePrivateAsPublic: v.optional(v.boolean()),
    /** Optional public-safe note edits at review time. */
    noteEs: v.optional(v.string()),
    noteEn: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.evidenceId);
    if (!ev) throw new ConvexError({ code: "NOT_FOUND", entity: "evidence" });
    const { user, project } = await requireCoordinatorFor(ctx, args.sessionToken, ev.projectId);
    const patch: Partial<Doc<"evidence">> = { reviewedBy: user._id, reviewedAt: Date.now() };
    if (args.noteEs !== undefined) patch.noteEs = cleanNote(args.noteEs);
    if (args.noteEn !== undefined) patch.noteEn = cleanNote(args.noteEn);
    if (args.approve) {
      const priv = await ctx.db
        .query("projectPrivate")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .first();
      const leak = findPrivateLeak(priv?.beneficiaryName, {
        noteEs: (patch.noteEs !== undefined ? patch.noteEs : ev.noteEs) ?? "",
        noteEn: (patch.noteEn !== undefined ? patch.noteEn : ev.noteEn) ?? "",
      });
      if (leak) throw new ConvexError({ code: "ALIAS_CONTAINS_PRIVATE", field: leak });
      patch.reviewStatus = "approved";
      patch.publicApproved = true;
      if (args.publicStorageId) patch.publicStorageId = args.publicStorageId;
      else if (args.usePrivateAsPublic && ev.privateStorageId) patch.publicStorageId = ev.privateStorageId;
    } else {
      patch.reviewStatus = "rejected";
      patch.publicApproved = false;
      patch.publicStorageId = undefined;
    }
    await ctx.db.patch("evidence", ev._id, patch);
    if (args.approve) {
      // Field to-dos record custody milestones as "pending" until their photo is reviewed.
      const ms = await ctx.db
        .query("milestones")
        .withIndex("by_project_time", (q) => q.eq("projectId", ev.projectId))
        .take(500);
      for (const m of ms) {
        if (m.evidenceId === ev._id && m.status === "pending") {
          await ctx.db.patch("milestones", m._id, { status: "verified", verifiedBy: user._id });
        }
      }
    }
    await audit(
      ctx,
      user._id,
      "evidence",
      ev._id,
      args.approve ? "approvePublic" : "reject",
      `public=${patch.publicStorageId ? (patch.publicStorageId === ev.privateStorageId ? "original" : "redacted") : "none"}`,
    );
    return null;
  },
});

export const listEvidence = query({
  args: { ...tokenArg, projectId: v.id("projects") },
  returns: v.array(
    v.object({
      evidenceId: v.id("evidence"),
      projectId: v.id("projects"),
      needId: v.union(v.id("materialNeeds"), v.null()),
      materialEventId: v.union(v.id("materialEvents"), v.null()),
      type: evidenceTypeValidator,
      privateUrl: v.union(v.string(), v.null()),
      /** MIME type of the private original (from _storage), e.g. "image/jpeg", "application/pdf". */
      contentType: v.union(v.string(), v.null()),
      publicUrl: v.union(v.string(), v.null()),
      noteEs: v.union(v.string(), v.null()),
      noteEn: v.union(v.string(), v.null()),
      reviewStatus: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      publicApproved: v.boolean(),
      uploadedByName: v.union(v.string(), v.null()),
      reviewedByName: v.union(v.string(), v.null()),
      createdAt: v.number(),
      reviewedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireCoordinatorFor(ctx, args.sessionToken, args.projectId);
    const rows = await ctx.db
      .query("evidence")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(200);
    const out = [];
    for (const e of rows) {
      const up = await ctx.db.get(e.uploadedBy);
      const rv = e.reviewedBy ? await ctx.db.get(e.reviewedBy) : null;
      const meta = e.privateStorageId ? await ctx.db.system.get("_storage", e.privateStorageId) : null;
      out.push({
        evidenceId: e._id,
        projectId: e.projectId,
        needId: e.needId ?? null,
        materialEventId: e.materialEventId ?? null,
        type: e.type,
        privateUrl: e.privateStorageId ? await ctx.storage.getUrl(e.privateStorageId) : null,
        contentType: meta?.contentType ?? null,
        publicUrl: e.publicStorageId ? await ctx.storage.getUrl(e.publicStorageId) : null,
        noteEs: e.noteEs ?? null,
        noteEn: e.noteEn ?? null,
        reviewStatus: e.reviewStatus,
        publicApproved: e.publicApproved,
        uploadedByName: up?.name ?? null,
        reviewedByName: rv?.name ?? null,
        createdAt: e._creationTime,
        reviewedAt: e.reviewedAt ?? null,
      });
    }
    return out;
  },
});
