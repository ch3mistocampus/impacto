"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Visual tone of the confirm button. "danger" for destructive actions. */
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Accessible confirmation dialog built on the native <dialog> element (modal: focus is trapped,
 * the page behind is inert, Esc cancels). Initial focus goes to the safe "cancel" action, and
 * focus returns to the element that opened it. Labels are passed in so callers stay bilingual.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      cancelRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
      opener.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      onCancel={(e) => {
        // Esc: keep React state the source of truth.
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel) cancels.
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {title}
        </h2>
        {body && (
          <div id={bodyId} className="mt-2 text-sm leading-relaxed text-muted">
            {body}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md bg-surface px-4 py-2 text-sm font-medium ring-1 ring-border hover:bg-background disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50 ${
              tone === "danger" ? "bg-brick" : "bg-clay"
            }`}
          >
            {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
