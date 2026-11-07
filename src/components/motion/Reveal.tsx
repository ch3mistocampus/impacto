"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * One shared IntersectionObserver for every reveal on the page (cheaper than one per element).
 * Elements are revealed once and then unobserved, so scrolling back up never re-hides content.
 */
type Listener = (visible: boolean) => void;
let shared: IntersectionObserver | null = null;
const listeners = new WeakMap<Element, Listener>();

function observe(el: Element, cb: Listener) {
  if (typeof IntersectionObserver === "undefined") {
    cb(true);
    return () => {};
  }
  shared ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) listeners.get(e.target)?.(e.isIntersecting);
    },
    // Fire a little before the element is fully in view so the motion is finishing as it lands.
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  listeners.set(el, cb);
  shared.observe(el);
  return () => {
    listeners.delete(el);
    shared?.unobserve(el);
  };
}

/** True once the element has scrolled into view (sticky: never flips back to false). */
export function useInViewOnce<T extends Element>(ref: RefObject<T | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const stop = observe(el, (visible) => {
      if (visible) {
        setSeen(true);
        stop();
      }
    });
    return stop;
  }, [ref, seen]);
  return seen;
}

/** Live visibility (flips both ways). Used to pause autoplay when a carousel is off screen. */
export function useInView<T extends Element>(ref: RefObject<T | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el, setVisible);
  }, [ref]);
  return visible;
}

export type RevealVariant = "rise" | "fade" | "left" | "right" | "scale" | "wipe";

/**
 * Scroll-triggered entrance. Content is only hidden when scripting is on (see globals.css),
 * and reduced-motion users get it immediately with no movement.
 *
 * `delay` (ms) staggers siblings: <Reveal delay={i * 80}>.
 */
export function Reveal({
  as,
  variant = "rise",
  delay = 0,
  className = "",
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);
  const shown = useInViewOnce(ref);
  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      data-shown={shown ? "" : undefined}
      className={className}
      style={{ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}
