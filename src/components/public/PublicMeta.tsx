"use client";

import { useI18n } from "@/lib/i18n";
import { Chip, STATUS_TONE, intlLocale } from "@/components/ui/tricolor";
import type { PublicStatus } from "./types";

/** Locale-aware date (and optional time) formatter shared by public views (es-CO / en-US). */
export function useDateFmt() {
  const { locale } = useI18n();
  const tag = intlLocale(locale);
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
 * Demo label + "as of" stamp for data pages, set like the dateline of an official report:
 * a small hairline-outlined "demo data" mark followed by the as-of time. Pairs with the global
 * demo bar in the header so synthetic figures are never mistaken for real operations.
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
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted ${className}`}>
      <span
        className="inline-flex items-center gap-1.5 rounded-[2px] px-1.5 py-0.5 font-semibold text-gold-ink shadow-[inset_0_0_0_1px_var(--gold)]"
        title={t("demo.explain")}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-gold" />
        {t("demo.label")}
      </span>
      {asOf != null && (
        <span>
          {t("asOf.label")}{" "}
          <time dateTime={new Date(asOf).toISOString()} className="font-display italic text-sm text-foreground tabular-nums">
            {fmt.dateTime(asOf)}
          </time>
        </span>
      )}
      {explain && <span className="basis-full">{t("demo.explain")}</span>}
    </div>
  );
}

/**
 * Per-card demo tag. Tricolor rule 8: demo labelling lives in the global header bar and the
 * page's DemoStamp, so cards no longer repeat it. Kept as an export so existing imports work.
 */
export function DemoTag(props: { className?: string }) {
  void props;
  return null;
}

/**
 * Status label per GOAL.md Update 2 mapping (tone from the kit's STATUS_TONE). Paused is a calm,
 * legitimate state (navy outline with a pause glyph) — never error-red.
 */
export function StatusBadge({ status, className = "" }: { status: PublicStatus; className?: string }) {
  const { t } = useI18n();
  return (
    <Chip tone={STATUS_TONE[status]} className={className}>
      {status === "paused" ? (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
          <rect x="2.5" y="2" width="2.5" height="8" fill="currentColor" />
          <rect x="7" y="2" width="2.5" height="8" fill="currentColor" />
        </svg>
      ) : status === "completed" ? (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden fill="none">
          <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ) : (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {t(`status.${status}`)}
    </Chip>
  );
}

/** Calm notice for safety-paused projects, with the generalized public reason. Navy, never red. */
export function PausedNotice({ reason, compact = false }: { reason: string | null; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className={`rounded-[2px] border-l-2 border-rule bg-navy-soft ${compact ? "px-4 py-3 text-sm" : "px-5 py-4"}`}
    >
      <p className={`flex items-center gap-2 font-display font-medium text-foreground ${compact ? "text-base" : "text-xl"}`}>
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <rect x="2.5" y="2" width="2.5" height="8" fill="currentColor" />
          <rect x="7" y="2" width="2.5" height="8" fill="currentColor" />
        </svg>
        {t("status.paused")}
      </p>
      <p className="mt-1 text-[15px]">{reason || t("project.pausedDefault")}</p>
      {!compact && <p className="mt-1 text-xs text-muted">{t("status.pausedExplain")}</p>}
    </div>
  );
}
