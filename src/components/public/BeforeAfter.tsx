"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { Chip, Kicker, btn } from "@/components/ui/tricolor";
import { useReducedMotion } from "@/components/donate/useReducedMotion";
import { Reveal, useInViewOnce } from "@/components/motion/Reveal";

/**
 * Before = REAL Espejo de Agua photos (Ibanacuara earthquake), always credited and captioned in
 * their original context. After = AI-generated illustrations made from those photos, always
 * labelled "AI illustration" — never presented as finished work or delivery evidence.
 * Images are built by scripts/prepare-before-after.mjs (4:3, 1200×900, people cropped/blurred).
 * See docs/espejo-de-agua/README.md for usage rules.
 */
const SOURCE = "https://www.espejodeagua.org/galeria.html";
const PAIRS = [
  { key: "p1", file: "01-collapsed-zinc-roof", beforeAlt: "ba.collapsed.alt" },
  { key: "p2", file: "02-bare-bamboo-frame", beforeAlt: "ba.p2.beforeAlt" },
  { key: "p3", file: "03-tarp-walled-shelters", beforeAlt: "ba.p3.beforeAlt" },
] as const;
const img = (file: string, side: "before" | "after") => `/before-after/${file}-${side}.webp`;

function Credit() {
  const { t } = useI18n();
  return (
    <a href={SOURCE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4">
      {t("landing.archive.credit")}
    </a>
  );
}

/** Label pinned on the photo; solid background so it stays legible over any image. */
function Tag({ label, sub, className = "" }: { label: string; sub: string; className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute top-3 z-10 rounded-[2px] bg-background/90 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm transition-opacity duration-300 sm:top-4 sm:text-sm ${className}`}
    >
      {label} <span className="font-normal text-muted">· {sub}</span>
    </span>
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** The "look, it moves" sweep played when the slider first scrolls into view. */
const INTRO: [number, number][] = [[82, 900], [20, 1100], [50, 800]];
/** A shorter nudge when another place is picked. */
const NUDGE: [number, number][] = [[70, 450], [50, 450]];

/**
 * Big drag-anywhere comparison. Pointer drag works over the whole photo (touch keeps vertical
 * page scrolling via touch-action: pan-y); keyboard users get a real range input that drives the
 * same position and lights up the handle when focused.
 */
function Compare({ index }: { index: number }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(frame);
  const [pos, setPosState] = useState(50);
  const [touched, setTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const raf = useRef(0);
  const posRef = useRef(50);
  const setPos = useCallback((v: number) => {
    posRef.current = v;
    setPosState(v);
  }, []);

  const stopSweep = () => cancelAnimationFrame(raf.current);

  const sweep = useCallback((steps: [number, number][]) => {
    cancelAnimationFrame(raf.current);
    let i = 0;
    let from = posRef.current;
    let t0 = performance.now();
    const tick = (now: number) => {
      const [to, dur] = steps[i];
      const p = Math.min(1, (now - t0) / dur);
      setPos(from + (to - from) * easeInOut(p));
      if (p === 1) {
        i += 1;
        if (i === steps.length) return;
        from = to;
        t0 = now;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [setPos]);

  // Intro sweep the first time it is seen; a small nudge when the place changes.
  const firstRun = useRef(true);
  useEffect(() => {
    if (!seen || reduced || touched) return;
    const id = window.setTimeout(() => sweep(firstRun.current ? INTRO : NUDGE), firstRun.current ? 500 : 150);
    firstRun.current = false;
    return () => window.clearTimeout(id);
  }, [seen, reduced, touched, index, sweep]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const setFromX = (clientX: number) => {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  const pair = PAIRS[index];
  const sizes = "(min-width: 1024px) 680px, 100vw";

  return (
    <figure className="min-w-0">
      <div
        ref={frame}
        className={`group/cmp relative aspect-[4/3] touch-pan-y select-none overflow-hidden rounded-[3px] bg-border shadow-[0_30px_60px_-30px_rgb(11_42_91/0.45)] ring-1 ring-border ${dragging ? "cursor-grabbing" : "cursor-ew-resize"}`}
        onPointerDown={(e) => {
          stopSweep();
          setTouched(true);
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => dragging && setFromX(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {PAIRS.map((p, i) => (
          <div
            key={p.key}
            aria-hidden={i !== index}
            className="absolute inset-0 transition-opacity duration-700 ease-[var(--ease-out)]"
            style={{ opacity: i === index ? 1 : 0 }}
          >
            <Image src={img(p.file, "after")} alt={t(`ba.${p.key}.afterAlt` as DictKey)} fill sizes={sizes} draggable={false} priority={i === 0} className="object-cover" />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              <Image src={img(p.file, "before")} alt={t(p.beforeAlt)} fill sizes={sizes} draggable={false} priority={i === 0} className="object-cover" />
            </div>
          </div>
        ))}

        <Tag label={t("ba.before")} sub={t("ba.real")} className={`left-3 sm:left-4 ${pos < 24 ? "opacity-0" : ""}`} />
        <Tag label={t("ba.after")} sub={t("ba.ai")} className={`right-3 sm:right-4 ${pos > 76 ? "opacity-0" : ""}`} />

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(pos)}
          onChange={(e) => {
            stopSweep();
            setTouched(true);
            setPos(Number(e.target.value));
          }}
          aria-label={`${t("ba.slider")}: ${t(`ba.${pair.key}.caption` as DictKey)}`}
          className="peer sr-only"
        />
        {/* Divider + handle */}
        <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.18)]" style={{ left: `${pos}%` }}>
          <span
            aria-hidden
            className={`absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-navy shadow-[0_6px_20px_rgb(0_0_0/0.25)] transition-transform duration-200 group-hover/cmp:scale-110 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-white sm:size-14 ${dragging ? "scale-95" : ""}`}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </div>

        {/* Hint pill fades away after the first interaction. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[rgb(8_22_48/0.7)] px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-opacity duration-500 sm:text-sm ${touched ? "opacity-0" : "opacity-100"}`}
        >
          ⟷ {t("ba.dragHint")}
        </span>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6">
        <p key={pair.key} className="motion-rise font-display text-xl leading-snug sm:text-2xl">
          {t(`ba.${pair.key}.caption` as DictKey)}, {t("ba.place")}
        </p>
        <Credit />
      </figcaption>
    </figure>
  );
}

