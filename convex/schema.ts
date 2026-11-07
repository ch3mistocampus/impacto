import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Impacto schema — SHARED CONTRACT. Coordinate before changing field names.
 *
 * Privacy boundary: anything beneficiary-identifying lives ONLY in `projectPrivate`
 * (and photos with visibility "private"). Public queries must return explicit allowlists.
 *
 * Quantity ledger per material need (never conflate):
 *   requested (materialNeeds.requestedQty)
 *   pledged   (sum of pledges with status "active")
 *   received  (sum of materialEvents eventType "received" minus "returned")
 *   delivered (sum of materialEvents eventType "delivered")  — delivered <= received
 *   used      (sum of materialEvents eventType "used")       — used <= delivered
 *   verified  (sum of materialEvents eventType "verified")   — verified <= used (public impact = verified only)
 *   availableToPledge = requested - activePledged - receivedNotFromPledge   (see convex/lib/ledger.ts)
 */

export const role = v.union(
  v.literal("field_worker"),
  v.literal("coordinator"),
  v.literal("donor"),
  v.literal("community"),
);
export const locale = v.union(v.literal("es"), v.literal("en"));
export const category = v.union(
  v.literal("roof_shelter"),
  v.literal("reconstruction"),
  v.literal("heal_sow"),
);
export const projectStatus = v.union(
  v.literal("draft"),
  v.literal("in_review"),
  v.literal("published"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("rejected"),
);
export const urgency = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
export const materialEventType = v.union(
  v.literal("received"),
  v.literal("delivered"),
  v.literal("used"),
  v.literal("verified"),
  v.literal("returned"),
);
export const evidenceType = v.union(
  v.literal("receipt"),
  v.literal("delivery_photo"),
  v.literal("handover_doc"),
  v.literal("staff_note"),
  v.literal("before_photo"),
  v.literal("after_photo"),
);
export const contributionStatus = v.union(v.literal("committed"), v.literal("received"), v.literal("allocated"));
export const reviewStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));

