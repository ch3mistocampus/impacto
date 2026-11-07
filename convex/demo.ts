import { internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireRole, sessionArg, audit } from "./lib/auth";
import { seedAll, seedReturns } from "./seed";
import { DEMO_USERS, PROJECTS } from "./seedData";

/**
 * Demo controls for rehearsals. Only active when the deployment env var DEMO_MODE is "true"
 * (`npx convex env set DEMO_MODE true`). Never enable it on a deployment holding real data:
 * a reset wipes every project created by a demo persona.
 */
function demoModeEnabled() {
  return process.env.DEMO_MODE === "true";
}

/** Whether the "Reset demo" control is available on this deployment. */
export const isEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async () => demoModeEnabled(),
});

/** Coordinator-only reset of all synthetic demo data (same logic as `seed:resetDemo`). */
export const resetDemoFromUI = mutation({
  args: sessionArg,
  returns: seedReturns,
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["coordinator"]);
    if (!demoModeEnabled()) throw new ConvexError({ code: "FORBIDDEN", reason: "DEMO_MODE_DISABLED" });
    const result = await seedAll(ctx);
    await audit(ctx, user._id, "demo", "reset", "reset_demo", `wiped ${result.wipedProjects} projects`);
    return result;
  },
});

// ---------------------------------------------------------------------------
// Canonical-state checks (used by the e2e smoke test and the presenter page)
// ---------------------------------------------------------------------------

const LIVE = PROJECTS.find((p) => p.key === "live_demo")!;
/** Public alias of the live judging-demo project ("Reconstrucción 021"). */
export const LIVE_DEMO_ALIAS = LIVE.alias;

const STATUSES = ["draft", "in_review", "published", "paused", "completed", "rejected"] as const;

/** Every demo project (isDemo), across statuses. Bounded: the demo dataset is ~20 projects. */
async function demoProjects(ctx: QueryCtx) {
  const out: Doc<"projects">[] = [];
  for (const status of STATUSES) {
    const rows = await ctx.db.query("projects").withIndex("by_status", (q) => q.eq("status", status)).take(500);
    for (const p of rows) if (p.isDemo) out.push(p);
  }
  return out;
}

async function liveProjects(ctx: QueryCtx) {
  return (await demoProjects(ctx)).filter((p) => p.publicAlias === LIVE_DEMO_ALIAS);
}

/**
 * Public, privacy-safe demo status for the presenter page / preflight. No private fields:
 * only booleans, counts and the live project's id + status.
 */
export const status = query({
  args: {},
  returns: v.object({
    demoMode: v.boolean(),
    liveProjectExists: v.boolean(),
    liveProjectId: v.union(v.id("projects"), v.null()),
    liveStatus: v.union(v.string(), v.null()),
    liveInReview: v.boolean(),
    /** Every need on the live project is still a draft (nothing approved/published yet). */
    liveNeedsDraft: v.boolean(),
    /** Active (not received/canceled/expired) pledges on the live project's needs. */
    liveActivePledges: v.number(),
  }),
  handler: async (ctx) => {
    const live = (await liveProjects(ctx))[0] ?? null;
    if (!live) {
      return {
        demoMode: demoModeEnabled(),
        liveProjectExists: false,
        liveProjectId: null,
        liveStatus: null,
        liveInReview: false,
        liveNeedsDraft: false,
        liveActivePledges: 0,
      };
    }
    const needs = await ctx.db.query("materialNeeds").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(100);
    const pledges = await ctx.db.query("pledges").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(1000);
    return {
      demoMode: demoModeEnabled(),
      liveProjectExists: true,
      liveProjectId: live._id,
      liveStatus: live.status,
      liveInReview: live.status === "in_review",
      liveNeedsDraft: needs.length > 0 && needs.every((n) => n.status === "draft"),
      liveActivePledges: pledges.filter((p) => p.status === "active").length,
    };
  },
});

const canonicalReturns = v.object({
  ok: v.boolean(),
  checks: v.record(v.string(), v.boolean()),
  counts: v.object({
    demoProjects: v.number(),
    expectedDemoProjects: v.number(),
    livePledges: v.number(),
    liveEvents: v.number(),
    liveEvidence: v.number(),
    liveMilestones: v.number(),
    demoPledges: v.number(),
    expectedDemoPledges: v.number(),
  }),
  /** Primary persona id per role (ids are opaque; used to assert they are stable across resets). */
  personaIds: v.record(v.string(), v.string()),
});

