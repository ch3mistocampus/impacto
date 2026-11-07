import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";
import { followPledgeData, followPledgeResult } from "./public";

/**
 * Donor home (role: donor). Pledges tied to the signed-in donor account via pledges.donorUserId.
 * Each row has exactly the same allowlisted shape as public.followPledge (the donor's own
 * pledge only: own name, own follow token; never other donors or private project data).
 */
export const myPledges = query({
  args: { sessionToken: v.string() },
  returns: v.array(followPledgeResult),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, args.sessionToken, ["donor"]);
    const pledges = await ctx.db
      .query("pledges")
      .withIndex("by_donor_user", (q) => q.eq("donorUserId", user._id))
      .order("desc")
      .take(100);
    const out = [];
    for (const p of pledges) {
      const r = await followPledgeData(ctx, p.followToken);
      if (r) out.push(r);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});
