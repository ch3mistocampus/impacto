"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { MaterialImage } from "@/components/public/MaterialImage";
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
const STAGES: Stage[] = ["requested", "pledged", "received", "delivered", "used", "verified"];

export type SwipeCardHandle = { flyOut: (dir: "left" | "right") => void };

/**
 * Top card of the deck, set as a Tricolor certificate. Drag with pointer (mouse/touch/pen):
 * left past the threshold = pass, right past the threshold = help. Buttons and arrow keys in
 * the parent do the same thing.
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
  const { t, pick, locale, u } = useI18n();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const nf = new Intl.NumberFormat(intlLocale(locale));

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

  const L = card.ledger;
  const name = pick(card.nameEs, card.nameEn);
  const confirmed = L.requested !== null;

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
        className="relative h-full flex flex-col rounded-[2px] bg-surface border border-border overflow-hidden"
        aria-roledescription={t("donate.swipeHelp")}
      >
        <FlagBand thickness={5} />

        {/* intent stamps: outlined, like a rubber stamp on a certificate */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-6 left-5 z-10 -rotate-[8deg] rounded-[2px] border border-gold-ink bg-surface/90 px-3 py-1 font-display italic text-2xl text-gold-ink outline outline-1 outline-offset-2 outline-gold-ink transition-opacity"
          style={{ opacity: intent === "help" ? 1 : 0 }}
        >
          {t("donate.stamp.pledge")}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute top-6 right-5 z-10 rotate-[8deg] rounded-[2px] border border-muted bg-surface/90 px-3 py-1 font-display italic text-2xl text-muted outline outline-1 outline-offset-2 outline-muted transition-opacity"
          style={{ opacity: intent === "pass" ? 1 : 0 }}
        >
          {t("donate.pass")}
        </span>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 pt-5 pb-5 flex flex-col">
          {/* caption */}
          <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-muted">
            <CategoryMark category={card.category} size={10} className="text-foreground" />
            <span className="truncate">
              {t(`category.${card.category}`)}, {card.publicAlias}
              {card.region && <span>, {card.region}</span>}
            </span>
          </p>

          <div className="mt-3 flex flex-col items-center gap-2 text-foreground">
            <MaterialImage
              itemKey={card.itemKey}
              alt=""
              className="size-28 sm:size-32 shrink-0 rounded-[2px]"
              sizes="(min-width: 640px) 128px, 112px"
              loading="eager"
            />
            <h2 className={`text-center font-display font-normal leading-[1.05] text-balance ${name.length > 18 ? "text-[1.75rem] sm:text-[2rem]" : "text-[2.1rem] sm:text-[2.5rem]"}`}>
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
