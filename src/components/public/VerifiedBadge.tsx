"use client";

import { useI18n } from "@/lib/i18n";
import { Seal } from "@/components/ui/tricolor";

export function CheckIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

/**
 * Esmeralda = verified by the nonprofit. `label` overrides the default text.
 * `variant="seal"` renders the round gold-ringed "Espejo de Agua" seal (certificate moments).
 */
export function VerifiedBadge({
  label,
  compact = false,
  variant = "chip",
  className = "",
}: {
  label?: string;
  compact?: boolean;
  variant?: "chip" | "seal";
  className?: string;
}) {
  const { t } = useI18n();
  const text = label ?? t("badge.verified");

  if (variant === "seal") {
    return (
      <Seal size={compact ? 56 : 72} title={text} className={className}>
        <span aria-hidden>
          Espejo
          <br />
          de Agua
        </span>
        <span className="sr-only">{text}</span>
      </Seal>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-emerald font-semibold shadow-[inset_0_0_0_1px_var(--emerald)] ${
        compact ? "size-5 justify-center rounded-full" : "rounded-[2px] px-2 py-0.5 text-xs"
      } ${className}`}
      title={text}
    >
      <CheckIcon className={compact ? "size-3" : "size-3"} />
      {compact ? <span className="sr-only">{text}</span> : text}
    </span>
  );
}

/** Gold outline: recorded or promised, not yet verified. */
export function PendingBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-xs font-semibold text-gold-ink shadow-[inset_0_0_0_1px_var(--gold)] ${className}`}
    >
      <span className="size-2 rounded-full border border-current" aria-hidden />
      {label}
    </span>
  );
}
