"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { prepareImageFile } from "@/lib/image";
import { LockIcon, Spinner, noticeCls } from "./ui";

export type PhotoItem = { key: string; url: string | null; onRemove?: () => void };

/**
 * Mobile camera capture + gallery picker. Parent owns the list (local files or uploaded photos).
 * Every picked file is re-encoded via `prepareImageForUpload` (EXIF/GPS stripped, max 1600px)
 * BEFORE `onAdd` — originals never leave the device. Geolocation is never requested.
 */
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
  const [processing, setProcessing] = useState(false);
  const [failed, setFailed] = useState(0);

  const handle = async (files: File[]) => {
    setProcessing(true);
    setFailed(0);
    const ok: File[] = [];
    let bad = 0;
    for (const f of files) {
      try {
        ok.push(await prepareImageFile(f));
      } catch (e) {
        console.error("image prepare failed", e);
        bad++;
      }
    }
    setProcessing(false);
    setFailed(bad);
    if (ok.length) onAdd(ok);
  };
  const busy = disabled || processing;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((p) => (
          <div key={p.key} className="relative aspect-square overflow-hidden border border-border bg-paper">
            {p.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute left-1 top-1 bg-[#0b2a5b]/80 p-1 text-white">
              <LockIcon className="h-3 w-3" />
            </span>
            {p.onRemove && (
              <button
                type="button"
                onClick={p.onRemove}
                disabled={disabled}
                aria-label={t("field.photos.remove")}
                className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1"
              >
                <span aria-hidden className="flex h-8 w-8 items-center justify-center bg-[#0b2a5b]/80 text-xl leading-none text-white">×</span>
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 border border-dashed border-rule/50 bg-paper text-center text-sm font-semibold text-foreground hover:border-rule disabled:opacity-60"
        >
          {processing ? (
            <Spinner className="h-7 w-7" />
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
          <span className="px-1">{t(processing ? "field.photos.processing" : "field.photos.add")}</span>
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
          if (files.length) void handle(files);
          e.target.value = "";
        }}
      />
      <p className="mt-3 flex items-start gap-1.5 text-sm text-muted">
        <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
        {t("field.photos.private")}
      </p>
      <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
        <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <path d="M4 4l16 16" strokeLinecap="round" />
        </svg>
        {t("field.photos.metaStripped")}
      </p>
      {failed > 0 && (
        <p role="alert" className={`mt-2 ${noticeCls}`}>
          {t("field.photos.failed")}
        </p>
      )}
    </div>
  );
}
