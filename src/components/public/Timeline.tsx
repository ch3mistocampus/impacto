"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { CheckIcon, PendingBadge, VerifiedBadge } from "./VerifiedBadge";

export type MilestoneType =
  | "need_reported"
  | "approved"
  | "published"
  | "pledge"
  | "received"
  | "used"
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
};

const KNOWN = new Set<string>([
  "need_reported",
  "approved",
  "published",
  "pledge",
  "received",
  "used",
  "expense",
  "outcome",
  "paused",
]);

/** Node colour per step: amber for promises, sky for confirmed, leaf for outcomes. */
function nodeClass(type: string, verified: boolean) {
  if (type === "paused") return "bg-amber text-white";
  if (type === "pledge") return "bg-amber-soft text-amber border-2 border-amber";
  if (type === "outcome" && verified) return "bg-leaf text-white";
  if (verified) return "bg-sky text-white";
  return "bg-surface text-muted border-2 border-border";
}

/** Vertical need → impact timeline. Oldest first, so it reads as a story. */
export function Timeline({ items, emptyLabel }: { items: TimelineItem[]; emptyLabel?: string }) {
  const { t, pick, locale } = useI18n();
  const fmt = new Intl.DateTimeFormat(locale === "es" ? "es-PR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const sorted = [...items].sort((a, b) => a.occurredAt - b.occurredAt);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel ?? t("project.timelineEmpty")}</p>;
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
          <li key={m.id} className="relative grid grid-cols-[2rem_1fr] gap-x-3 pb-6 last:pb-0">
            {!last && <span className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border" aria-hidden />}
            <span
              className={`relative z-10 grid place-items-center size-8 rounded-full ${nodeClass(m.type, verified)}`}
              aria-hidden
            >
              {verified && !isPledge ? <CheckIcon className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
            </span>
            <div className="pt-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-semibold">{title}</h3>
                {/* Pledge milestones (incl. canceled/expired) are promises: no verified badge; the text says which. */}
                {isPledge ? null : verified ? (
                  <VerifiedBadge compact label={t("project.verified")} />
                ) : (
                  <PendingBadge label={t("project.pending")} className="!py-0.5 !text-[11px]" />
                )}
              </div>
              <time className="block text-xs text-muted mt-0.5" dateTime={new Date(m.occurredAt).toISOString()}>
                {fmt.format(m.occurredAt)}
              </time>
              {desc && <p className="mt-1.5 text-sm leading-relaxed max-w-prose">{desc}</p>}
              {m.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photoUrl} alt={desc || title} className="mt-2 w-full max-w-sm rounded-lg border border-border" />
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
