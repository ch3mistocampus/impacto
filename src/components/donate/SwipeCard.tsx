"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { LedgerBar } from "@/components/public/LedgerBar";
import { MaterialImage } from "@/components/public/MaterialImage";
import { CategoryBadge } from "@/components/public/CategoryBadge";
import { VerifiedBadge } from "@/components/public/VerifiedBadge";
import { DemoTag } from "@/components/public/PublicMeta";
import { CATEGORY_STYLE } from "@/components/public/types";
import type { DeckCard } from "./types";

const THRESHOLD = 110;

export type SwipeCardHandle = { flyOut: (dir: "left" | "right") => void };

/**
 * Top card of the deck. Drag with pointer (mouse/touch/pen): left past the threshold = pass,
 * right past the threshold = help. Buttons and arrow keys in the parent do the same thing.
 */
export function SwipeCard({
  card,
  exiting,
  reducedMotion,
  onPass,
  onHelp,
}: {
  card: DeckCard;
  exiting: "left" | "right" | null;
  reducedMotion: boolean;
  onPass: () => void;
  onHelp: () => void;
}) {
  const { t, pick } = useI18n();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const s = CATEGORY_STYLE[card.category];

  function down(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDx(e.clientX - start.current.x);
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.id !== e.pointerId) return;
    start.current = null;
    setDragging(false);
    const d = dx;
    setDx(0);
    if (d <= -THRESHOLD) onPass();
    else if (d >= THRESHOLD) onHelp();
  }

  const exitX = exiting === "left" ? -600 : exiting === "right" ? 600 : 0;
  const x = exiting ? exitX : dx;
  const rot = reducedMotion ? 0 : x / 18;
  const intent = dx <= -THRESHOLD / 2 ? "pass" : dx >= THRESHOLD / 2 ? "help" : null;

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="absolute inset-0 touch-pan-y select-none cursor-grab active:cursor-grabbing"
      style={{
        transform: reducedMotion && !dragging ? undefined : `translateX(${x}px) rotate(${rot}deg)`,
        opacity: exiting && reducedMotion ? 0 : 1,
        transition: dragging ? "none" : reducedMotion ? "opacity 120ms linear" : "transform 280ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <article
        className="relative h-full flex flex-col rounded-[1.75rem] bg-surface border border-border shadow-[0_18px_40px_-24px_rgba(60,30,10,0.45)] overflow-hidden"
        aria-roledescription={t("donate.swipeHelp")}
      >
        {/* intent stamps */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-5 left-5 z-10 rotate-[-10deg] rounded-lg border-4 border-sky px-3 py-1 font-display text-2xl font-bold text-sky bg-surface/80 transition-opacity"
          style={{ opacity: intent === "help" ? 1 : 0 }}
        >
          {t("donate.act.pledge")}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute top-5 right-5 z-10 rotate-[10deg] rounded-lg border-4 border-muted px-3 py-1 font-display text-2xl font-bold text-muted bg-surface/80 transition-opacity"
          style={{ opacity: intent === "pass" ? 1 : 0 }}
        >
          {t("donate.pass")}
        </span>

        <div className={`relative ${s.soft} h-[34%] min-h-28 shrink-0 grid place-items-center`}>
          <MaterialImage
            itemKey={card.itemKey}
            alt={pick(card.nameEs, card.nameEn)}
            className="h-[85%] w-auto max-w-[70%] drop-shadow-md"
          />
          <DemoTag className="absolute top-3 right-3" />
          <div className="absolute inset-x-4 bottom-3 flex flex-wrap items-end justify-between gap-1.5">
            <CategoryBadge category={card.category} className="bg-surface/90" />
            {card.verified && <VerifiedBadge />}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col p-5 gap-3 overflow-y-auto">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight">{pick(card.nameEs, card.nameEn)}</h2>
            <p className="text-sm text-muted mt-0.5">
              <span className="font-semibold text-foreground">{card.publicAlias}</span>
              {card.region && <span>, {card.region}</span>}
            </p>
          </div>
          <p className="text-sm leading-relaxed line-clamp-2">{pick(card.summaryEs, card.summaryEn)}</p>
          <div className="mt-auto pt-1">
            <LedgerBar ledger={card.ledger} unit={card.unit} compact />
            <p className="mt-2 text-xs font-semibold text-amber">{t("stage.pledgeIsNot")}</p>
          </div>
          <Link
            href={`/transparency/projects/${card.projectId}`}
            className="self-start text-sm font-semibold underline underline-offset-4 decoration-2"
          >
            {t("donate.viewProject")}
          </Link>
        </div>
      </article>
    </div>
  );
}
