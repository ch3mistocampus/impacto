import { shownAt } from "./lib/shownAt";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { category, locale } from "./schema";
import { audit, getUser, requireRole } from "./lib/auth";
import { PUBLIC_STATUSES, isPublicStatus, milestoneTypeValidator } from "./projects";

/**
 * Community voice (Update 2 §1.4: "feedback opportunities" for community members).
 *
 * - submitFeedback: no auth. Message is redacted server-side (emails, phone numbers, Colombian
 *   street addresses) BEFORE it is stored, so even an approved row can't leak them. The optional
 *   `contactPrivate` is coordinator-only and never returned by public queries.
 * - listApproved: public, explicit allowlist, approved rows only.
 * - listForModeration / moderate: coordinator role; every moderation is audited.
 *
 * Rate limiting is naive (length bounds only). Real per-IP/per-key limits
 * (@convex-dev/rate-limiter) are a roadmap item.
 */

const MAX_MESSAGE = 2000;
const MAX_CONTACT = 200;
const MAX_RESPONSE = 2000;

const kind = v.union(v.literal("question"), v.literal("concern"), v.literal("thanks"), v.literal("suggestion"));
const feedbackStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("hidden"));

export const REDACTION_MARK = { es: "[dato privado oculto]", en: "[private detail removed]" } as const;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 7+ digits, allowing up to two separators between digits: +57 300 123 4567, (604) 555-12-34, 3001234567
const PHONE = /\+?\d(?:[\s().-]{0,2}\d){6,}/g;
// Colombian street addresses: "Calle 12 # 34-56", "Cra. 7 No. 45", "Av 3N #12-30"
const ADDRESS =
  /\b(?:calle|cll?|carrera|cra|kra|kr|avenida|av|diagonal|dg|transversal|tv)\.?\s*\d+\s*[a-z]?\s*(?:bis\s*)?(?:#|no\.?|n°|nº|num\.?)\s*\d+\s*[a-z]?(?:\s*-\s*\d+)?/gi;

/** Replace obvious contact details with a marker. Returns the clean text and how many were removed. */
export function redactPersonalData(text: string, lang: "es" | "en"): { text: string; removed: number } {
  let removed = 0;
  const mark = REDACTION_MARK[lang];
  const rep = () => {
    removed++;
    return mark;
  };
  const out = text.replace(EMAIL, rep).replace(ADDRESS, rep).replace(PHONE, rep);
  return { text: out, removed };
}

function hasRedaction(text: string) {
  return text.includes(REDACTION_MARK.es) || text.includes(REDACTION_MARK.en);
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const submitFeedback = mutation({
  args: {
    kind,
    message: v.string(),
    language: locale,
    projectId: v.optional(v.id("projects")),
    contactPrivate: v.optional(v.string()),
    /** Optional: links the row to a signed-in demo user (any role). Never required. */
    sessionToken: v.optional(v.string()),
  },
  returns: v.object({ feedbackId: v.id("communityFeedback"), redactedCount: v.number() }),
  handler: async (ctx, args) => {
    const raw = args.message.trim();
    if (!raw) throw new ConvexError({ code: "EMPTY_MESSAGE" });
    if (raw.length > MAX_MESSAGE) throw new ConvexError({ code: "MESSAGE_TOO_LONG", max: MAX_MESSAGE });
    const contact = args.contactPrivate?.trim() || undefined;
    if (contact && contact.length > MAX_CONTACT) throw new ConvexError({ code: "CONTACT_TOO_LONG", max: MAX_CONTACT });

    let projectId: Id<"projects"> | undefined;
    let cat: Doc<"projects">["category"] | undefined;
    if (args.projectId) {
      const p = await ctx.db.get(args.projectId);
      if (!p || !isPublicStatus(p.status)) throw new ConvexError({ code: "PROJECT_NOT_PUBLIC" });
      projectId = p._id;
      cat = p.category;
    }

    const { text, removed } = redactPersonalData(raw, args.language);
    const author = await getUser(ctx, args.sessionToken);
    const feedbackId = await ctx.db.insert("communityFeedback", {
      projectId,
      category: cat,
      kind: args.kind,
      message: text,
      language: args.language,
      status: "pending",
      contactPrivate: contact,
      authorUserId: author?._id,
      isDemo: true,
    });
    await audit(
      ctx,
      author?._id,
      "communityFeedback",
      feedbackId,
      "submit",
      `kind=${args.kind} project=${projectId ?? "-"} redacted=${removed} contact=${contact ? 1 : 0}`,
    );
    return { feedbackId, redactedCount: removed };
  },
});

const approvedRow = v.object({
  feedbackId: v.id("communityFeedback"),
  kind,
  message: v.string(),
  language: locale,
  createdAt: v.number(),
  project: v.union(
    v.null(),
    v.object({ projectId: v.id("projects"), publicAlias: v.string(), category }),
  ),
  category: v.union(category, v.null()),
  responseEs: v.union(v.string(), v.null()),
  responseEn: v.union(v.string(), v.null()),
  respondedAt: v.union(v.number(), v.null()),
});

/** Approved community feedback (allowlist — never contactPrivate, author or moderator ids). */
export const listApproved = query({
  // string (not v.id) so a malformed URL param returns [] instead of throwing.
  args: { projectId: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(approvedRow),
  handler: async (ctx, args) => {
    const n = Math.max(1, Math.min(50, Math.floor(args.limit ?? 20)));
    const pid = args.projectId ? ctx.db.normalizeId("projects", args.projectId) : null;
    if (args.projectId && !pid) return [];
    const rows = pid
      ? await ctx.db
          .query("communityFeedback")
          .withIndex("by_project_status", (q) => q.eq("projectId", pid).eq("status", "approved"))
          .order("desc")
          .take(n)
      : await ctx.db
          .query("communityFeedback")
          .withIndex("by_status", (q) => q.eq("status", "approved"))
          .order("desc")
          .take(n);
    const out = [];
    for (const r of rows) {
      let project = null;
      if (r.projectId) {
        const p = await ctx.db.get(r.projectId);
        // Feedback about a project that is no longer public is not shown at all.
        if (!p || !isPublicStatus(p.status)) continue;
        project = { projectId: p._id, publicAlias: p.publicAlias, category: p.category };
      }
      out.push({
        feedbackId: r._id,
        kind: r.kind,
        message: r.message,
        language: r.language,
        createdAt: shownAt(r),
        project,
        category: r.category ?? null,
        responseEs: r.responseEs ?? null,
        responseEn: r.responseEn ?? null,
        respondedAt: r.respondedAt ?? null,
      });
    }
    return out;
  },
});

/**
 * Recent verified outcomes across public projects, for the community home. Coordinator-written
 * public milestone text only; no region, no photos, no names.
 */
export const recentOutcomes = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      milestoneId: v.id("milestones"),
      projectId: v.id("projects"),
      publicAlias: v.string(),
      category,
      type: milestoneTypeValidator,
      occurredAt: v.number(),
      descriptionEs: v.string(),
      descriptionEn: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const n = Math.max(1, Math.min(30, Math.floor(args.limit ?? 8)));
    const out = [];
    for (const s of PUBLIC_STATUSES) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_status", (q) => q.eq("status", s))
        .take(200);
      for (const p of projects) {
        const ms = await ctx.db
          .query("milestones")
          .withIndex("by_project_time", (q) => q.eq("projectId", p._id))
          .order("desc")
          .take(60);
        for (const m of ms) {
          if (m.status !== "verified" || (m.type !== "verified" && m.type !== "outcome")) continue;
          out.push({
            milestoneId: m._id,
            projectId: p._id,
            publicAlias: p.publicAlias,
            category: p.category,
            type: m.type,
            occurredAt: m.occurredAt,
            descriptionEs: m.publicDescriptionEs,
            descriptionEn: m.publicDescriptionEn,
          });
        }
      }
    }
    out.sort((a, b) => b.occurredAt - a.occurredAt);
    return out.slice(0, n);
  },
});