export default defineSchema({
  nonprofits: defineTable({
    name: v.string(),
    slug: v.string(),
  }).index("by_slug", ["slug"]),

  // Demo auth: one row per demo persona. Sessions map an opaque token -> user.
  users: defineTable({
    name: v.string(),
    role,
    locale,
    nonprofitId: v.optional(v.id("nonprofits")),
    email: v.optional(v.string()),
    isDemo: v.boolean(),
  }).index("by_role", ["role"]),

  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  projects: defineTable({
    publicAlias: v.string(), // e.g. "Proyecto de techo 014" — never household names
    category,
    titleEs: v.string(),
    titleEn: v.string(),
    summaryEs: v.string(),
    summaryEn: v.string(),
    urgency,
    status: projectStatus,
    nonprofitId: v.id("nonprofits"),
    region: v.optional(v.string()), // coarse only, e.g. "Utuado" — never street-level
    createdBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    safetyPauseReasonPublic: v.optional(v.string()),
    coverPhotoId: v.optional(v.id("photos")), // must point at a publicApproved photo
    isDemo: v.boolean(),
    /** Demo seed only: the simulated story date to show instead of _creationTime (seed inserts everything "now"). */
    seededAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_category_status", ["category", "status"])
    .index("by_creator", ["createdBy"]),

  // STRICTLY role-restricted: field_worker who created it + coordinators of the nonprofit.
  projectPrivate: defineTable({
    projectId: v.id("projects"),
    beneficiaryName: v.optional(v.string()),
    privateAddress: v.optional(v.string()),
    contact: v.optional(v.string()),
    privateNotes: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  fieldReports: defineTable({
    projectId: v.id("projects"),
    transcriptOriginal: v.string(),
    language: locale,
    transcriptTranslated: v.optional(v.string()),
    audioStorageId: v.optional(v.id("_storage")),
    // Raw AI output (JSON-serializable). Never treated as verified.
    draftExtraction: v.optional(v.any()),
    aiStatus: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("done"),
      v.literal("error"),
    ),
    aiError: v.optional(v.string()),
    missingQuestions: v.optional(v.array(v.string())),
    reviewStatus: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("changes_requested"),
    ),
    createdBy: v.id("users"),
  }).index("by_project", ["projectId"]),

  photos: defineTable({
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
    visibility: v.union(v.literal("private"), v.literal("publicApproved")),
    reviewStatus: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    captionEs: v.optional(v.string()),
    captionEn: v.optional(v.string()),
    uploadedBy: v.id("users"),
  })
    .index("by_project", ["projectId"])
    .index("by_project_visibility", ["projectId", "visibility"]),

  materialNeeds: defineTable({
    projectId: v.id("projects"),
    itemKey: v.string(), // e.g. "bricks", "cement_bag", "zinc_sheet", "meals" — maps to icon
    nameEs: v.string(),
    nameEn: v.string(),
    requestedQty: v.optional(v.number()), // undefined => needs confirmation
    unit: v.string(), // e.g. "unidades", "bolsas"
    needsConfirmation: v.boolean(),
    aiSuggested: v.boolean(),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("fulfilled"),
      v.literal("rejected"),
    ),
    verifiedBy: v.optional(v.id("users")),
  })
    .index("by_project", ["projectId"])
    .index("by_status", ["status"]),

  pledges: defineTable({
    needId: v.id("materialNeeds"),
    projectId: v.id("projects"),
    donorName: v.string(),
    donorContact: v.string(), // private: coordinators only
    qty: v.number(),
    mode: v.union(
      v.literal("have_materials"),
      v.literal("will_buy"),
      v.literal("request_instructions"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("fulfilled"),
      v.literal("canceled"),
      v.literal("expired"),
    ),
    followToken: v.string(), // donor follows anonymized timeline with this
    expiresAt: v.number(),
    donorUserId: v.optional(v.id("users")), // set when a signed-in donor pledges
    /** Demo seed only: the simulated story date to show instead of _creationTime (seed inserts everything "now"). */
    seededAt: v.optional(v.number()),
  })
    .index("by_need_status", ["needId", "status"])
    .index("by_project", ["projectId"])
    .index("by_follow_token", ["followToken"])
    .index("by_donor_user", ["donorUserId"]),

  materialEvents: defineTable({
    needId: v.id("materialNeeds"),
    projectId: v.id("projects"),
    pledgeId: v.optional(v.id("pledges")),
    eventType: materialEventType,
    qty: v.number(),
    evidencePhotoId: v.optional(v.id("photos")),
    evidenceId: v.optional(v.id("evidence")),
    noteEs: v.optional(v.string()),
    noteEn: v.optional(v.string()),
    verifiedBy: v.id("users"),
  })
    .index("by_need", ["needId"])
    .index("by_project", ["projectId"]),

  // = "contributions". Original currency only, never FX-converted.
  donations: defineTable({
    projectId: v.optional(v.id("projects")),
    nonprofitId: v.optional(v.id("nonprofits")), // for general-fund (no project) contributions
    amount: v.number(),
    currency: v.string(),
    status: contributionStatus,
    donorName: v.optional(v.string()),
    externalReference: v.optional(v.string()),
    recordedBy: v.id("users"),
  }).index("by_project", ["projectId"]),

  expenses: defineTable({
    projectId: v.id("projects"),
    amount: v.number(),
    currency: v.string(),
    category: v.string(),
    receiptStorageId: v.optional(v.id("_storage")),
    reviewStatus,
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    recordedBy: v.optional(v.id("users")),
    supplierRegion: v.optional(v.string()), // coarse region of purchase (regional procurement)
    localLabor: v.optional(v.boolean()), // paid local labor
  }).index("by_project", ["projectId"]),

  // Evidence for material events / milestones. Originals (privateStorageId) are coordinator-only.
  // Public sees ONLY reviewStatus "approved" && publicApproved, via publicStorageId.
  evidence: defineTable({
    projectId: v.id("projects"),
    needId: v.optional(v.id("materialNeeds")),
    materialEventId: v.optional(v.id("materialEvents")),
    /** Receipt uploaded for a recorded expense (field "upload receipt" to-do). */
    expenseId: v.optional(v.id("expenses")),
    type: evidenceType,
    privateStorageId: v.optional(v.id("_storage")),
    publicStorageId: v.optional(v.id("_storage")),
    noteEs: v.optional(v.string()),
    noteEn: v.optional(v.string()),
    reviewStatus,
    publicApproved: v.boolean(),
    uploadedBy: v.id("users"),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  }).index("by_project", ["projectId"]),

  // Weekly transparency report: snapshot computed ONLY from real records in the period.
  weeklyReports: defineTable({
    nonprofitId: v.optional(v.id("nonprofits")),
    periodStart: v.number(),
    periodEnd: v.number(),
    snapshot: v.any(),
    summaryEs: v.string(),
    summaryEn: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
    generatedBy: v.optional(v.id("users")),
    reviewedBy: v.optional(v.id("users")),
    publishedAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
  }).index("by_status", ["status"]),

  milestones: defineTable({
    projectId: v.id("projects"),
    type: v.union(
      v.literal("need_reported"),
      v.literal("approved"),
      v.literal("published"),
      v.literal("pledge"),
      v.literal("received"),
      v.literal("delivered"),
      v.literal("used"),
      v.literal("verified"),
      v.literal("expense"),
      v.literal("outcome"),
      v.literal("paused"),
    ),
    status: v.union(v.literal("pending"), v.literal("verified")),
    verifiedBy: v.optional(v.id("users")),
    occurredAt: v.number(),
    publicDescriptionEs: v.string(),
    publicDescriptionEn: v.string(),
    photoId: v.optional(v.id("photos")),
    evidenceId: v.optional(v.id("evidence")), // shown publicly only if evidence is approved+publicApproved
    expenseId: v.optional(v.id("expenses")), // set on "expense" milestones so a later receipt can attach
  }).index("by_project_time", ["projectId", "occurredAt"]),

  auditEvents: defineTable({
    actorId: v.optional(v.id("users")),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    beforeAfterSummary: v.optional(v.string()),
  }).index("by_entity", ["entityType", "entityId"]),

  // Community voice: moderated questions/concerns/thanks. Public sees only approved rows,
  // never `contactPrivate`. Coordinators moderate and may answer bilingually.
  communityFeedback: defineTable({
    projectId: v.optional(v.id("projects")),
    category: v.optional(category),
    kind: v.union(
      v.literal("question"),
      v.literal("concern"),
      v.literal("thanks"),
      v.literal("suggestion"),
    ),
    message: v.string(),
    language: locale,
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("hidden")),
    contactPrivate: v.optional(v.string()),
    responseEs: v.optional(v.string()),
    responseEn: v.optional(v.string()),
    respondedBy: v.optional(v.id("users")),
    respondedAt: v.optional(v.number()),
    authorUserId: v.optional(v.id("users")),
    isDemo: v.boolean(),
    /** Demo seed only: the simulated story date to show instead of _creationTime (seed inserts everything "now"). */
    seededAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_project_status", ["projectId", "status"]),

  // Field follow-ups on published projects (progress notes/photos). Coordinator reviews before public.
  fieldFollowUps: defineTable({
    projectId: v.id("projects"),
    noteEs: v.optional(v.string()),
    noteEn: v.optional(v.string()),
    photoId: v.optional(v.id("photos")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdBy: v.id("users"),
    reviewedBy: v.optional(v.id("users")),
  }).index("by_project", ["projectId"]),
});
