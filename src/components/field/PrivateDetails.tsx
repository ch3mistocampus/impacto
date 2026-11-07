"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
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
    <section
      aria-labelledby="private-title"
      className="rounded-2xl border-2 border-dashed border-foreground/30 bg-[repeating-linear-gradient(135deg,var(--surface),var(--surface)_12px,var(--background)_12px,var(--background)_24px)] p-4 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
          <LockIcon />
        </span>
        <h2 id="private-title" className="font-display text-xl font-semibold">
          {t("field.private.title")}
        </h2>
      </div>
      <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-muted">{t("field.private.body")}</p>
      <div className="mt-4 space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm font-medium">
            {t(f.label)}
            {f.multiline ? (
              <textarea
                rows={3}
                value={value[f.key]}
                autoComplete={f.autoComplete}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                className={`${inputCls} mt-1 bg-surface`}
              />
            ) : (
              <input
                value={value[f.key]}
                autoComplete={f.autoComplete}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                className={`${inputCls} mt-1 bg-surface`}
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
