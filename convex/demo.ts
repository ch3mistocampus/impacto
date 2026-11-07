import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireRole, sessionArg, audit } from "./lib/auth";
import { seedAll, seedReturns } from "./seed";

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