/** Thumbnail split on a diagonal: real photo on the left, illustration on the right. */
function PairButton({ i, active, onSelect }: { i: number; active: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  const p = PAIRS[i];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`press group flex w-full min-w-0 flex-col items-stretch gap-2 rounded-[3px] p-1.5 text-left lg:flex-row lg:items-center lg:gap-4 lg:p-2 ${
        active ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--rule)]" : "hover:bg-surface/70"
      }`}
    >
      <span className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[2px] lg:w-28">
        <Image src={img(p.file, "after")} alt="" fill sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute inset-0" style={{ clipPath: "polygon(0 0, 58% 0, 42% 100%, 0 100%)" }}>
          <Image src={img(p.file, "before")} alt="" fill sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        </span>
      </span>
      <span className="min-w-0">
        <span className={`block font-display text-sm tabular-nums ${active ? "text-foreground" : "text-muted"}`}>
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className="block text-[13px] font-semibold leading-snug sm:text-[15px]">{t(`ba.${p.key}.caption` as DictKey)}</span>
      </span>
    </button>
  );
}

/**
 * Homepage feature, right under the hero: three real "before" photos, each paired with an
 * AI-illustrated "after". One large slider plus a picker; sits on a full-bleed paper band.
 */
export function BeforeAfterSection() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const steps = t("ba.after.steps").split("→").map((x) => x.trim());
  return (
    <section
      className="mt-16 bg-paper py-14 shadow-[0_0_0_100vmax_var(--paper)] [clip-path:inset(0_-100vmax)] sm:mt-24 sm:py-20"
      aria-labelledby="ba-title"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-12">
        <Reveal className="lg:order-2">
          <Kicker>{t("ba.kicker")}</Kicker>
          <h2 id="ba-title" className="mt-2 font-display text-[2.1rem] font-normal leading-[1.08] text-balance sm:text-[3rem]">
            {t("ba.title")}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">{t("ba.body")}</p>

          <p className="mt-8 hidden font-display text-lg italic text-muted lg:block">{t("ba.choose")}</p>
          <div role="group" aria-label={t("ba.choose")} className="mt-3 hidden gap-1 lg:grid">
            {PAIRS.map((p, i) => (
              <PairButton key={p.key} i={i} active={i === index} onSelect={() => setIndex(i)} />
            ))}
          </div>
        </Reveal>

        <Reveal variant="scale" delay={120} className="lg:order-1">
          <Compare index={index} />
          {/* Picker under the photo on phones/tablets */}
          <div role="group" aria-label={t("ba.choose")} className="mt-4 grid grid-cols-3 gap-2 lg:hidden">
            {PAIRS.map((p, i) => (
              <PairButton key={p.key} i={i} active={i === index} onSelect={() => setIndex(i)} />
            ))}
          </div>
        </Reveal>
      </div>

      <Reveal delay={200} className="mt-10 flex flex-col gap-5 border-t border-border pt-6 sm:mt-12 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted">{t("ba.stepsLabel")}</p>
          <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[13px] font-semibold sm:text-sm">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  className={`rounded-full px-3 py-1 ${
                    i === steps.length - 1 ? "bg-emerald text-on-emerald" : i === 0 ? "bg-gold-soft text-gold-ink" : "bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                  }`}
                >
                  {s}
                </span>
                {i < steps.length - 1 && (
                  <svg viewBox="0 0 12 12" className="size-3 text-muted" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 6h8M7 3l3 3-3 3" />
                  </svg>
                )}
              </li>
            ))}
          </ol>
        </div>
        <Link href="/donate" className={btn("primary", "lg", "shrink-0")}>
          {t("ba.cta")}
        </Link>
      </Reveal>
    </section>
  );
}