// ---------------------------------------------------------------------------
// Coordinator moderation
// ---------------------------------------------------------------------------

async function inCoordinatorScope(ctx: QueryCtx, user: Doc<"users">, row: Doc<"communityFeedback">) {
  if (!row.projectId) return true; // general feedback: any coordinator
  const p = await ctx.db.get(row.projectId);
  return !!p && p.nonprofitId === user.nonprofitId;
}

const moderationRow = v.object({
  feedbackId: v.id("communityFeedback"),
  kind,
  message: v.string(),
  language: locale,
  status: feedbackStatus,
  createdAt: v.number(),
  /** Message contained contact details that were removed before storage. */
  redacted: v.boolean(),
  /** PRIVATE: coordinator-only. */
  contactPrivate: v.union(v.string(), v.null()),
  authorRole: v.union(v.string(), v.null()),
  project: v.union(
    v.null(),
    v.object({ projectId: v.id("projects"), publicAlias: v.string(), category, status: v.string() }),
  ),
  responseEs: v.union(v.string(), v.null()),
  responseEn: v.union(v.string(), v.null()),
  respondedAt: v.union(v.number(), v.null()),
  respondedByName: v.union(v.string(), v.null()),
});

export const listForModeration = query({
  args: { sessionToken: v.string() },
  returns: v.object({ pendingCount: v.number(), rows: v.array(moderationRow) }),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["coordinator"]);
    const pending = await ctx.db
      .query("communityFeedback")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(200);
    const approved = await ctx.db
      .query("communityFeedback")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(50);
    const hidden = await ctx.db
      .query("communityFeedback")
      .withIndex("by_status", (q) => q.eq("status", "hidden"))
      .order("desc")
      .take(30);
    const rows = [];
    let pendingCount = 0;
    for (const r of [...pending, ...approved, ...hidden]) {
      if (!(await inCoordinatorScope(ctx, user, r))) continue;
      if (r.status === "pending") pendingCount++;
      const p = r.projectId ? await ctx.db.get(r.projectId) : null;
      const author = r.authorUserId ? await ctx.db.get(r.authorUserId) : null;
      const responder = r.respondedBy ? await ctx.db.get(r.respondedBy) : null;
      rows.push({
        feedbackId: r._id,
        kind: r.kind,
        message: r.message,
        language: r.language,
        status: r.status,
        createdAt: shownAt(r),
        redacted: hasRedaction(r.message),
        contactPrivate: r.contactPrivate ?? null,
        authorRole: author?.role ?? null,
        project: p ? { projectId: p._id, publicAlias: p.publicAlias, category: p.category, status: p.status } : null,
        responseEs: r.responseEs ?? null,
        responseEn: r.responseEn ?? null,
        respondedAt: r.respondedAt ?? null,
        respondedByName: responder?.name ?? null,
      });
    }
    return { pendingCount, rows };
  },
});

