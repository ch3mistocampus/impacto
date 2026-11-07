import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { audit, requireRole } from "./lib/auth";
import { category, locale, urgency } from "./schema";

/**
 * Lane B — Field intake (role: field_worker).
 *
 * Privacy: `projectPrivate` is written/read here only by the creating field worker.
 * Nothing in this file sends data to AI; `convex/ai.ts` reads ONLY the transcript
 * via `getReportForAi` (never projectPrivate, never photos).
 */

const FIELD = ["field_worker"] as const;

// ---------- shared validators ----------

export const extractionMaterialValidator = v.object({
  itemKey: v.string(),
  nameEs: v.string(),
  nameEn: v.string(),
  quantity: v.union(v.number(), v.null()), // null => not explicitly stated, needs confirmation
  unit: v.string(),
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  approximate: v.optional(v.boolean()), // stated with "aproximadamente/unos/about"
  sourceQuote: v.string(),
});

export const bilingualText = v.object({ es: v.string(), en: v.string() });

export const extractionValidator = v.object({
  source: v.union(v.literal("openai"), v.literal("fallback")),
  model: v.optional(v.string()),
  notice: v.optional(v.string()), // e.g. why fallback was used
  redactions: v.number(), // # of names/phones/emails stripped before sending to AI
  titleEs: v.string(),
  titleEn: v.string(),
  category,
  summaryEs: v.string(),
  summaryEn: v.string(),
  urgency, // AI *suggestion*; the worker confirms it in review
  damageDescriptionEs: v.optional(v.string()),
  damageDescriptionEn: v.optional(v.string()),
  materials: v.array(extractionMaterialValidator),
  missingQuestions: v.array(bilingualText),
  // Proposed (unverified) milestones. Worker edits are written back here (see updateDraft) so
  // coordinators read them from fieldReports.draftExtraction.proposedMilestones.
  proposedMilestones: v.optional(v.array(bilingualText)),
  transcriptTranslated: v.union(v.string(), v.null()),
  editedByWorker: v.optional(v.boolean()),
});

const needInput = v.object({
  needId: v.optional(v.id("materialNeeds")),
  itemKey: v.string(),
  nameEs: v.string(),
  nameEn: v.string(),
  requestedQty: v.optional(v.number()), // undefined => needs confirmation
  unit: v.string(),
  aiSuggested: v.boolean(),
});

// ---------- helpers ----------

async function loadOwnProject(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get(projectId);
  if (!project || project.createdBy !== user._id) throw new ConvexError({ code: "NOT_FOUND" });
  return project;
}

async function loadOwnReport(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  reportId: Id<"fieldReports">,
): Promise<Doc<"fieldReports">> {
  const report = await ctx.db.get(reportId);
  if (!report || report.createdBy !== user._id) throw new ConvexError({ code: "NOT_FOUND" });
  return report;
}

function assertEditable(project: Doc<"projects">) {
  if (project.status !== "draft") throw new ConvexError({ code: "NOT_EDITABLE", status: project.status });
}

async function reportForProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  return await ctx.db
    .query("fieldReports")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();
}

const clean = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : undefined;
};

// ---------- mutations ----------