/**
 * Project page: real program-context "before" (roof/reconstruction programs only) next to this
 * project's latest approved photo. Used only when the project has no before/after evidence of its own.
 */
export function ProjectBeforeAfter({ afterUrl, alias }: { afterUrl: string | null; alias: string }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-4">
      <figure className="min-w-0">
        <Image
          src={img(PAIRS[0].file, "before")}
          alt={t("ba.collapsed.alt")}
          width={1200}
          height={900}
          sizes="(min-width: 768px) 360px, 50vw"
          className="aspect-[4/3] h-auto w-full border border-border object-cover"
        />
        <figcaption className="mt-1.5">
          <span className="flex flex-wrap items-center gap-2 font-display text-[15px] italic">
            {t("ba.before")} <Chip tone="navy">{t("ba.real")}</Chip>
          </span>
          <p className="mt-1 text-[13px] leading-snug text-muted">{t("ba.project.context")}</p>
          <Credit />
        </figcaption>
      </figure>
      <figure className="min-w-0">
        {afterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={afterUrl} alt={`${t("ba.after")}: ${alias}`} className="aspect-[4/3] w-full border border-border object-cover" />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center border border-dashed border-border text-sm text-muted">
            {t("ba.project.none")}
          </div>
        )}
        <figcaption className="mt-1.5">
          <span className="flex flex-wrap items-center gap-2 font-display text-[15px] italic">
            {t("ba.after")} <Chip tone="gold">{t("ba.demo")}</Chip>
          </span>
          <p className="mt-1 text-[13px] leading-snug text-muted">{t("ba.project.after")}</p>
        </figcaption>
      </figure>
    </div>
  );
}
