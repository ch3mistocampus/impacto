import { STAGE_TEXT, stageSwatch } from "./ledgerStyles";
import type { Stage } from "./types";

export type StatTone = Stage;

/** One ledger number. Each stage has its own swatch so the six measures are never read as one. */
export function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone: StatTone;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="size-3 shrink-0 self-center rounded-[3px]" style={stageSwatch(tone)} aria-hidden />
      <span className={`text-sm flex-1 ${tone === "verified" ? "font-semibold text-leaf" : "text-muted"}`}>
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </span>
      <span className={`font-display text-xl font-semibold tabular-nums ${STAGE_TEXT[tone]}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
