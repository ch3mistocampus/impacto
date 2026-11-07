"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { Chip, type ChipTone } from "@/components/ui/tricolor";
import { useReportFmt } from "./reportKit";
import type { EvidenceType, PublicEvidence } from "./publicApi";

/** Evidence is all nonprofit-approved: outlined ink chips; signed handovers read as verification. */
const TYPE_TONE: Record<EvidenceType, ChipTone> = {
  receipt: "navy",
  delivery_photo: "navy",
  handover_doc: "emerald",
  staff_note: "neutral",
  before_photo: "neutral",
  after_photo: "navy",
};

export function EvidenceTypeBadge({ type }: { type: EvidenceType }) {
  const { t } = useI18n();
  return <Chip tone={TYPE_TONE[type]}>{t(`evidence.${type}` as DictKey)}</Chip>;
}

function isImage(url: string | null) {
  // Notes/docs may have no file; PDFs shouldn't render as <img>.
  return !!url && !/\.pdf($|\?)/i.test(url);
}

/** Public, nonprofit-approved evidence only (redacted copies). */
export function EvidenceList({ items }: { items: PublicEvidence[] }) {
  const { t, pick } = useI18n();
  const fmt = useReportFmt();
  if (items.length === 0) return <p className="text-[15px] text-muted">{t("project.noEvidence")}</p>;
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {sorted.map((e) => {
        const note = pick(e.noteEs ?? undefined, e.noteEn ?? undefined);
        return (
          <li key={e.evidenceId} className="border border-border bg-surface">
            {isImage(e.url) && e.type !== "staff_note" && (
              <a href={e.url!} target="_blank" rel="noreferrer" className="block border-b border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.url!}
                  alt={note || t(`evidence.${e.type}` as DictKey)}
                  className="aspect-[4/3] w-full object-cover bg-paper"
                  loading="lazy"
                />
              </a>
            )}
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <EvidenceTypeBadge type={e.type} />
                <time className="text-[13px] text-muted tabular-nums" dateTime={new Date(e.createdAt).toISOString()}>
                  {fmt.date(e.createdAt)}
                </time>
              </div>
              {note && <p className="mt-2.5 text-[15px] leading-relaxed">{note}</p>}
              {e.url && !isImage(e.url) && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center text-[15px] font-semibold underline decoration-1 underline-offset-[5px] hover:decoration-2"
                >
                  {t(`evidence.${e.type}` as DictKey)} (PDF)
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