export const moderate = mutation({
  args: {
    sessionToken: v.string(),
    feedbackId: v.id("communityFeedback"),
    status: v.union(v.literal("approved"), v.literal("hidden")),
    responseEs: v.optional(v.string()),
    responseEn: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["coordinator"]);
    const row = await ctx.db.get(args.feedbackId);
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    if (!(await inCoordinatorScope(ctx, user, row))) throw new ConvexError({ code: "FORBIDDEN" });

    const es = args.responseEs?.trim();
    const en = args.responseEn?.trim();
    if ((es && es.length > MAX_RESPONSE) || (en && en.length > MAX_RESPONSE)) {
      throw new ConvexError({ code: "RESPONSE_TOO_LONG", max: MAX_RESPONSE });
    }
    // Coordinator answers are public too: apply the same redaction as a safety net.
    const esClean = es ? redactPersonalData(es, "es").text : undefined;
    const enClean = en ? redactPersonalData(en, "en").text : undefined;
    const answering = esClean !== undefined || enClean !== undefined;

    const patch: Partial<Doc<"communityFeedback">> = { status: args.status };
    if (answering) {
      patch.responseEs = esClean;
      patch.responseEn = enClean;
      patch.respondedBy = user._id;
      patch.respondedAt = Date.now();
    }
    await ctx.db.patch("communityFeedback", row._id, patch);
    await audit(
      ctx,
      user._id,
      "communityFeedback",
      row._id,
      args.status === "approved" ? "approve" : "hide",
      `status ${row.status}->${args.status}${answering ? ` response(es=${esClean ? 1 : 0},en=${enClean ? 1 : 0})` : ""}`,
    );
    return null;
  },
});
