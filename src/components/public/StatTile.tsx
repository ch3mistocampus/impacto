"use client";

import { useI18n } from "@/lib/i18n";
import { intlLocale } from "@/components/ui/tricolor";
import { STAGE_TEXT, stageSwatch } from "./ledgerStyles";
import type { Stage } from "./types";

export type StatTone = Stage;

/**
 * One ledger number as a dotted-leader row (label ·········· figure). Each stage keeps its own
 * swatch so the six measures are never read as one.
 */
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
  const { locale } = useI18n();
  const verified = tone === "verified";
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="size-2.5 shrink-0 self-center" style={stageSwatch(tone)} aria-hidden />
      <span className={`text-[15px] ${verified ? "font-semibold text-emerald" : tone === "pledged" ? "text-gold-ink" : "text-foreground"}`}>
        {label}
        {hint && <span className="block text-xs text-muted font-normal">{hint}</span>}
      </span>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-muted/60" />
      <span className={`font-display text-xl font-normal tabular-nums leading-none ${STAGE_TEXT[tone]}`}>
        {typeof value === "number" ? value.toLocaleString(intlLocale(locale)) : value}
      </span>
    </div>
  );
}
