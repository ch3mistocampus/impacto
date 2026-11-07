"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import type { FollowPledgeData } from "./publicApi";
import { CheckIcon } from "./VerifiedBadge";
import { intlLocale } from "@/components/ui/tricolor";

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
  const { t, locale } = useI18n();
  const q = pledgeStageQty(data);
  const nf = new Intl.NumberFormat(intlLocale(locale));
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-5" aria-label={t("project.follow.status")}>
      {PLEDGE_STEPS.map((k, i) => {
        const done = q[k] > 0;
        const nextDone = i < PLEDGE_STEPS.length - 1 && q[PLEDGE_STEPS[i + 1]] > 0;
        // pledged = gold-ink outline (a promise); custody = navy; verified = esmeralda.
        const mark =
          k === "pledged"
            ? "bg-gold-soft text-gold-ink shadow-[inset_0_0_0_1.5px_var(--gold-ink)]"
            : k === "verified"
              ? "bg-emerald text-surface"
              : "bg-navy text-on-navy";
        const label = k === "pledged" ? "text-gold-ink" : k === "verified" ? "text-emerald" : "text-foreground";
        return (
          <li key={k} className="relative min-w-0 flex gap-3 pb-4 last:pb-0 sm:block sm:pb-0">
            {/* vertical connector on phones, horizontal from sm up */}
            {i < PLEDGE_STEPS.length - 1 && (
              <span
                aria-hidden
                className={`sm:hidden absolute top-0 bottom-0 w-px ${compact ? "left-3.5" : "left-[18px]"} ${nextDone ? "bg-rule" : "bg-border"}`}
              />
            )}
            <div className="flex items-center">
              <span
                className={`relative z-10 grid place-items-center ${compact ? "size-7" : "size-9"} shrink-0 rounded-full ${
                  done ? mark : "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--border)]"
                }`}
                aria-hidden
              >
                {done ? (
                  <CheckIcon className={compact ? "size-3.5" : "size-4"} />
                ) : (
                  <span className="font-display text-sm tabular-nums">{i + 1}</span>
                )}
              </span>
              {i < PLEDGE_STEPS.length - 1 && (
                <span className={`hidden sm:block h-px flex-1 ${nextDone ? "bg-rule" : "bg-border"}`} aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex flex-1 items-baseline justify-between gap-3 self-center sm:block">
              <p
                className={`sm:mt-2 sm:pr-1 text-sm sm:text-xs ${compact ? "" : "sm:text-sm"} leading-tight ${
                  done ? `font-semibold ${label}` : "text-muted"
                }`}
              >
                {t(`project.follow.step.${k}` as DictKey)}
                <span className="sr-only">{done ? " ✓" : ""}</span>
              </p>
              {k !== "pledged" && done && (
                <p className="sm:mt-0.5 text-xs text-muted tabular-nums">
                  {nf.format(q[k])} {t("project.follow.qtyOf")} {nf.format(data.qty)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "Verificado como usado: 50 ladrillos" — neutral wording for any material; only when something is verified. */
export function VerifiedHeadline({ data, className = "" }: { data: FollowPledgeData; className?: string }) {
  const { t, pick, locale } = useI18n();
  const n = pledgeStageQty(data).verified;
  if (n <= 0) return null;
  const name = pick(data.need.nameEs, data.need.nameEn).toLocaleLowerCase(locale);
  return (
    <p className={`font-display font-normal leading-snug text-emerald ${className}`}>
      {t("donations.verifiedAsUsed")}:{" "}
      <span className="tabular-nums">{new Intl.NumberFormat(intlLocale(locale)).format(n)}</span> {name}
    </p>
  );
}