export const createDraft = mutation({
  args: {
    sessionToken: v.string(),
    language: locale,
    transcript: v.optional(v.string()),
  },
  returns: v.object({ projectId: v.id("projects"), reportId: v.id("fieldReports") }),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    let nonprofitId = user.nonprofitId;
    if (!nonprofitId) {
      const np = await ctx.db.query("nonprofits").first();
      if (!np) throw new ConvexError({ code: "NO_NONPROFIT" });
      nonprofitId = np._id;
    }
    const tag = Date.now().toString(36).slice(-4).toUpperCase();
    const projectId = await ctx.db.insert("projects", {
      publicAlias: `Borrador ${tag}`, // placeholder; coordinator chooses the public alias
      category: "reconstruction",
      titleEs: "",
      titleEn: "",
      summaryEs: "",
      summaryEn: "",
      urgency: "medium",
      status: "draft",
      nonprofitId,
      createdBy: user._id,
      isDemo: true,
    });
    const reportId = await ctx.db.insert("fieldReports", {
      projectId,
      transcriptOriginal: args.transcript?.trim() ?? "",
      language: args.language,
      aiStatus: "none",
      reviewStatus: "draft",
      createdBy: user._id,
    });
    await audit(ctx, user._id, "projects", projectId, "field.createDraft");
    return { projectId, reportId };
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

export const attachAudio = mutation({
  args: { sessionToken: v.string(), reportId: v.id("fieldReports"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const report = await loadOwnReport(ctx, user, args.reportId);
    assertEditable(await loadOwnProject(ctx, user, report.projectId));
    if (report.audioStorageId) await ctx.storage.delete(report.audioStorageId);
    await ctx.db.patch("fieldReports", report._id, { audioStorageId: args.storageId });
    return null;
  },
});

export const attachPhoto = mutation({
  args: { sessionToken: v.string(), projectId: v.id("projects"), storageId: v.id("_storage") },
  returns: v.id("photos"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    assertEditable(await loadOwnProject(ctx, user, args.projectId));
    // Photos are private until a coordinator explicitly approves a publication-safe image.
    return await ctx.db.insert("photos", {
      projectId: args.projectId,
      storageId: args.storageId,
      visibility: "private",
      reviewStatus: "pending",
      uploadedBy: user._id,
    });
  },
});

export const removePhoto = mutation({
  args: { sessionToken: v.string(), photoId: v.id("photos") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.uploadedBy !== user._id) throw new ConvexError({ code: "NOT_FOUND" });
    assertEditable(await loadOwnProject(ctx, user, photo.projectId));
    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete("photos", photo._id);
    return null;
  },
});

/** Text-input fallback: worker types/pastes the description (or uses the demo transcript). */
export const saveTranscript = mutation({
  args: {
    sessionToken: v.string(),
    reportId: v.id("fieldReports"),
    transcript: v.string(),
    language: v.optional(locale),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const report = await loadOwnReport(ctx, user, args.reportId);
    assertEditable(await loadOwnProject(ctx, user, report.projectId));
    await ctx.db.patch("fieldReports", report._id, {
      transcriptOriginal: args.transcript.trim(),
      ...(args.language ? { language: args.language } : {}),
      aiStatus: "none",
      aiError: undefined,
    });
    return null;
  },
});

/** Worker edits of every AI-drafted field. Needs are replaced by the given list. */
export const updateDraft = mutation({
  args: {
    sessionToken: v.string(),
    projectId: v.id("projects"),
    titleEs: v.string(),
    titleEn: v.string(),
    category,
    summaryEs: v.string(),
    summaryEn: v.string(),
    urgency,
    needs: v.array(needInput),
    // Optional review extras, stored on fieldReports.draftExtraction (no schema change).
    proposedMilestones: v.optional(v.array(bilingualText)),
    damageDescriptionEs: v.optional(v.string()),
    damageDescriptionEn: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const project = await loadOwnProject(ctx, user, args.projectId);
    assertEditable(project);
    await ctx.db.patch("projects", project._id, {
      titleEs: args.titleEs.trim(),
      titleEn: args.titleEn.trim(),
      category: args.category,
      summaryEs: args.summaryEs.trim(),
      summaryEn: args.summaryEn.trim(),
      urgency: args.urgency,
    });

    const existing = await ctx.db
      .query("materialNeeds")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(200);
    const keep = new Set(args.needs.map((n) => n.needId).filter(Boolean));
    for (const e of existing) if (!keep.has(e._id)) await ctx.db.delete("materialNeeds", e._id);

    for (const n of args.needs.slice(0, 50)) {
      const qty = n.requestedQty !== undefined && Number.isFinite(n.requestedQty) && n.requestedQty > 0
        ? n.requestedQty
        : undefined;
      const doc = {
        itemKey: n.itemKey.trim() || "other",
        nameEs: n.nameEs.trim(),
        nameEn: n.nameEn.trim(),
        requestedQty: qty,
        unit: n.unit.trim() || "unidades",
        needsConfirmation: qty === undefined,
        aiSuggested: n.aiSuggested,
      };
      const prev = n.needId ? existing.find((e) => e._id === n.needId) : undefined;
      if (prev) await ctx.db.patch("materialNeeds", prev._id, doc);
      else await ctx.db.insert("materialNeeds", { ...doc, projectId: project._id, status: "draft" });
    }

    if (
      args.proposedMilestones !== undefined ||
      args.damageDescriptionEs !== undefined ||
      args.damageDescriptionEn !== undefined
    ) {
      const report = await reportForProject(ctx, project._id);
      if (report?.draftExtraction) {
        const ex = report.draftExtraction as typeof extractionValidator.type;
        await ctx.db.patch("fieldReports", report._id, {
          draftExtraction: {
            ...ex,
            ...(args.proposedMilestones !== undefined
              ? {
                  proposedMilestones: args.proposedMilestones
                    .map((m) => ({ es: m.es.trim().slice(0, 200), en: m.en.trim().slice(0, 200) }))
                    .filter((m) => m.es || m.en)
                    .slice(0, 12),
                }
              : {}),
            ...(args.damageDescriptionEs !== undefined ? { damageDescriptionEs: args.damageDescriptionEs.trim().slice(0, 2000) } : {}),
            ...(args.damageDescriptionEn !== undefined ? { damageDescriptionEn: args.damageDescriptionEn.trim().slice(0, 2000) } : {}),
            editedByWorker: true,
          },
        });
      }
    }
    await audit(ctx, user._id, "projects", project._id, "field.updateDraft");
    return null;
  },
});

async function applyExtractionToProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  ex: typeof extractionValidator.type,
) {
  await ctx.db.patch("projects", projectId, {
    titleEs: ex.titleEs,
    titleEn: ex.titleEn,
    category: ex.category,
    summaryEs: ex.summaryEs,
    summaryEn: ex.summaryEn,
    urgency: ex.urgency,
  });
  const existing = await ctx.db
    .query("materialNeeds")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(200);
  for (const e of existing) await ctx.db.delete("materialNeeds", e._id);
  for (const m of ex.materials.slice(0, 50)) {
    const qty = m.quantity !== null && m.quantity > 0 ? m.quantity : undefined;
    await ctx.db.insert("materialNeeds", {
      projectId,
      itemKey: m.itemKey,
      nameEs: m.nameEs,
      nameEn: m.nameEn,
      requestedQty: qty,
      unit: m.unit,
      needsConfirmation: qty === undefined,
      aiSuggested: true, // AI is a draft — never verified
      status: "draft",
    });
  }
}

/** Re-apply the stored AI draft to the project (overwrites worker edits). */
export const applyExtraction = mutation({
  args: { sessionToken: v.string(), reportId: v.id("fieldReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const report = await loadOwnReport(ctx, user, args.reportId);
    const project = await loadOwnProject(ctx, user, report.projectId);
    assertEditable(project);
    if (!report.draftExtraction) throw new ConvexError({ code: "NO_EXTRACTION" });
    await applyExtractionToProject(ctx, project._id, report.draftExtraction);
    return null;
  },
});

/** Private beneficiary details — creator only. Never public, never sent to AI. */
export const savePrivateDetails = mutation({
  args: {
    sessionToken: v.string(),
    projectId: v.id("projects"),
    beneficiaryName: v.optional(v.string()),
    privateAddress: v.optional(v.string()),
    contact: v.optional(v.string()),
    privateNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const project = await loadOwnProject(ctx, user, args.projectId);
    const fields = {
      beneficiaryName: clean(args.beneficiaryName),
      privateAddress: clean(args.privateAddress),
      contact: clean(args.contact),
      privateNotes: clean(args.privateNotes),
    };
    const existing = await ctx.db
      .query("projectPrivate")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .unique();
    if (existing) await ctx.db.patch("projectPrivate", existing._id, fields);
    else await ctx.db.insert("projectPrivate", { projectId: project._id, ...fields });
    // Audit without values — never log private data.
    await audit(ctx, user._id, "projectPrivate", project._id, "field.savePrivateDetails");
    return null;
  },
});

export const submitForReview = mutation({
  args: { sessionToken: v.string(), projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const project = await loadOwnProject(ctx, user, args.projectId);
    assertEditable(project);
    const report = await reportForProject(ctx, project._id);
    const needs = await ctx.db
      .query("materialNeeds")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(200);
    const missing: string[] = [];
    if (!project.titleEs && !project.titleEn) missing.push("title");
    if (!project.summaryEs && !project.summaryEn) missing.push("summary");
    if (!report || !report.transcriptOriginal) missing.push("transcript");
    if (needs.length === 0) missing.push("needs");
    if (needs.some((n) => !n.nameEs && !n.nameEn)) missing.push("needName");
    if (missing.length) throw new ConvexError({ code: "MISSING_FIELDS", fields: missing });

    await ctx.db.patch("projects", project._id, { status: "in_review" });
    if (report) await ctx.db.patch("fieldReports", report._id, { reviewStatus: "submitted" });
    await audit(ctx, user._id, "projects", project._id, "field.submitForReview");
    return null;
  },
});

// ---------- queries ----------

export const getMyDraft = query({
  args: { sessionToken: v.string(), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.createdBy !== user._id) return null;
    const report = await reportForProject(ctx, project._id);
    const needs = await ctx.db
      .query("materialNeeds")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(200);
    const photoDocs = await ctx.db
      .query("photos")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(30);
    const photos = await Promise.all(
      photoDocs.map(async (p) => ({
        _id: p._id,
        visibility: p.visibility,
        reviewStatus: p.reviewStatus,
        url: await ctx.storage.getUrl(p.storageId),
      })),
    );
    // Creator-only private section (checked above).
    const priv = await ctx.db
      .query("projectPrivate")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .unique();
    return {
      project: {
        _id: project._id,
        publicAlias: project.publicAlias,
        category: project.category,
        titleEs: project.titleEs,
        titleEn: project.titleEn,
        summaryEs: project.summaryEs,
        summaryEn: project.summaryEn,
        urgency: project.urgency,
        status: project.status,
        _creationTime: project._creationTime,
      },
      report: report
        ? {
            _id: report._id,
            transcriptOriginal: report.transcriptOriginal,
            transcriptTranslated: report.transcriptTranslated ?? null,
            language: report.language,
            hasAudio: !!report.audioStorageId,
            aiStatus: report.aiStatus,
            aiError: report.aiError ?? null,
            draftExtraction: (report.draftExtraction ?? null) as typeof extractionValidator.type | null,
            reviewStatus: report.reviewStatus,
          }
        : null,
      needs: needs.map((n) => ({
        _id: n._id,
        itemKey: n.itemKey,
        nameEs: n.nameEs,
        nameEn: n.nameEn,
        requestedQty: n.requestedQty ?? null,
        unit: n.unit,
        needsConfirmation: n.needsConfirmation,
        aiSuggested: n.aiSuggested,
      })),
      photos,
      private: priv
        ? {
            beneficiaryName: priv.beneficiaryName ?? "",
            privateAddress: priv.privateAddress ?? "",
            contact: priv.contact ?? "",
            privateNotes: priv.privateNotes ?? "",
          }
        : null,
    };
  },
});

export const listMyProjects = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
      .order("desc")
      .take(50);
    return await Promise.all(
      projects.map(async (p) => {
        const needs = await ctx.db
          .query("materialNeeds")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .take(100);
        return {
          _id: p._id,
          publicAlias: p.publicAlias,
          titleEs: p.titleEs,
          titleEn: p.titleEn,
          category: p.category,
          status: p.status,
          urgency: p.urgency,
          _creationTime: p._creationTime,
          needsCount: needs.length,
          needsToConfirm: needs.filter((n) => n.needsConfirmation).length,
        };
      }),
    );
  },
});

