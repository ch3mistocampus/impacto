import { HATCH_AMBER } from "./ledgerStyles";

export type StatTone = "requested" | "pledged" | "received" | "used";

const TONE: Record<StatTone, { chip: string; value: string }> = {
  requested: { chip: "border-2 border-foreground/40 bg-transparent", value: "text-foreground" },
  pledged: { chip: "", value: "text-amber" },
  received: { chip: "bg-sky/45", value: "text-sky" },
  used: { chip: "bg-sky", value: "text-sky" },
};

/** One ledger number. Each tone has its own swatch so the four states are never read as one. */
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
  const s = TONE[tone];
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span
        className={`size-3 shrink-0 self-center rounded-[3px] ${s.chip}`}
        style={tone === "pledged" ? HATCH_AMBER : undefined}
        aria-hidden
      />
      <span className="text-sm text-muted flex-1">
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </span>
      <span className={`font-display text-xl font-semibold tabular-nums ${s.value}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
