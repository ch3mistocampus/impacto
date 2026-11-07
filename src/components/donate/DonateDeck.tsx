"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { CategoryChips } from "@/components/public/Landing";
import { Kicker, btn, inputCls, labelCls } from "@/components/ui/tricolor";
import { isCategory, type Category } from "@/components/public/types";
import { EXIT_MS, SwipeCard } from "./SwipeCard";
import { ContributionSheet } from "./ContributionSheet";
import { useReducedMotion } from "./useReducedMotion";
import { parsePledges, pledgesSnapshot, subscribePledges, type SavedPledge } from "./followTokens";
import type { DeckCard, PledgeMode } from "./types";

export function DonateDeck() {
  const { t, pick } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const qc = params.get("category");
  const category: Category | undefined = isCategory(qc) ? qc : undefined;
  const [itemKey, setItemKey] = useState<string>("");

  const deck = useQuery(api.public.donorDeck, category ? { category } : {});
  const reducedMotion = useReducedMotion();

  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [sheetSnap, setSheetSnap] = useState<DeckCard | null>(null);
  const [sheetMode, setSheetMode] = useState<PledgeMode>("request_instructions");
  const savedRaw = useSyncExternalStore(subscribePledges, pledgesSnapshot, () => "");
  const saved = useMemo(() => parsePledges(savedRaw), [savedRaw]);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The stack beneath the top card reads `--drag` (0..1): how far it has stepped forward.
  const stack = useRef<HTMLDivElement>(null);
  const setDrag = (p: number) => stack.current?.style.setProperty("--drag", String(p));

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );

  // Material options come from the current category's deck.
  const materials = useMemo(() => {
    const m = new Map<string, DeckCard>();
    for (const c of deck ?? []) if (!m.has(c.itemKey)) m.set(c.itemKey, c);
    return [...m.values()];
  }, [deck]);
  const activeItemKey = materials.some((m) => m.itemKey === itemKey) ? itemKey : "";

  const filtered = useMemo(
    () => (deck ?? []).filter((c) => !activeItemKey || c.itemKey === activeItemKey),
    [deck, activeItemKey],
  );
  const remaining = filtered.filter((c) => !dismissed.has(c.needId));
  const top = remaining[0];

  // A new top card: the cards below have been re-keyed one step up, so drop the drag offset in
  // the same frame (before paint) and they stay exactly where the fly-out left them.
  useLayoutEffect(() => {
    stack.current?.style.setProperty("--drag", "0");
  }, [top?.needId]);

  // The sheet follows the live deck entry so availability updates reactively.
  const sheetCard: DeckCard | null = sheetSnap
    ? (deck?.find((c) => c.needId === sheetSnap.needId) ?? {
        ...sheetSnap,
        ledger: { ...sheetSnap.ledger, availableToPledge: 0 },
      })
    : null;

  function pass() {
    if (!top || exiting) return;
    const id = top.needId;
    setExiting("left");
    exitTimer.current = setTimeout(
      () => {
        setDismissed((d) => new Set(d).add(id));
        setExiting(null);
      },
      reducedMotion ? EXIT_MS / 2 : EXIT_MS,
    );
  }

  /** Open the pledge sheet preset to a mode (§4C: have / buy / pledge quantity). */
  function help(mode: PledgeMode = "request_instructions") {
    if (!top || exiting) return;
    setSheetMode(mode);
    setSheetSnap(top);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
      if (sheetSnap) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        pass();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        help("request_instructions");
      } else if (e.key === "1") {
        e.preventDefault();
        help("have_materials");
      } else if (e.key === "2") {
        e.preventDefault();
        help("will_buy");
      }
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function setCategory(c: Category | undefined) {
    setDismissed(new Set());
    setItemKey("");
    router.replace(c ? `/donate?category=${c}` : "/donate", { scroll: false });
  }

  function closeSheet(pledged: boolean) {
    const id = sheetSnap?.needId;
    setSheetSnap(null);
    if (pledged && id) setDismissed((d) => new Set(d).add(id));
  }

  const position = filtered.length - remaining.length + 1;

  return (
    <div className="pt-6 sm:pt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-14 lg:items-start">
      <div className="max-w-xl w-full mx-auto lg:mx-0 lg:max-w-none lg:sticky lg:top-6">
        <Kicker>{t("donate.kicker")}</Kicker>
        <h1 className="mt-1 font-display text-[2.5rem] sm:text-5xl lg:text-[2.75rem] font-normal leading-[1.02]">{t("donate.title")}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{t("donate.lead")}</p>

        {/* On the narrow desktop column the chip row wraps instead of scrolling. */}
        <div className="mt-6 lg:[&>[role=group]]:mx-0 lg:[&>[role=group]]:flex-wrap lg:[&>[role=group]]:px-0">
          <CategoryChips
            value={category}
            onChange={setCategory}
            allLabel={t("donate.all")}
            label={t("donate.filterCategory")}
          />
        </div>
        {materials.length > 1 && (
          <label className="mt-4 block">
            <span className={labelCls}>{t("donate.filterMaterial")}</span>
            <select
              value={activeItemKey}
              onChange={(e) => {
                setItemKey(e.target.value);
                setDismissed(new Set());
              }}
              className={`${inputCls} h-11 py-0`}
            >
              <option value="">{t("donate.allMaterials")}</option>
              {materials.map((m) => (
                <option key={m.itemKey} value={m.itemKey}>
                  {pick(m.nameEs, m.nameEn)}
                </option>
              ))}
            </select>
          </label>
        )}

        {saved.length > 0 && (
          <aside className="mt-10 hidden lg:block" aria-labelledby="my-pledges-desk">
            <MyPledgesList id="my-pledges-desk" saved={saved} />
          </aside>
        )}
      </div>

      <div className="max-w-xl w-full mx-auto lg:mx-0 lg:max-w-[34rem] lg:justify-self-center">
        <section aria-label={t("donate.swipeHelp")} aria-live="polite">
          <div ref={stack} className="relative h-[42rem] lg:h-[40rem]">
            {deck === undefined ? (
              <div className="absolute inset-0 rounded-[2px] bg-surface border border-border overflow-hidden" aria-busy>
                <span className="sr-only">{t("common.loading")}</span>
                <div aria-hidden className="h-[5px] bg-paper" />
                <div aria-hidden className="mx-auto mt-8 grid w-3/4 gap-4 motion-safe:animate-pulse">
                  <div className="mx-auto h-3 w-1/2 bg-paper" />
                  <div className="mx-auto h-9 w-3/4 bg-paper" />
                  <div className="mx-auto mt-2 h-16 w-1/3 bg-paper" />
                  <div className="mt-4 grid gap-2.5">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="h-3 bg-paper" />
                    ))}
                  </div>
                </div>
              </div>
            ) : !top ? (
              <div className="motion-rise absolute inset-0 rounded-[2px] border border-dashed border-rule/40 grid place-items-center p-8 text-center">
                <div>
                  <p className="font-display text-2xl font-normal leading-snug">
                    {filtered.length === 0 ? t("donate.noNeeds") : t("donate.empty")}
                  </p>
                  {filtered.length > 0 && (
                    <button type="button" onClick={() => setDismissed(new Set())} className={btn("primary", "md", "mt-6")}>
                      {t("donate.restart")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {remaining
                  .slice(1, 3)
                  .reverse()
                  .map((c, i, arr) => {
                    const depth = arr.length - i; // 2 = furthest
                    const d = `(${depth} - var(--drag, 0))`;
                    return (
                      <div
                        key={c.needId}
                        aria-hidden
                        className="motion-fade absolute inset-0 rounded-[2px] bg-surface border border-border transition-transform duration-300 ease-[var(--ease-out)]"
                        style={{ transform: `translate(calc(${d} * 4px), calc(${d} * 6px))` }}
                      />
                    );
                  })}
                <SwipeCard
                  key={top.needId}
                  card={top}
                  exiting={exiting}
                  reducedMotion={reducedMotion}
                  onPass={pass}
                  onHelp={() => help("request_instructions")}
                  onProgress={setDrag}
                />
              </>
            )}
          </div>

          {top && (
            <>
              <p className="mt-5 text-center text-xs text-muted tabular-nums">
                {position} {t("donate.cardOf")} {filtered.length}
              </p>
              <div className="mt-2 grid grid-cols-[1fr_1.5fr] gap-3">
                <button
                  type="button"
                  onClick={pass}
                  className={btn("secondary", "lg", "min-h-14 w-full text-lg")}
                  aria-keyshortcuts="ArrowLeft"
                >
                  {t("donate.act.pass")}
                </button>
                <button
                  type="button"
                  onClick={() => help("request_instructions")}
                  className={btn("primary", "lg", "min-h-14 w-full text-lg")}
                  aria-keyshortcuts="ArrowRight"
                >
                  {t("donate.act.give")}
                </button>
              </div>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted">
                <span className="hidden sm:inline">{t("donate.act.otherWays")}</span>
                <button
                  type="button"
                  onClick={() => help("have_materials")}
                  className={btn("quiet", "md", "min-h-11")}
                  aria-keyshortcuts="1"
                >
                  {t("donate.act.have")}
                </button>
                <button
                  type="button"
                  onClick={() => help("will_buy")}
                  className={btn("quiet", "md", "min-h-11")}
                  aria-keyshortcuts="2"
                >
                  {t("donate.act.buy")}
                </button>
              </p>
              <p className="mt-2 text-center text-xs text-muted hidden sm:block">{t("donate.keyboardHint2")}</p>
            </>
          )}
        </section>
      </div>

      {saved.length > 0 && (
        <aside className="max-w-xl w-full mx-auto lg:hidden" aria-labelledby="my-pledges-mob">
          <MyPledgesList id="my-pledges-mob" saved={saved} />
        </aside>
      )}

      <ContributionSheet card={sheetCard} initialMode={sheetMode} onClose={closeSheet} />
    </div>
  );
}

function MyPledgesList({ id, saved }: { id: string; saved: SavedPledge[] }) {
  const { t, pick } = useI18n();
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-2xl font-normal">
          {t("donate.myPledges")}
        </h2>
        <Link href="/donations" className={btn("quiet", "md", "text-sm")}>
          {t("donate.successDonations")}
        </Link>
      </div>
      <ul className="mt-3 border-t border-rule divide-y divide-border border-b border-b-border">
        {saved.slice(0, 6).map((p) => (
          <li key={p.token} className="motion-rise motion-stagger">
            <Link
              href={`/follow/${p.token}`}
              className="group flex min-h-11 items-baseline gap-3 py-2.5 transition-colors hover:bg-paper"
              aria-label={`${p.qty} ${pick(p.nameEs, p.nameEn)} (${p.alias}). ${t("donate.follow")}`}
            >
              <span className="font-display text-xl font-normal tabular-nums text-gold-ink">{p.qty}</span>
              <span className="min-w-0 flex-1 truncate text-[15px]">
                {pick(p.nameEs, p.nameEn)} <span className="text-muted">({p.alias})</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
