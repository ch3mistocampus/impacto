"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { Chip, DoubleRule } from "@/components/ui/tricolor";
import { LockIcon, inputCls } from "./ui";

export type PrivateState = { beneficiaryName: string; contact: string; privateAddress: string; privateNotes: string };

const FIELDS: { key: keyof PrivateState; label: DictKey; multiline?: boolean; autoComplete: string }[] = [
  { key: "beneficiaryName", label: "field.private.name", autoComplete: "off" },
  { key: "contact", label: "field.private.contact", autoComplete: "off" },
  { key: "privateAddress", label: "field.private.address", autoComplete: "off" },
  { key: "privateNotes", label: "field.private.notes", multiline: true, autoComplete: "off" },
];

/** Visually distinct restricted section. Saved only to projectPrivate; never public, never sent to AI. */
export function PrivateDetails({ value, onChange }: { value: PrivateState; onChange: (v: PrivateState) => void }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="private-title" className="rounded-[2px] border border-rule bg-paper p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-rule bg-surface text-foreground">
            <LockIcon className="h-5 w-5" />
          </span>
          <h2 id="private-title" className="font-display text-xl font-normal leading-tight">
            {t("field.private.title")}
          </h2>
        </div>
        <Chip tone="navy" className="mt-2.5 shrink-0">
          <LockIcon className="h-3 w-3" />
          {t("field.private.badge")}
        </Chip>
      </div>
      <DoubleRule className="mt-4" />
      <p className="mt-4 text-[15px] leading-relaxed text-muted">{t("field.private.body")}</p>
      <div className="mt-4 space-y-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm font-semibold text-foreground">
            {t(f.label)}
            {f.multiline ? (
              <textarea
                rows={3}
                value={value[f.key]}
                autoComplete={f.autoComplete}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                className={`${inputCls} mt-1.5 font-normal`}
              />
            ) : (
              <input
                value={value[f.key]}
                autoComplete={f.autoComplete}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                className={`${inputCls} mt-1.5 font-normal`}
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
