import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type NeedLedger = {
  requested: number | null; // null => needs confirmation (cannot pledge)
  pledged: number; // active pledges only
  received: number;
  used: number;
  availableToPledge: number;
};

/**
 * Single source of truth for need quantities. Use inside mutations so the
 * over-pledge check is transactional (Convex mutations are serializable).
 */
export async function computeLedger(
  ctx: QueryCtx | MutationCtx,
  needId: Id<"materialNeeds">,
): Promise<NeedLedger> {
  const need = await ctx.db.get(needId);
  if (!need) throw new Error("need not found");

  const active = await ctx.db
    .query("pledges")
    .withIndex("by_need_status", (q) => q.eq("needId", needId).eq("status", "active"))
    .collect();
  const pledged = active.reduce((s, p) => s + p.qty, 0);

  const events = await ctx.db
    .query("materialEvents")
    .withIndex("by_need", (q) => q.eq("needId", needId))
    .collect();
  let received = 0;
  let used = 0;
  let returned = 0;
  // Receipts tied to a still-active pledge are already counted in `pledged`.
  let receivedOutsideActivePledges = 0;
  const activeIds = new Set(active.map((p) => p._id));
  for (const e of events) {
    if (e.eventType === "received") {
      received += e.qty;
      if (!e.pledgeId || !activeIds.has(e.pledgeId)) receivedOutsideActivePledges += e.qty;
    } else if (e.eventType === "used") used += e.qty;
    else if (e.eventType === "returned") returned += e.qty;
  }
  received -= returned;
  receivedOutsideActivePledges -= returned;

  const requested = need.needsConfirmation || need.requestedQty === undefined ? null : need.requestedQty;
  const availableToPledge =
    requested === null ? 0 : Math.max(0, requested - pledged - receivedOutsideActivePledges);

  return { requested, pledged, received, used, availableToPledge };
}
