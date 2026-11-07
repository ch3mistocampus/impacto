"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/donate/useReducedMotion";
import { useInViewOnce } from "./Reveal";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts up to `value` the first time it scrolls into view, and tweens between values when live
 * data changes afterwards. The animating digits are aria-hidden; screen readers get the final
 * number once, so an aria-live parent isn't flooded with intermediate frames.
 */
export function CountUp({
  value,
  format,
  duration = 1400,
  className = "",
  placeholder = "–",
}: {
  value: number | undefined;
  format: (n: number) => string;
  duration?: number;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInViewOnce(ref);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (value === undefined || !seen || reduced) return;
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const v = Math.round(start + (value - start) * easeOut(p));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, seen, reduced, duration]);

  return (
    <span ref={ref} className={className}>
      {value === undefined ? (
        placeholder
      ) : (
        <>
          <span aria-hidden>{format(reduced ? value : seen ? shown : 0)}</span>
          <span className="sr-only">{format(value)}</span>
        </>
      )}
    </span>
  );
}
