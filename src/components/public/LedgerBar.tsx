"use client";

import { useI18n } from "@/lib/i18n";
import { intlLocale } from "@/components/ui/tricolor";
import { STAGE_FILL, STAGE_TEXT, stageSwatch } from "./ledgerStyles";
import { STAGES, type Ledger, type Stage } from "./types";

type Measured = Exclude<Stage, "requested">;
const MEASURED: Measured[] = ["pledged", "received", "delivered", "used", "verified"];

/**
 * Six separate rows — requested, pledged, received, delivered, used, verified — each scaled to
 * the requested quantity. Deliberately never stacked into one bar: a pledge is not a delivery,
 * and use is not impact until the nonprofit verifies it.
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
  const { t, locale } = useI18n();
  const nf = (n: number) => n.toLocaleString(intlLocale(locale));
  const req = ledger.requested;

  if (req === null) {
    return (
      <p className="flex items-center gap-2 border-y border-border py-2.5 text-sm font-semibold text-gold-ink">
        <span className="size-3 shrink-0" style={stageSwatch("requested")} aria-hidden />
        {t("stage.needsConfirmation")}
      </p>
    );
  }

  const pct = (v: number) => (req > 0 ? Math.min(100, (v / req) * 100) : 0);
  const track = compact ? "h-[5px]" : "h-1.5";
  const grid = compact
    ? "grid grid-cols-[6rem_1fr_3rem] items-center gap-x-3"
    : "grid grid-cols-[minmax(0,7.5rem)_1fr_4rem] items-center gap-x-3 sm:gap-x-4";
  const rowPad = compact ? "py-[3px]" : "py-1.5";
  const label = compact ? "text-[13px] text-muted truncate" : "text-sm text-muted truncate";
  const num = compact ? "text-[15px]" : "text-lg";

  return (
    <div className="w-full">
      <dl>
        <div className={`${grid} ${rowPad}`}>
          <dt className={label}>{t("stage.requested")}</dt>
          <div className={`${track} shadow-[inset_0_0_0_1px_var(--muted)]`} aria-hidden />
          <dd className={`font-display font-normal tabular-nums text-right leading-none ${num}`}>{nf(req)}</dd>
        </div>
        {MEASURED.map((k) => (
          <div key={k} className={`${grid} ${rowPad}`}>
            <dt className={`${label} ${k === "verified" ? "!text-emerald font-semibold" : k === "pledged" ? "!text-gold-ink" : ""}`}>
              {t(`stage.${k}`)}
            </dt>
            <div className={`${track} bg-stage-track overflow-hidden`} aria-hidden>
              <div
                className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ ...STAGE_FILL[k], width: `${pct(ledger[k])}%` }}
              />
            </div>
            <dd
              className={`font-display tabular-nums text-right leading-none ${num} ${STAGE_TEXT[k]} ${
                k === "verified" ? "font-medium" : "font-normal"
              }`}
            >
              {nf(ledger[k])}
            </dd>
          </div>
        ))}
      </dl>
      {showAvailable && (
        <p className={`${compact ? "mt-2 text-[13px]" : "mt-3 text-sm"} flex items-baseline gap-2 border-t border-border pt-2`}>
          <span className="text-muted">{t("stage.available")}</span>
          <span aria-hidden className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-muted/60" />
          <strong className={`font-display font-normal tabular-nums text-foreground ${compact ? "text-[15px]" : "text-lg"}`}>
            {nf(ledger.availableToPledge)}
          </strong>
          {unit && <span className="text-muted">{unit}</span>}
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
      <ul className={dense ? "grid gap-x-8 gap-y-2 sm:grid-cols-2 text-[13px]" : "space-y-2.5 text-sm"}>
        {STAGES.map((s) => (
          <li key={s} className="grid grid-cols-[0.75rem_1fr] gap-2.5 items-start leading-snug">
            <span className="mt-[3px] size-3" style={stageSwatch(s)} aria-hidden />
            <span>
              <strong
                className={`font-semibold ${s === "verified" ? "text-emerald" : s === "pledged" ? "text-gold-ink" : ""}`}
              >
                {t(`stage.${s}`)}.
              </strong>{" "}
              <span className="text-muted">{t(`stage.def.${s}`)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-3 border-t border-border pt-2.5 ${dense ? "text-[13px]" : "text-sm"}`}>
        <span className="font-semibold text-emerald">{t("stage.impactNote")}</span>{" "}
        <span className="text-gold-ink">{t("stage.pledgeIsNot")}</span>
      </p>
    </div>
  );
}

/** One refined line used on donor cards and the pledge sheet: hatched gold swatch + gold-ink text. */
export function PledgeIsNotNote({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={`flex items-center gap-2 text-sm font-semibold text-gold-ink ${className}`}>
      <span className="size-3 shrink-0" style={stageSwatch("pledged")} aria-hidden />
      {t("stage.pledgeIsNot")}
    </p>
  );
}
