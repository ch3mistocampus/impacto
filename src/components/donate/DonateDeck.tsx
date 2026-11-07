"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { CategoryChips } from "@/components/public/Landing";
import { isCategory, type Category } from "@/components/public/types";
import { SwipeCard } from "./SwipeCard";
import { ContributionSheet } from "./ContributionSheet";
import { useReducedMotion } from "./useReducedMotion";
import { parsePledges, pledgesSnapshot, subscribePledges } from "./followTokens";
import type { DeckCard } from "./types";

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
  const savedRaw = useSyncExternalStore(subscribePledges, pledgesSnapshot, () => "");
  const saved = useMemo(() => parsePledges(savedRaw), [savedRaw]);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      reducedMotion ? 120 : 260,
    );
  }

  function help() {
    if (!top || exiting) return;
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
        help();
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
    <div className="pt-6 sm:pt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="max-w-md w-full mx-auto lg:mx-0 lg:max-w-none">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight">{t("donate.title")}</h1>
        <p className="mt-2 text-muted">{t("donate.lead")}</p>

        <CategoryChips
          value={category}
          onChange={setCategory}
          allLabel={t("donate.all")}
          label={t("donate.filterCategory")}
        />
        {materials.length > 1 && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <span className="font-semibold">{t("donate.filterMaterial")}</span>
            <select
              value={activeItemKey}
              onChange={(e) => {
                setItemKey(e.target.value);
                setDismissed(new Set());
              }}
              className="flex-1 h-10 rounded-full border-2 border-border bg-surface px-3"
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
      </div>

      <div className="max-w-md w-full mx-auto lg:row-span-2 lg:col-start-2 lg:row-start-1 lg:max-w-none">
        <section aria-label={t("donate.swipeHelp")} aria-live="polite">
          <div className="relative h-[min(36rem,72dvh)] min-h-[30rem]">
            {deck === undefined ? (
              <div className="absolute inset-0 rounded-[1.75rem] bg-surface border border-border grid place-items-center text-muted">
                {t("common.loading")}
              </div>
            ) : !top ? (
              <div className="absolute inset-0 rounded-[1.75rem] border-2 border-dashed border-border grid place-items-center p-8 text-center">
                <div>
                  <p className="font-display text-2xl font-semibold">
                    {filtered.length === 0 ? t("donate.noNeeds") : t("donate.empty")}
                  </p>
                  {filtered.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDismissed(new Set())}
                      className="mt-5 rounded-full bg-foreground text-background px-6 py-3 font-semibold"
                    >
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
                    return (
                      <div
                        key={c.needId}
                        aria-hidden
                        className="absolute inset-0 rounded-[1.75rem] bg-surface border border-border"
                        style={{
                          transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                          opacity: 1 - depth * 0.25,
                        }}
                      />
                    );
                  })}
                <SwipeCard
                  key={top.needId}
                  card={top}
                  exiting={exiting}
                  reducedMotion={reducedMotion}
                  onPass={pass}
                  onHelp={help}
                />
              </>
            )}
          </div>

          {top && (
            <>
              <p className="mt-6 text-center text-xs text-muted tabular-nums">
                {position} {t("donate.cardOf")} {filtered.length}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={pass}
                  className="h-16 rounded-full border-2 border-foreground/70 bg-surface text-lg font-semibold"
                  aria-keyshortcuts="ArrowLeft"
                >
                  <span aria-hidden className="mr-1.5">←</span>
                  {t("donate.pass")}
                </button>
                <button
                  type="button"
                  onClick={help}
                  className="h-16 rounded-full bg-clay text-white text-lg font-semibold shadow-[0_2px_0_var(--brick)]"
                  aria-keyshortcuts="ArrowRight"
                >
                  {t("donate.help")}
                  <span aria-hidden className="ml-1.5">→</span>
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-muted hidden sm:block">{t("donate.keyboardHint")}</p>
            </>
          )}
        </section>
      </div>

      {saved.length > 0 && (
        <aside className="max-w-md w-full mx-auto lg:mx-0 lg:max-w-none">
          <h2 className="font-display text-xl font-semibold">{t("donate.myPledges")}</h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {saved.slice(0, 6).map((p) => (
              <li key={p.token}>
                <Link href={`/follow/${p.token}`} className="flex items-baseline gap-2 py-3">
                  <span className="font-display font-semibold tabular-nums">{p.qty}</span>
                  <span className="flex-1 truncate">
                    {pick(p.nameEs, p.nameEn)} <span className="text-muted">({p.alias})</span>
                  </span>
                  <span className="text-xs font-semibold text-sky underline underline-offset-2">
                    {t("donate.follow")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <ContributionSheet card={sheetCard} onClose={closeSheet} />
    </div>
  );
}
