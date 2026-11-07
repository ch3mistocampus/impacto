"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { LockGlyph } from "./CoordinatorGate";
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
    <section
      aria-label={t("coord.private")}
      className="rounded-lg p-[3px]"
      style={{
        background:
          "repeating-linear-gradient(135deg, var(--brick) 0 6px, transparent 6px 12px)",
      }}
    >
      <div
        className="rounded-[6px] p-4"
        style={{ background: "color-mix(in srgb, var(--surface) 92%, var(--brick))" }}
      >
        <header className="flex items-start gap-3">
          <LockGlyph className="h-6 w-6 shrink-0" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold text-brick">{t("coord.private")}</h2>
            <p className="text-xs text-muted">{t("coord.private.note")}</p>
          </div>
          {hasAny && (
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              aria-pressed={shown}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-brick ring-1 ring-brick/40 hover:bg-brick-soft"
            >
              {shown ? t("coord.private.hide") : t("coord.private.show")}
            </button>
          )}
        </header>
        {hasAny ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {rows.map(([k, v]) =>
              v ? (
                <div key={k} className="contents">
                  <dt className="text-muted">{t(k)}</dt>
                  <dd className={shown ? "" : "select-none blur-[5px]"} aria-hidden={!shown || undefined}>
                    {shown ? v : v.replace(/\S/g, "•")}
                  </dd>
                </div>
              ) : null,
            )}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("coord.private.none")}</p>
        )}
      </div>
    </section>
  );
}
