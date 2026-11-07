"use client";

/**
 * Small Tricolor helpers for the public report pages (transparency dashboard, project detail).
 * Built on the shared kit in src/components/ui/tricolor.tsx.
 */
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Chip, STATUS_TONE, intlLocale } from "@/components/ui/tricolor";
import type { PublicStatus } from "./types";

/** es-CO / en-US date formatters for report pages. */
export function useReportFmt() {
  const { locale } = useI18n();
  const tag = intlLocale(locale);
  return {
    date: (ms: number) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" }).format(ms),
    short: (ms: number) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(ms),
    medium: (ms: number) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric" }).format(ms),
    num: (n: number) => n.toLocaleString(tag),
  };
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
      <rect x="2.5" y="2" width="2.5" height="8" fill="currentColor" />
      <rect x="7" y="2" width="2.5" height="8" fill="currentColor" />
    </svg>
  );
}

/** Project status chip. Tone comes from the kit's STATUS_TONE; a safety pause is calm navy. */
export function ProjectStatusChip({ status, className = "" }: { status: PublicStatus; className?: string }) {
  const { t } = useI18n();
  return (
    <Chip tone={STATUS_TONE[status]} className={className}>
      {status === "paused" && <PauseGlyph />}
      {t(`status.${status}`)}
    </Chip>
  );
}

/** Report section heading: Bodoni title over a hairline, optional muted lead. */
export function ReportHeading({
  id,
  title,
  lead,
  mark,
  level = 2,
  className = "",
}: {
  id?: string;
  title: ReactNode;
  lead?: ReactNode;
  mark?: ReactNode;
  level?: 2 | 3;
  className?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={`border-b border-border pb-3 ${className}`}>
      <H
        id={id}
        className={`flex items-center gap-3 font-display font-normal leading-tight ${
          level === 2 ? "text-[1.75rem] sm:text-[2.1rem]" : "text-xl sm:text-2xl"
        }`}
      >
        {mark}
        {title}
      </H>
      {lead && <p className="mt-1.5 text-[15px] text-muted leading-relaxed max-w-prose">{lead}</p>}
    </div>
  );
}

/** One "label ........ figure" line, like a printed ledger. */
export function LeaderRow({
  label,
  value,
  className = "",
  valueClass = "",
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <dt className="shrink-0">{label}</dt>
      <span aria-hidden className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-muted/60" />
      <dd className={`font-display tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}
