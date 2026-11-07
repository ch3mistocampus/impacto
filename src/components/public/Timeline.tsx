"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { PLEDGED_HATCH, intlLocale } from "@/components/ui/tricolor";
import { CheckIcon, PendingBadge, VerifiedBadge } from "./VerifiedBadge";

export type MilestoneType =
  | "need_reported"
  | "approved"
  | "published"
  | "pledge"
  | "received"
  | "delivered"
  | "used"
  | "verified"
  | "expense"
  | "outcome"
  | "paused";

export type TimelineItem = {
  id: string;
  type: MilestoneType | string;
  /** Public timeline only carries verified milestones; defaults to "verified". */
  status?: "pending" | "verified";
  occurredAt: number;
  descriptionEs?: string;
  descriptionEn?: string;
  photoUrl?: string | null;
  /** Proof attached to this step (field view may show it before review). */
  proof?: { url: string | null; label?: string; review?: "pending" | "approved" | "rejected" } | null;
};

const KNOWN = new Set<string>([
  "need_reported",
  "approved",
  "published",
  "pledge",
  "received",
  "delivered",
  "used",
  "verified",
  "expense",
  "outcome",
  "paused",
]);

/**
 * Node per step: hatched gold outline for promises, navy for custody, esmeralda for verified
 * impact. Paused is a calm navy outline (never red). Unverified = hollow hairline.
 */
function Node({ type, verified }: { type: string; verified: boolean }) {
  const base = "relative z-10 mt-1 grid place-items-center";
  if (type === "paused")
    return (
      <span className={`${base} size-4 bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--rule)]`} aria-hidden>
        <svg viewBox="0 0 12 12" className="size-2.5">
          <rect x="3" y="2.5" width="2" height="7" fill="currentColor" />
          <rect x="7" y="2.5" width="2" height="7" fill="currentColor" />
        </svg>
      </span>
    );
  if (type === "pledge")
    return <span className={`${base} size-4`} style={{ background: PLEDGED_HATCH, boxShadow: "inset 0 0 0 1px var(--gold)" }} aria-hidden />;
  if ((type === "outcome" || type === "verified") && verified)
    return (
      <span className={`${base} size-4 rounded-full bg-emerald text-on-navy`} aria-hidden>
        <CheckIcon className="size-3" />
      </span>
    );
  if (!verified) return <span className={`${base} size-4 bg-surface shadow-[inset_0_0_0_1px_var(--muted)]`} aria-hidden />;
  return <span className={`${base} size-4 bg-stage-used`} aria-hidden />;
}

/** Vertical need → impact timeline on a hairline. Oldest first, so it reads as a story. */
export function Timeline({ items, emptyLabel }: { items: TimelineItem[]; emptyLabel?: string }) {
  const { t, pick, locale } = useI18n();
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const sorted = [...items].sort((a, b) => a.occurredAt - b.occurredAt);

  if (sorted.length === 0) {
    return <p className="text-[15px] text-muted">{emptyLabel ?? t("project.timelineEmpty")}</p>;
  }

  return (
    <ol className="relative">
      {sorted.map((m, i) => {
        const verified = (m.status ?? "verified") === "verified";
        const isPledge = m.type === "pledge";
        const last = i === sorted.length - 1;
        const title = KNOWN.has(m.type) ? t(`project.milestone.${m.type}` as DictKey) : m.type;
        const desc = pick(m.descriptionEs, m.descriptionEn);
        return (
          <li key={m.id} className="relative grid grid-cols-[1rem_1fr] gap-x-4 pb-7 last:pb-0">
            {!last && <span className="absolute left-[7.5px] top-2 bottom-0 w-px bg-rule/30" aria-hidden />}
            <Node type={m.type} verified={verified} />
            <div className="min-w-0">
              <time
                className="block text-[13px] text-muted tabular-nums"
                dateTime={new Date(m.occurredAt).toISOString()}
              >
                {fmt.format(m.occurredAt)}
              </time>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className={`font-display text-lg font-normal leading-snug ${isPledge ? "text-gold-ink" : ""}`}>
                  {title}
                </h3>
                {/* Pledge milestones (incl. canceled/expired) are promises: no verified badge; the text says which. */}
                {isPledge || m.type === "paused" ? null : m.type === "used" ? (
                  // Use is recorded by staff but is not impact until a separate "verified" event.
                  <PendingBadge label={t("project.usedAwaiting")} />
                ) : verified ? (
                  <VerifiedBadge
                    compact={!["delivered", "verified", "outcome", "received"].includes(m.type)}
                    label={t("project.verifiedByOrg")}
                  />
                ) : (
                  <PendingBadge label={t("project.pending")} />
                )}
              </div>
              {desc && <p className="mt-1.5 text-[15px] leading-relaxed max-w-prose">{desc}</p>}
              {(m.proof?.url || m.photoUrl) && (
                <ProofThumb
                  url={(m.proof?.url || m.photoUrl)!}
                  alt={desc || title}
                  label={m.proof?.label}
                  review={m.proof?.review}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Map the public milestone validator shape onto TimelineItem. */
export function toTimelineItems(
  ms: {
    milestoneId: string;
    type: string;
    occurredAt: number;
    descriptionEs: string;
    descriptionEn: string;
    photoUrl: string | null;
  }[],
): TimelineItem[] {
  return ms.map((m) => ({
    id: m.milestoneId,
    type: m.type,
    occurredAt: m.occurredAt,
    descriptionEs: m.descriptionEs,
    descriptionEn: m.descriptionEn,
    photoUrl: m.photoUrl,
  }));
}

/** Small proof thumbnail ("Proof · Receipt") that opens the full image in a modal viewer. */
function ProofThumb({
  url,
  alt,
  label,
  review,
}: {
  url: string;
  alt: string;
  label?: string;
  review?: "pending" | "approved" | "rejected";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-3 flex items-stretch gap-3 border border-border bg-paper p-1.5 pr-3 text-left hover:border-rule focus-visible:border-rule"
        aria-label={`${t("project.proof.view")}: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-16 w-20 shrink-0 object-cover sm:h-20 sm:w-28" />
        <span className="flex flex-col justify-center gap-1">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            {t("project.proof")}
            {label ? ` · ${label}` : ""}
          </span>
          {review === "pending" ? (
            <PendingBadge label={t("project.proof.inReview")} className="self-start" />
          ) : review === "rejected" ? (
            <span className="text-[13px] text-muted">{t("project.proof.notApproved")}</span>
          ) : null}
          <span className="text-[13px] text-foreground underline-offset-4 group-hover:underline">{t("project.proof.view")} ↗</span>
        </span>
      </button>
      <dialog
        ref={ref}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={() => setOpen(false)}
        className="motion-dialog m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-2rem))] border border-border bg-surface p-0 backdrop:bg-black/60"
      >
        {open && (
          <figure className="p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} className="max-h-[calc(100dvh-8rem)] w-full object-contain" />
            <figcaption className="flex items-center justify-between gap-3 px-2 pt-2 text-sm">
              <span className="text-muted">{alt}</span>
              <button type="button" className="min-h-11 px-2 font-semibold underline-offset-4 hover:underline" onClick={() => setOpen(false)}>
                {t("project.proof.close")}
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
