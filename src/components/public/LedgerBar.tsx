"use client";

import { useI18n } from "@/lib/i18n";
import { STAGE_FILL, STAGE_TEXT, courses, stageSwatch } from "./ledgerStyles";
import { STAGES, type Ledger, type Stage } from "./types";

type Measured = Exclude<Stage, "requested">;
const MEASURED: Measured[] = ["pledged", "received", "delivered", "used", "verified"];

/**
 * Six separate courses — requested, pledged, received, delivered, used, verified — each
 * scaled to the requested quantity. Deliberately never stacked into one bar: a pledge is
 * not a delivery, and use is not impact until the nonprofit verifies it.
 */
export function LedgerBar({
  ledger,
  unit,
  compact = false,
  showAvailable = true,
  showLegend = false,
}: {
  ledger: Ledger;
  unit?: string;
  compact?: boolean;
  showAvailable?: boolean;
  showLegend?: boolean;
}) {
  const { t } = useI18n();
  const req = ledger.requested;

  if (req === null) {
    return (
      <div className="rounded-xl bg-amber-soft text-amber px-3 py-2 text-sm font-semibold">
        {t("stage.needsConfirmation")}
      </div>
    );
  }

  const pct = (v: number) => (req > 0 ? Math.min(100, (v / req) * 100) : 0);
  const h = compact ? "h-2" : "h-3";
  const grid = compact
    ? "grid grid-cols-[6.25rem_1fr_2.75rem] items-center gap-x-2.5"
    : "grid grid-cols-[minmax(0,6.5rem)_1fr_3.5rem] items-center gap-x-3";
  const label = compact ? "text-xs text-muted truncate" : "text-xs sm:text-sm text-muted truncate";
  const num = compact ? "text-sm" : "";

  return (
    <div className="w-full">
      <dl className={compact ? "space-y-1" : "space-y-2"}>
        <div className={grid}>
          <dt className={label}>{t("stage.requested")}</dt>
          <div className={`${h} rounded-[3px] border border-foreground/35`} style={courses("transparent")} aria-hidden />
          <dd className={`font-display font-semibold tabular-nums text-right ${num}`}>{req.toLocaleString()}</dd>
        </div>
        {MEASURED.map((k) => (
          <div key={k} className={grid}>
            <dt className={`${label} ${k === "verified" ? "!text-leaf font-semibold" : ""}`}>{t(`stage.${k}`)}</dt>
            <div className={`${h} rounded-[3px] bg-border/60 overflow-hidden`} aria-hidden>
              <div
                className="h-full rounded-[3px] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ ...STAGE_FILL[k], width: `${pct(ledger[k])}%` }}
              />
            </div>
            <dd className={`font-display font-semibold tabular-nums text-right ${num} ${STAGE_TEXT[k]}`}>
              {ledger[k].toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      {showAvailable && (
        <p className={`${compact ? "mt-2" : "mt-3"} text-sm`}>
          <span className="text-muted">{t("stage.available")}: </span>
          <strong className="font-display tabular-nums text-foreground">
            {ledger.availableToPledge.toLocaleString()}
          </strong>
          {unit && <span className="text-muted"> {unit}</span>}
        </p>
      )}
      {showLegend && <StageLegend className="mt-4" />}
    </div>
  );
}

/** Legend: one swatch + definition per stage, ending with "impact = verified only". */
export function StageLegend({ className = "", dense = false }: { className?: string; dense?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={className}>
      <ul className={dense ? "grid gap-1.5 sm:grid-cols-2 text-xs" : "space-y-2 text-sm"}>
        {STAGES.map((s) => (
          <li key={s} className="grid grid-cols-[0.8rem_1fr] gap-2 items-start">
            <span className="mt-1 size-3 rounded-[3px]" style={stageSwatch(s)} aria-hidden />
            <span>
              <strong className={s === "verified" ? "text-leaf" : undefined}>{t(`stage.${s}`)}.</strong>{" "}
              <span className="text-muted">{t(`stage.def.${s}`)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-2 font-semibold ${dense ? "text-xs" : "text-sm"}`}>
        <span className="text-leaf">{t("stage.impactNote")}</span>{" "}
        <span className="text-amber">{t("stage.pledgeIsNot")}</span>
      </p>
    </div>
  );
}

/** Inline banner used on donor cards and the pledge sheet. */
export function PledgeIsNotNote({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={`flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm font-semibold text-amber ${className}`}>
      <span className="mt-0.5 size-3.5 shrink-0 rounded-[3px]" style={stageSwatch("pledged")} aria-hidden />
      {t("stage.pledgeIsNot")}
    </p>
  );
}
