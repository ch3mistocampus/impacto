"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { MaterialGlyph } from "@/components/ui/MaterialGlyph";
import {
  CategoryMark,
  DoubleRule,
  FlagBand,
  Seal,
  StageSwatch,
  STAGE_TEXT,
  intlLocale,
  type Stage,
} from "@/components/ui/tricolor";
import type { DeckCard } from "./types";

const THRESHOLD = 110;
/** A quick flick counts even if it hasn't travelled the full threshold (px per ms). */
const FLICK_VELOCITY = 0.55;
const FLICK_MIN = 40;
export const EXIT_MS = 300;
const STAGES: Stage[] = ["requested", "pledged", "received", "delivered", "used", "verified"];

/**
 * Top card of the deck, set as a Tricolor certificate. Drag with pointer (mouse/touch/pen):
 * left past the threshold (or a flick) = pass, right = help. Buttons and arrow keys in the
 * parent do the same thing.
 *
 * Dragging never re-renders React: position, tilt and the intent stamps are written straight
 * to the DOM once per animation frame, and `onProgress` (0..1) lets the parent ease the cards
 * underneath forward in step with the finger.
 */
export function SwipeCard({
  card,
  exiting,
  reducedMotion,
  onPass,
  onHelp,
  onProgress,
}: {
  card: DeckCard;
  exiting: "left" | "right" | null;
  reducedMotion: boolean;
  onPass: () => void;
  onHelp: () => void;
  onProgress?: (p: number) => void;
}) {
  const { t, pick, locale, u } = useI18n();
  const nf = new Intl.NumberFormat(intlLocale(locale));

  const el = useRef<HTMLDivElement>(null);
  const helpStamp = useRef<HTMLSpanElement>(null);
  const passStamp = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x0: number; id: number; dx: number; lastX: number; lastT: number; v: number } | null>(null);
  const frame = useRef(0);

  /** Paint a drag offset: card position + tilt, stamp opacity, and stack progress. */
  function paint(dx: number, animate: boolean) {
    const node = el.current;
    if (!node) return;
    node.style.transition = animate
      ? `transform 420ms var(--ease-spring), opacity ${EXIT_MS}ms var(--ease-out)`
      : "none";
    node.style.transform = reducedMotion ? "" : `translate3d(${dx}px,0,0) rotate(${dx / 20}deg)`;
    const p = Math.min(1, Math.abs(dx) / THRESHOLD);
    const stamp = (s: HTMLSpanElement | null, on: boolean) => {
      if (!s) return;
      s.style.transition = animate ? "opacity 200ms var(--ease-out), scale 200ms var(--ease-out)" : "none";
      s.style.opacity = on ? String(Math.min(1, Math.max(0, (p - 0.25) / 0.5))) : "0";
      s.style.scale = on ? String(1.15 - 0.15 * p) : "1.15";
    };
    stamp(helpStamp.current, dx > 0);
    stamp(passStamp.current, dx < 0);
    onProgress?.(reducedMotion ? 0 : p * 0.6);
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (exiting) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x0: e.clientX, id: e.pointerId, dx: 0, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    paint(0, false);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = 0.7 * ((e.clientX - d.lastX) / dt) + 0.3 * d.v; // smoothed px/ms
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    d.dx = e.clientX - d.x0;
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (drag.current) paint(drag.current.dx, false);
      });
    }
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    const flick = Math.abs(d.v) >= FLICK_VELOCITY && Math.abs(d.dx) >= FLICK_MIN;
    if (e.type !== "pointercancel" && (d.dx <= -THRESHOLD || (flick && d.v < 0))) {
      paint(d.dx, false); // hold here; the exit effect flies it out from this spot
      onPass();
    } else if (e.type !== "pointercancel" && (d.dx >= THRESHOLD || (flick && d.v > 0))) {
      paint(0, true); // spring home, the pledge sheet opens over it
      onHelp();
    } else {
      paint(0, true);
    }
  }

  // Fly out (button, key or swipe). Continues from wherever the drag left the card.
  useLayoutEffect(() => {
    const node = el.current;
    if (!exiting || !node) return;
    const dir = exiting === "left" ? -1 : 1;
    if (reducedMotion) {
      node.style.transition = `opacity ${EXIT_MS / 2}ms linear`;
      node.style.opacity = "0";
      return;
    }
    const w = node.offsetWidth || 400;
    // Read layout so the starting transform is committed before we transition away from it.
    void node.getBoundingClientRect();
    node.style.transition = `transform ${EXIT_MS}ms cubic-bezier(.4,0,.9,.6), opacity ${EXIT_MS}ms ease-in`;
    node.style.transform = `translate3d(${dir * w * 1.25}px, 24px, 0) rotate(${dir * 16}deg)`;
    node.style.opacity = "0";
    onProgress?.(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per exit
  }, [exiting]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const L = card.ledger;
  const name = pick(card.nameEs, card.nameEn);
  const confirmed = L.requested !== null;

  return (
    <div
      ref={el}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="absolute inset-0 touch-pan-y select-none cursor-grab active:cursor-grabbing will-change-transform"
    >
      <article
        className="relative h-full flex flex-col rounded-[2px] bg-surface border border-border overflow-hidden shadow-[0_18px_40px_-28px_rgb(11_42_91/0.45)]"
        aria-roledescription={t("donate.swipeHelp")}
      >
        <FlagBand thickness={5} />

        {/* intent stamps: outlined, like a rubber stamp on a certificate */}
        <span
          ref={helpStamp}
          aria-hidden
          className="pointer-events-none absolute top-6 left-5 z-10 -rotate-[8deg] rounded-[2px] border border-gold-ink bg-surface/90 px-3 py-1 font-display italic text-2xl text-gold-ink outline outline-1 outline-offset-2 outline-gold-ink"
          style={{ opacity: 0 }}
        >
          {t("donate.stamp.pledge")}
        </span>
        <span
          ref={passStamp}
          aria-hidden
          className="pointer-events-none absolute top-6 right-5 z-10 rotate-[8deg] rounded-[2px] border border-muted bg-surface/90 px-3 py-1 font-display italic text-2xl text-muted outline outline-1 outline-offset-2 outline-muted"
          style={{ opacity: 0 }}
        >
          {t("donate.pass")}
        </span>

        <div className="motion-fade flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 pt-5 pb-5 flex flex-col">
          {/* caption */}
          <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-muted">
            <CategoryMark category={card.category} size={10} className="text-foreground" />
            <span className="truncate">
              {t(`category.${card.category}`)}, {card.publicAlias}
              {card.region && <span>, {card.region}</span>}
            </span>
          </p>

          <div className="mt-3 flex items-center justify-center gap-3 text-foreground">
            <MaterialGlyph itemKey={card.itemKey} className="size-11 shrink-0" />
            <h2 className={`font-display font-normal leading-[1.05] text-balance ${name.length > 18 ? "text-[1.75rem] sm:text-[2rem]" : "text-[2.1rem] sm:text-[2.5rem]"}`}>
              {name}
            </h2>
          </div>

          {/* the figure */}
          {confirmed ? (
            <p className="mt-4 text-center leading-none">
              <span className="font-display text-[4rem] sm:text-[4.5rem] font-normal tabular-nums">
                {nf.format(L.availableToPledge)}
              </span>{" "}
              <span className="block sm:inline mt-1 sm:mt-0 text-base text-muted">
                {t("donate.card.of")} {nf.format(L.requested ?? 0)} {u(card.unit)} {t("donate.card.unpledged")}
              </span>
            </p>
          ) : (
            <div className="mt-4 text-center">
              <p className="font-display italic text-4xl text-muted">{t("donate.card.toConfirm")}</p>
              <p className="mt-1 text-sm text-muted">{t("stage.needsConfirmation")}</p>
            </div>
          )}

          <DoubleRule className="my-4 sm:mx-6" />

          {/* the six measures, dotted leaders */}
          <ul aria-label={t("donate.card.ledger")} className="text-[15px]">
            {STAGES.map((s) => {
              const v = s === "requested" ? L.requested : L[s];
              return (
                <li
                  key={s}
                  className={`flex items-baseline gap-2 py-[3px] ${STAGE_TEXT[s]} ${s === "verified" ? "font-bold" : ""}`}
                >
                  <StageSwatch stage={s} size={9} className="self-center" />
                  <span>{t(`stage.${s}`)}</span>
                  <span aria-hidden className="flex-1 -translate-y-1 border-b border-dotted border-muted/60" />
                  <span className="font-display text-lg font-normal tabular-nums leading-none">
                    {v === null ? "—" : nf.format(v)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto pt-4 flex items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug line-clamp-2">{pick(card.summaryEs, card.summaryEn)}</p>
              <Link
                href={`/transparency/projects/${card.projectId}`}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline decoration-1 underline-offset-[5px] hover:decoration-2"
              >
                {t("donate.viewProject")}
              </Link>
            </div>
            {card.verified && (
              <Seal size={68} className="shrink-0" title={t("donate.card.sealTitle")}>
                <span aria-hidden>
                  Espejo
                  <br />
                  de Agua
                </span>
                <span className="sr-only">{t("donate.card.sealTitle")}</span>
              </Seal>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
