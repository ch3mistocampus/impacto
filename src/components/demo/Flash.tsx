"use client";

import { useEffect, useRef, type ReactNode } from "react";

const KEYFRAMES: Keyframe[] = [
  { backgroundColor: "var(--gold-soft)", boxShadow: "0 0 0 3px var(--gold)" },
  { backgroundColor: "transparent", boxShadow: "0 0 0 3px transparent" },
];

function flash(el: HTMLElement | null) {
  if (!el || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate?.(KEYFRAMES, { duration: 1600, easing: "ease-out" });
}

/** A number that briefly highlights when it changes (skipped under prefers-reduced-motion). */
export function FlashNumber({
  value,
  locale,
  className = "",
}: {
  value: number | string;
  /** BCP-47 locale for number formatting (use intlLocale()). */
  locale?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    flash(ref.current);
  }, [value]);
  return (
    <span ref={ref} className={`inline-block rounded-[2px] px-1 tabular-nums ${className}`}>
      {typeof value === "number" ? value.toLocaleString(locale) : value}
    </span>
  );
}

/** Wrapper that highlights once on mount when `active` (e.g. a timeline entry that just arrived). */
export function FlashOnMount({ active, children, className = "" }: { active: boolean; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) flash(ref.current);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
