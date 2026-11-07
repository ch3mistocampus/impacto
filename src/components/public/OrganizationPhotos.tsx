"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { Kicker } from "@/components/ui/tricolor";
import { useReducedMotion } from "@/components/donate/useReducedMotion";
import { Reveal, useInView } from "@/components/motion/Reveal";

const EMERGENCIA = "https://www.espejodeagua.org/emergencia.html";

const PHOTOS: { key: string; src: string; source: string; caption: DictKey; alt: DictKey; position?: string }[] = [
  { key: "roof", src: "/espejo-de-agua/ibanacuara-roof.webp", source: EMERGENCIA, caption: "landing.archive.roof.caption", alt: "landing.archive.roof.alt" },
  { key: "road", src: "/espejo-de-agua/earthquake-road.webp", source: EMERGENCIA, caption: "landing.archive.road.caption", alt: "landing.archive.road.alt" },
];

const INTERVAL = 6000;

/**
 * Official archive imagery retains its context, separate from the demo project's evidence.
 * Only photos without identifiable people are shown (the page promises "no names, no faces").
 *
 * Shown as a slow crossfade slideshow (gentle Ken Burns zoom). Autoplay pauses on hover, focus,
 * when off screen or the tab is hidden, and never runs under reduced motion; there is always a
 * visible pause button (WCAG 2.2.2), arrows, dots and swipe.
 */
export function OrganizationPhotos() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const onScreen = useInView(frame);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); // user pressed pause
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  const n = PHOTOS.length;
  const go = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);
  const playing = !reduced && !paused && !hovering && !focused && onScreen && !pageHidden;

  useEffect(() => {
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => go(index + 1), INTERVAL);
    return () => window.clearTimeout(id);
  }, [playing, index, go]);

  // Swipe (touch + pen + mouse drag).
  const startX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  };

  const photo = PHOTOS[index];

  return (
    <section id="official-archive" className="mt-20 scroll-mt-28 sm:mt-28" aria-labelledby="archive-title">
      <Reveal className="flex flex-col gap-5 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <Kicker>{t("landing.archive.kicker")}</Kicker>
          <h2 id="archive-title" className="mt-2 font-display text-[2rem] font-normal leading-tight sm:text-[2.75rem]">
            {t("landing.archive.title")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{t("landing.archive.body")}</p>
        </div>
        <a href="https://www.espejodeagua.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-3 text-sm font-semibold underline underline-offset-4">
          <Image src="/espejo-de-agua/logo.png" alt="" width={40} height={40} />
          {t("landing.archive.site")}
        </a>
      </Reveal>

      <Reveal
        variant="wipe"
        delay={80}
        className="mt-6"
        role="region"
        aria-roledescription={t("carousel.role")}
        aria-label={t("landing.archive.title")}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e: React.FocusEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
      >
        <div
          ref={frame}
          className="relative aspect-[4/3] touch-pan-y select-none overflow-hidden rounded-[2px] border border-border bg-paper sm:aspect-[2/1] xl:aspect-[5/2]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (startX.current = null)}
        >
          {PHOTOS.map((p, i) => (
            <div
              key={p.key}
              role="group"
              aria-roledescription={t("carousel.slide")}
              aria-label={`${i + 1} / ${n}`}
              aria-hidden={i !== index}
              className="carousel-slide absolute inset-0"
              data-active={i === index ? "" : undefined}
            >
              <Image
                src={p.src}
                alt={t(p.alt)}
                fill
                draggable={false}
                priority={i === 0}
                sizes="(min-width: 1152px) 1120px, 100vw"
                className="carousel-kenburns object-cover"
                style={{ objectPosition: p.position ?? "50% 50%" }}
              />
            </div>
          ))}

          {/* Controls sit on a soft scrim at the bottom of the frame. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 bg-gradient-to-t from-[rgb(8_22_48/0.55)] to-transparent p-3 pt-16 sm:p-4 sm:pt-20">
            <div className="pointer-events-auto flex items-center gap-1.5">
              {PHOTOS.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`${t("carousel.goTo")} ${i + 1}`}
                  aria-current={i === index}
                  className="group/dot grid h-11 place-items-center px-1"
                >
                  <span className="relative block h-[3px] w-8 overflow-hidden rounded-full bg-white/40 sm:w-12">
                    {i === index && (
                      <span
                        key={`${index}-${playing}`}
                        className="carousel-progress absolute inset-0 origin-left bg-white"
                        data-playing={playing ? "" : undefined}
                        style={{ animationDuration: `${INTERVAL}ms` }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="pointer-events-auto flex items-center gap-1">
              <CtrlButton label={paused ? t("carousel.play") : t("carousel.pause")} onClick={() => setPaused((v) => !v)}>
                {paused ? <path d="M6 4.5v11l9-5.5z" fill="currentColor" /> : <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" />}
              </CtrlButton>
              <CtrlButton label={t("carousel.prev")} onClick={() => go(index - 1)}>
                <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </CtrlButton>
              <CtrlButton label={t("carousel.next")} onClick={() => go(index + 1)}>
                <path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </CtrlButton>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6" aria-live="polite">
          <p key={photo.key} className="motion-rise font-display text-xl">
            {t(photo.caption)}
          </p>
          <a href={photo.source} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4">
            {t("landing.archive.credit")}
          </a>
        </div>
      </Reveal>
    </section>
  );
}

function CtrlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="press grid size-11 place-items-center rounded-full text-white hover:bg-white/15 focus-visible:outline-white"
    >
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
