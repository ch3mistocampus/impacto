"use client";

import { useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { LockIcon } from "./ui";

export type PhotoItem = { key: string; url: string | null; onRemove?: () => void };

/** Mobile camera capture + gallery picker. Parent owns the list (local files or uploaded photos). */
export function PhotoPicker({
  items,
  onAdd,
  disabled,
}: {
  items: PhotoItem[];
  onAdd: (files: File[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((p) => (
          <div key={p.key} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-background">
            {p.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute left-1 top-1 rounded-full bg-black/60 p-1 text-white">
              <LockIcon className="h-3 w-3" />
            </span>
            {p.onRemove && (
              <button
                type="button"
                onClick={p.onRemove}
                disabled={disabled}
                aria-label={t("field.photos.remove")}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg leading-none text-white"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-center text-xs font-medium text-muted"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="px-1">{t("field.photos.add")}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onAdd(files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("field.photos.private")}
      </p>
    </div>
  );
}