async function checkCanonicalImpl(ctx: QueryCtx) {
  const projects = await demoProjects(ctx);
  const lives = projects.filter((p) => p.publicAlias === LIVE_DEMO_ALIAS);
  const live = lives[0];
  const checks: Record<string, boolean> = {};
  const counts = {
    demoProjects: projects.length,
    expectedDemoProjects: PROJECTS.length,
    livePledges: 0,
    liveEvents: 0,
    liveEvidence: 0,
    liveMilestones: 0,
    demoPledges: 0,
    expectedDemoPledges: PROJECTS.reduce((a, p) => a + p.needs.reduce((b, n) => b + (n.pledges?.length ?? 0), 0), 0),
  };

  checks.liveUnique = lives.length === 1;
  checks.liveInReview = live?.status === "in_review";
  if (live) {
    const needs = await ctx.db.query("materialNeeds").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(100);
    const by = (k: string) => needs.filter((n) => n.itemKey === k);
    const bricks = by("bricks");
    const cement = by("cement_bag");
    const roof = by("zinc_sheet");
    checks.liveNeedsCount = needs.length === LIVE.needs.length;
    checks.liveNeedsAllDraft = needs.every((n) => n.status === "draft");
    checks.bricks200 = bricks.length === 1 && bricks[0].requestedQty === 200;
    checks.cement15 = cement.length === 1 && cement[0].requestedQty === 15;
    checks.roofUnconfirmed = roof.length === 1 && roof[0].requestedQty === undefined && roof[0].needsConfirmation;
    const priv = await ctx.db.query("projectPrivate").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(5);
    checks.livePrivatePresent =
      priv.length === 1 && !!priv[0].beneficiaryName?.trim() && !!priv[0].privateAddress?.trim() && !!priv[0].contact?.trim();
    const pledges = await ctx.db.query("pledges").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(1000);
    const events = await ctx.db.query("materialEvents").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(1000);
    const evidence = await ctx.db.query("evidence").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(500);
    const milestones = await ctx.db
      .query("milestones")
      .withIndex("by_project_time", (q) => q.eq("projectId", live._id))
      .take(1000);
    counts.livePledges = pledges.length;
    counts.liveEvents = events.length;
    counts.liveEvidence = evidence.length;
    counts.liveMilestones = milestones.length;
    checks.liveNoPledges = pledges.length === 0;
    checks.liveNoEvents = events.length === 0 && evidence.length === 0;
    checks.liveTimelineOnlyNeedReported = milestones.length === 1 && milestones[0].type === "need_reported";
    const reports = await ctx.db.query("fieldReports").withIndex("by_project", (q) => q.eq("projectId", live._id)).take(10);
    checks.liveReportSubmitted = reports.length === 1 && reports[0].reviewStatus === "submitted";
  }

  // Other projects: exactly the seeded set (by alias + status), nothing left over from a run.
  const expected = new Map(PROJECTS.map((p) => [p.alias, p.status]));
  checks.projectsExact =
    projects.length === PROJECTS.length && projects.every((p) => expected.get(p.publicAlias) === p.status);
  let demoPledges = 0;
  for (const p of projects) {
    demoPledges += (await ctx.db.query("pledges").withIndex("by_project", (q) => q.eq("projectId", p._id)).take(1000)).length;
  }
  counts.demoPledges = demoPledges;
  checks.pledgesExact = demoPledges === counts.expectedDemoPledges;

  // Personas: each seeded email exists once, and the primary per role is what signInAsDemo picks.
  const personaIds: Record<string, string> = {};
  let personasOk = true;
  for (const role of [...new Set(DEMO_USERS.map((u) => u.role))]) {
    const rows = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", role)).take(50)).filter((u) => u.isDemo);
    const primary = DEMO_USERS.find((u) => u.role === role)!;
    const first = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", role)).first();
    if (!first || first.email !== primary.email) personasOk = false;
    for (const u of DEMO_USERS.filter((x) => x.role === role)) {
      if (rows.filter((r) => r.email === u.email).length !== 1) personasOk = false;
    }
    if (first) personaIds[role] = first._id;
  }
  checks.personasStable = personasOk;

  return { ok: Object.values(checks).every(Boolean), checks, counts, personaIds };
}

/**
 * Whether the deployment is in the canonical pre-demo state (right after `seed:resetDemo`).
 * Booleans + counts only, no private data. CLI: `npx convex run demo:checkCanonical`.
 */
export const checkCanonical = internalQuery({
  args: {},
  returns: canonicalReturns,
  handler: async (ctx) => await checkCanonicalImpl(ctx),
});

/** Same check for a signed-in coordinator (presenter page / coordinator UI). */
export const checkCanonicalForCoordinator = query({
  args: sessionArg,
  returns: canonicalReturns,
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, ["coordinator"]);
    return await checkCanonicalImpl(ctx);
  },
});
