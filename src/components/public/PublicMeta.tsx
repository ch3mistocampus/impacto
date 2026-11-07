"use client";

import { useI18n } from "@/lib/i18n";
import type { PublicStatus } from "./types";

/** Locale-aware date (and optional time) formatter shared by public views. */
export function useDateFmt() {
  const { locale } = useI18n();
  const tag = locale === "es" ? "es-PR" : "en-US";
  return {
    date: (ms: number) =>
      new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" }).format(ms),
    dateTime: (ms: number) =>
      new Intl.DateTimeFormat(tag, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(ms),
    short: (ms: number) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(ms),
  };
}

/**
 * Conspicuous demo label + "as of" stamp. Every public-looking view carries one so synthetic
 * figures are never mistaken for real Espejo de Agua operations.
 */
export function DemoStamp({
  asOf,
  explain = false,
  className = "",
}: {
  asOf?: number | null;
  explain?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const fmt = useDateFmt();
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ${className}`}>
      <span
        className="inline-flex items-center gap-1.5 rounded-md border-2 border-dashed border-amber bg-amber-soft px-2 py-1 font-semibold text-amber"
        title={t("demo.explain")}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none">
          <path d="M8 1.5l6.5 12h-13L8 1.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 6.5v3M8 11.5v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {t("demo.label")}
      </span>
      {asOf != null && (
        <span className="text-muted">
          {t("asOf.label")}:{" "}
          <time dateTime={new Date(asOf).toISOString()} className="font-semibold text-foreground tabular-nums">
            {fmt.dateTime(asOf)}
          </time>
        </span>
      )}
      {explain && <span className="basis-full text-muted">{t("demo.explain")}</span>}
    </div>
  );
}

/** Small corner tag for cards (deck cards, project rows). */
export function DemoTag({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center rounded border border-dashed border-amber bg-amber-soft px-1.5 py-0.5 text-[11px] font-semibold text-amber ${className}`}
    >
      {t("demo.label")}
    </span>
  );
}

/**
 * Status label per GOAL.md Update 2 mapping. Paused is a calm, legitimate state (slate/sky
 * outline with a pause glyph) — never error-red.
 */
export function StatusBadge({ status, className = "" }: { status: PublicStatus; className?: string }) {
  const { t } = useI18n();
  const style =
    status === "paused"
      ? "border-sky/60 bg-sky-soft text-sky"
      : status === "completed"
        ? "border-leaf/50 bg-leaf-soft text-leaf"
        : "border-border bg-surface text-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style} ${className}`}
    >
      {status === "paused" ? (
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <rect x="2.5" y="2" width="2.5" height="8" rx="0.8" fill="currentColor" />
          <rect x="7" y="2" width="2.5" height="8" rx="0.8" fill="currentColor" />
        </svg>
      ) : (
        <span
          className={`size-2 rounded-full ${status === "completed" ? "bg-leaf" : "bg-clay"}`}
          aria-hidden
        />
      )}
      {t(`status.${status}`)}
    </span>
  );
}

/** Calm notice for safety-paused projects, with the generalized public reason. */
export function PausedNotice({ reason, compact = false }: { reason: string | null; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className={`rounded-2xl border border-sky/40 bg-sky-soft ${compact ? "px-4 py-3 text-sm" : "px-5 py-4"}`}
    >
      <p className={`flex items-center gap-2 font-display font-semibold text-sky ${compact ? "text-base" : "text-xl"}`}>
        <svg viewBox="0 0 12 12" className="size-3.5" aria-hidden>
          <rect x="2.5" y="2" width="2.5" height="8" rx="0.8" fill="currentColor" />
          <rect x="7" y="2" width="2.5" height="8" rx="0.8" fill="currentColor" />
        </svg>
        {t("status.paused")}
      </p>
      <p className="mt-1 text-sm">{reason || t("project.pausedDefault")}</p>
      {!compact && <p className="mt-1 text-xs text-muted">{t("status.pausedExplain")}</p>}
    </div>
  );
}
