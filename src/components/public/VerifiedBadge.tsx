"use client";

import { useI18n } from "@/lib/i18n";

export function CheckIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Sky = verified by the nonprofit. `label` overrides the default text. */
export function VerifiedBadge({
  label,
  compact = false,
  className = "",
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const text = label ?? t("badge.verified");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-sky-soft text-sky font-semibold ${
        compact ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${className}`}
      title={text}
    >
      <span className="grid place-items-center size-4 rounded-full bg-sky text-white">
        <CheckIcon className="size-3" />
      </span>
      {compact ? <span className="sr-only">{text}</span> : text}
    </span>
  );
}

export function PendingBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-soft text-amber px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <span className="size-2 rounded-full border-2 border-amber" aria-hidden />
      {label}
    </span>
  );
}
