"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import type { FollowPledgeData } from "./publicApi";
import { CheckIcon } from "./VerifiedBadge";

export const PLEDGE_STEPS = ["pledged", "received", "delivered", "used", "verified"] as const;
export type PledgeStep = (typeof PLEDGE_STEPS)[number];

/** Optional per-pledge quantities Lane A2 may add; otherwise derived from the need ledger. */
type PerPledge = { deliveredQty?: number; usedQty?: number; verifiedQty?: number };

/**
 * Quantities of THIS pledge at each stage. Received is tracked per pledge; later stages are
 * tracked per need, so we attribute at most what this pledge actually delivered into custody
 * (never more than the need-level count). Pledging alone counts for nothing past step one.
 */
export function pledgeStageQty(d: FollowPledgeData & PerPledge): Record<PledgeStep, number> {
  const L = d.need.ledger;
  const received = d.receivedQty;
  const delivered = d.deliveredQty ?? Math.min(received, L.delivered);
  const used = d.usedQty ?? Math.min(delivered, L.used);
  const verified = d.verifiedQty ?? Math.min(used, L.verified);
  return { pledged: d.qty, received, delivered, used, verified };
}

export function PledgeProgress({ data, compact = false }: { data: FollowPledgeData; compact?: boolean }) {
  const { t } = useI18n();
  const q = pledgeStageQty(data);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t("project.follow.status")}>
      {PLEDGE_STEPS.map((k, i) => {
        const done = q[k] > 0;
        const nextDone = i < PLEDGE_STEPS.length - 1 && q[PLEDGE_STEPS[i + 1]] > 0;
        const color =
          k === "pledged" ? "bg-amber text-white" : k === "verified" ? "bg-leaf text-white" : "bg-sky text-white";
        return (
          <li key={k} className="relative min-w-0">
            <div className="flex items-center">
              <span
                className={`relative z-10 grid place-items-center ${compact ? "size-7" : "size-9"} shrink-0 rounded-full ${
                  done ? color : "border-2 border-border bg-surface text-muted"
                }`}
                aria-hidden
              >
                {done ? <CheckIcon className="size-4" /> : <span className="text-xs font-semibold">{i + 1}</span>}
              </span>
              {i < PLEDGE_STEPS.length - 1 && (
                <span className={`h-1 flex-1 ${nextDone ? "bg-sky" : "bg-border"}`} aria-hidden />
              )}
            </div>
            <p className={`mt-1.5 ${compact ? "text-[11px]" : "text-xs sm:text-sm"} leading-tight ${done ? "font-semibold" : "text-muted"}`}>
              {t(`project.follow.step.${k}` as DictKey)}
              <span className="sr-only">{done ? " ✓" : ""}</span>
            </p>
            {k !== "pledged" && done && (
              <p className="text-[11px] text-muted tabular-nums">
                {q[k]} {t("project.follow.qtyOf")} {data.qty}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** "50 ladrillos verificados como usados" — only when something is verified. */
export function VerifiedHeadline({ data, className = "" }: { data: FollowPledgeData; className?: string }) {
  const { t, pick, locale } = useI18n();
  const n = pledgeStageQty(data).verified;
  if (n <= 0) return null;
  const name = pick(data.need.nameEs, data.need.nameEn).toLocaleLowerCase(locale);
  return (
    <p className={`font-display font-semibold text-leaf ${className}`}>
      <span className="tabular-nums">{n.toLocaleString()}</span> {name} {t("donations.verifiedAsUsed")}
    </p>
  );
}