// ---------- internal (used by convex/ai.ts) ----------

/** Authorizes the caller and returns ONLY what the AI pipeline may see: transcript + audio ref. */
export const getReportForAi = internalQuery({
  args: { sessionToken: v.string(), reportId: v.id("fieldReports") },
  returns: v.object({
    transcript: v.string(),
    language: locale,
    audioStorageId: v.union(v.id("_storage"), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, [...FIELD]);
    const report = await loadOwnReport(ctx, user, args.reportId);
    assertEditable(await loadOwnProject(ctx, user, report.projectId));
    return {
      transcript: report.transcriptOriginal,
      language: report.language,
      audioStorageId: report.audioStorageId ?? null,
    };
  },
});

export const setAiStatus = internalMutation({
  args: {
    reportId: v.id("fieldReports"),
    aiStatus: v.union(v.literal("none"), v.literal("pending"), v.literal("done"), v.literal("error")),
    aiError: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("fieldReports", args.reportId, { aiStatus: args.aiStatus, aiError: args.aiError });
    return null;
  },
});

export const storeTranscript = internalMutation({
  args: { reportId: v.id("fieldReports"), transcript: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("fieldReports", args.reportId, { transcriptOriginal: args.transcript.trim() });
    return null;
  },
});

export const storeExtraction = internalMutation({
  args: { reportId: v.id("fieldReports"), extraction: extractionValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError({ code: "NOT_FOUND" });
    const ex = args.extraction;
    await ctx.db.patch("fieldReports", report._id, {
      draftExtraction: ex,
      aiStatus: "done",
      aiError: undefined,
      transcriptTranslated: ex.transcriptTranslated ?? undefined,
      missingQuestions: ex.missingQuestions.map((q) => `${q.es} / ${q.en}`),
    });
    const project = await ctx.db.get(report.projectId);
    if (project && project.status === "draft") await applyExtractionToProject(ctx, project._id, ex);
    return null;
  },
});
