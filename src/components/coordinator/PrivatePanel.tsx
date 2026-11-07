"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { DoubleRule } from "@/components/ui/tricolor";
import { LockGlyph } from "./CoordinatorGate";
import { deskBtn } from "./ui";
import type { ReviewPrivate } from "./types";

/** Coordinator-only beneficiary details. Visually fenced off; values masked until revealed. */
export function PrivatePanel({ priv }: { priv: ReviewPrivate | null }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const rows: [DictKey, string | null][] = priv
    ? [
        ["coord.private.name", priv.beneficiaryName],
        ["coord.private.address", priv.privateAddress],
        ["coord.private.contact", priv.contact],
        ["coord.private.notes", priv.privateNotes],
      ]
    : [];
  const hasAny = rows.some(([, v]) => v);

  return (
    <section aria-label={t("coord.private")} className="rounded-[2px] border border-rule bg-paper px-4 pb-4 pt-4 sm:px-5">
      <header className="flex items-start gap-3">
        <LockGlyph className="mt-1 size-6" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-muted">{t("coord.private.restricted")}</p>
          <h2 className="font-display text-[22px] font-normal leading-tight">{t("coord.private")}</h2>
        </div>
        {hasAny && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            className={deskBtn("secondary", "sm")}
          >
            {shown ? t("coord.private.hide") : t("coord.private.show")}
          </button>
        )}
      </header>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{t("coord.private.note")}</p>
      <DoubleRule className="mt-3" />
      {hasAny ? (
        <dl className="mt-1 divide-y divide-border text-[15px]">
          {rows.map(([k, v]) =>
            v ? (
              <div key={k} className="grid grid-cols-[minmax(7rem,auto)_minmax(0,1fr)] gap-x-4 py-2.5">
                <dt className="text-sm text-muted">{t(k)}</dt>
                <dd className={`min-w-0 break-words ${shown ? "" : "select-none blur-[5px]"}`} aria-hidden={!shown || undefined}>
                  {shown ? v : v.replace(/\S/g, "•")}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("coord.private.none")}</p>
      )}
    </section>
  );
}
