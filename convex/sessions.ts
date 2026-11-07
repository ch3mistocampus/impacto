import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { role } from "./schema";
import { getUser } from "./lib/auth";

const DAY = 24 * 60 * 60 * 1000;

/** Demo-only: sign in as the seeded persona for a role. Returns an opaque token. */
export const signInAsDemo = mutation({
  args: { role },
  returns: v.object({ token: v.string(), userId: v.id("users") }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .first();
    if (!user || !user.isDemo) throw new Error("Demo user not seeded. Run `npx convex run seed:run`.");
    const token = crypto.randomUUID() + crypto.randomUUID();
    await ctx.db.insert("sessions", { token, userId: user._id, expiresAt: Date.now() + DAY });
    return { token, userId: user._id };
  },
});

export const signOut = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();
    if (s) await ctx.db.delete(s._id);
    return null;
  },
});

export const me = query({
  args: { sessionToken: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({ _id: v.id("users"), name: v.string(), role, locale: v.union(v.literal("es"), v.literal("en")) }),
  ),
  handler: async (ctx, args) => {
    const u = await getUser(ctx, args.sessionToken);
    if (!u) return null;
    return { _id: u._id, name: u.name, role: u.role, locale: u.locale };
  },
});
