"use client";

import { useI18n } from "@/lib/i18n";
import { HATCH_AMBER, courses } from "./ledgerStyles";
import type { Ledger } from "./types";

type Row = {
  key: "requested" | "pledged" | "received" | "used";
  value: number;
  fill: React.CSSProperties;
  valueClass: string;
};

/**
 * Four separate courses — requested, pledged, received, used — each scaled to the
 * requested quantity. They are deliberately never stacked into one bar: a pledge is
 * not a delivery, and a delivery is not verified use.
 */
export function LedgerBar({
  ledger,
  unit,
  compact = false,
  showAvailable = true,
}: {
  ledger: Ledger;
  unit?: string;
  compact?: boolean;
  showAvailable?: boolean;
}) {
  const { t } = useI18n();
  const req = ledger.requested;

  if (req === null) {
    return (
      <div className="rounded-xl bg-amber-soft text-amber px-3 py-2 text-sm font-semibold">
        {t("ledger.needsConfirmation")}
      </div>
    );
  }

  const rows: Row[] = [
    { key: "pledged", value: ledger.pledged, fill: HATCH_AMBER, valueClass: "text-amber" },
    { key: "received", value: ledger.received, fill: courses("color-mix(in srgb, var(--sky) 45%, transparent)"), valueClass: "text-sky" },
    { key: "used", value: ledger.used, fill: courses("var(--sky)"), valueClass: "text-sky" },
  ];
  const pct = (v: number) => (req > 0 ? Math.min(100, (v / req) * 100) : 0);
  const h = compact ? "h-2.5" : "h-3.5";

  return (
    <div className="w-full">
      <dl className={compact ? "space-y-1.5" : "space-y-2.5"}>
        <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.5rem] items-center gap-x-3">
          <dt className="text-xs sm:text-sm text-muted truncate">{t("ledger.requested")}</dt>
          <div
            className={`${h} rounded-[3px] border border-foreground/35`}
            style={courses("transparent")}
            aria-hidden
          />
          <dd className="font-display font-semibold tabular-nums text-right">
            {req.toLocaleString()}
          </dd>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.5rem] items-center gap-x-3">
            <dt className="text-xs sm:text-sm text-muted truncate">{t(`ledger.${r.key}`)}</dt>
            <div className={`${h} rounded-[3px] bg-border/60 overflow-hidden`} aria-hidden>
              <div
                className="h-full rounded-[3px] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ ...r.fill, width: `${pct(r.value)}%` }}
              />
            </div>
            <dd className={`font-display font-semibold tabular-nums text-right ${r.valueClass}`}>
              {r.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      {showAvailable && (
        <p className={`${compact ? "mt-2" : "mt-3"} text-sm`}>
          <span className="text-muted">{t("ledger.available")}: </span>
          <strong className="font-display tabular-nums text-foreground">
            {ledger.availableToPledge.toLocaleString()}
          </strong>
          {unit && <span className="text-muted"> {unit}</span>}
        </p>
      )}
    </div>
  );
}
