"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { useDateFmt } from "./PublicMeta";
import type { EvidenceType, PublicEvidence } from "./publicApi";

const TYPE_STYLE: Record<EvidenceType, string> = {
  receipt: "bg-amber-soft text-amber",
  delivery_photo: "bg-sky-soft text-sky",
  handover_doc: "bg-leaf-soft text-leaf",
  staff_note: "bg-background text-foreground border border-border",
  before_photo: "bg-clay-soft text-clay",
  after_photo: "bg-leaf-soft text-leaf",
};

export function EvidenceTypeBadge({ type }: { type: EvidenceType }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLE[type]}`}>
      {t(`evidence.${type}` as DictKey)}
    </span>
  );
}

function isImage(url: string | null) {
  // Notes/docs may have no file; PDFs shouldn't render as <img>.
  return !!url && !/\.pdf($|\?)/i.test(url);
}

/** Public, nonprofit-approved evidence only (redacted copies). */
export function EvidenceList({ items }: { items: PublicEvidence[] }) {
  const { t, pick } = useI18n();
  const fmt = useDateFmt();
  if (items.length === 0) return <p className="text-sm text-muted">{t("project.noEvidence")}</p>;
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {sorted.map((e) => {
        const note = pick(e.noteEs ?? undefined, e.noteEn ?? undefined);
        return (
          <li key={e.evidenceId} className="rounded-2xl border border-border bg-surface overflow-hidden">
            {isImage(e.url) && e.type !== "staff_note" && (
              <a href={e.url!} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.url!}
                  alt={note || t(`evidence.${e.type}` as DictKey)}
                  className="aspect-[4/3] w-full object-cover bg-background"
                  loading="lazy"
                />
              </a>
            )}
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <EvidenceTypeBadge type={e.type} />
                <time className="text-xs text-muted" dateTime={new Date(e.createdAt).toISOString()}>
                  {fmt.date(e.createdAt)}
                </time>
              </div>
              {note && <p className="mt-2 text-sm leading-relaxed">{note}</p>}
              {e.url && !isImage(e.url) && (
                <a href={e.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold underline underline-offset-4">
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
