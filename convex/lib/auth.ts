import { ConvexError, v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Demo auth (hackathon): the client holds an opaque session token (from `sessions.signInAsDemo`)
 * and passes it as `sessionToken` to every non-public function. Authorization is enforced HERE,
 * server-side, never only in the UI. Swap for Convex Auth / Clerk post-hackathon.
 */
export const sessionArg = { sessionToken: v.string() };

export type Role = Doc<"users">["role"];

export async function getUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined,
): Promise<Doc<"users"> | null> {
  if (!sessionToken) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined,
  roles: Role[],
): Promise<Doc<"users">> {
  const user = await getUser(ctx, sessionToken);
  if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
  if (!roles.includes(user.role)) throw new ConvexError({ code: "FORBIDDEN", role: user.role });
  return user;
}

/** Field worker who created the project, or a coordinator of the same nonprofit. */
export async function canSeePrivate(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  projectId: Id<"projects">,
): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return false;
  if (user.role === "coordinator") return user.nonprofitId === project.nonprofitId;
  if (user.role === "field_worker") return project.createdBy === user._id;
  return false;
}

export async function audit(
  ctx: MutationCtx,
  actorId: Id<"users"> | undefined,
  entityType: string,
  entityId: string,
  action: string,
  beforeAfterSummary?: string,
) {
  await ctx.db.insert("auditEvents", { actorId, entityType, entityId, action, beforeAfterSummary });
}
