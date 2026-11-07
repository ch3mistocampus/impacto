"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n, type Locale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { TOUR_STEPS, type TourIds } from "./steps";

/**
 * Guided tour: a spotlight + narration card that walks a judge or first-time visitor through the
 * whole flow (field → coordinator → donor → public), switching demo roles and pages as it goes.
 *
 * Start: the "Guided tour" button in the demo bar, `?tour=1` (manual) or `?tour=auto` (autoplay).
 * The spotlight is visual only (pointer-events: none), so everything inside it stays usable: the
 * "Try it" hints are meant to be done for real. Progress survives navigation via sessionStorage.
 * `window.__impactoTour` exposes next/back/go/stop for scripted recordings.
 */

const KEY = "impacto.tour";
export const TOUR_EVENT = "impacto:tour";

/** `restore`: the visitor's own language while a flipLocale step has it flipped. */
type Stored = { i: number; auto: boolean; restore?: Locale };
type Rect = { top: number; left: number; width: number; height: number };

function load(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}
function save(s: Stored | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {}
}

/**
 * First *visible* match. Next keeps recently visited routes mounted but hidden, so a plain
 * querySelector can return an element (or an "open" dialog) from a page you already left.
 */
function visible<T extends Element>(selector: string): T | null {
  for (const el of document.querySelectorAll<T>(selector)) if (el.getClientRects().length > 0) return el;
  return null;
}

/**
 * Close any open modal <dialog> the way its owner expects (a cancel event, as Esc would), so a sheet
 * left open doesn't keep the next page inert. Falls back to a plain close() if nobody handles it.
 */
function closeDialogs() {
  for (const d of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) {
    const ev = new Event("cancel", { cancelable: true });
    if (d.dispatchEvent(ev)) d.close();
  }
}

/** Widgets that use ←/→ themselves (tabs, the donate deck…): the tour leaves those keys alone. */
function ownsArrows(target: HTMLElement | null) {
  if (target?.closest('[role="tab"], [role="radio"], [role="slider"], [role="menuitem"], [role="option"]')) return true;
  return Boolean(visible('[aria-keyshortcuts~="ArrowLeft"], [aria-keyshortcuts~="ArrowRight"]'));
}

/** Height of the sticky header, so scrolled-to targets don't end up underneath it. */
function headerOffset() {
  const h = document.querySelector<HTMLElement>("header.sticky");
  return (h?.offsetHeight ?? 0) + 16;
}

/** Open the tour from anywhere (e.g. a button). */
export function startTour(auto = false) {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: { auto } }));
}

export function GuidedTour() {
  const [state, setState] = useState<Stored | null>(null);
  // Bumped on every (re)start so the runner remounts fresh (not minimized, focus on the card).
  const [run, setRun] = useState(0);

  // Restore after navigation / reload; open from ?tour= or the start event.
  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("tour");
    if (q) {
      url.searchParams.delete("tour");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      const s = { i: 0, auto: q === "auto" };
      save(s);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(s);
    } else {
      setState(load());
    }
    const onStart = (e: Event) => {
      // Restarting mid-tour keeps the language the visitor came with.
      const restore = load()?.restore;
      const s: Stored = { i: 0, auto: Boolean((e as CustomEvent<{ auto?: boolean }>).detail?.auto), restore };
      save(s);
      setState(s);
      setRun((r) => r + 1);
    };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  const update = useCallback((s: Stored | null) => {
    save(s);
    setState(s);
  }, []);

  if (!state) return null;
  return <TourRunner key={run} state={state} update={update} />;
}

function useTourIds(): TourIds | undefined {
  const live = useQuery(api.presenter.liveDemo);
  const cards = useQuery(api.public.listPublishedProjects, { category: "reconstruction" });
  if (live === undefined || cards === undefined) return undefined;
  const others = cards.filter((c) => c.projectId !== live?.projectId);
  const showcase = others.find((c) => c.status === "completed") ?? others[0] ?? null;
  return {
    liveId: live?.projectId ?? null,
    livePublished: live ? live.status === "published" || live.status === "completed" : false,
    showcaseId: showcase?.projectId ?? null,
  };
}

function TourRunner({ state, update }: { state: Stored; update: (s: Stored | null) => void }) {
  const { t, locale, setLocale } = useI18n();
  const { user, signInAs } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const ids = useTourIds();

  const total = TOUR_STEPS.length;
  const i = Math.min(Math.max(state.i, 0), total - 1);
  const step = TOUR_STEPS[i];
  const [rect, setRect] = useState<Rect | null>(null);
  const [mini, setMini] = useState(false);
  const [busy, setBusy] = useState(false);
  // Step index whose target never showed up (e.g. the sheet step with no sheet open): card centers instead.
  const [lostAt, setLostAt] = useState(-1);
  const prepared = useRef<string>("");
  const nextBtn = useRef<HTMLButtonElement>(null);

  const [modal, setModal] = useState<HTMLDialogElement | null>(null);

  const finish = useCallback(() => {
    if (state.restore) setLocale(state.restore);
    update(null);
  }, [state.restore, setLocale, update]);
  const go = useCallback(
    (n: number) => {
      if (n >= total) return finish();
      update({ ...state, i: Math.max(0, n) });
    },
    [state, total, update, finish],
  );
  const next = useCallback(() => go(i + 1), [go, i]);
  // A dialog-only step makes no sense to go back to once its dialog is closed.
  const back = useCallback(() => {
    let n = i - 1;
    while (n > 0 && TOUR_STEPS[n].needsDialog && !modal) n--;
    go(n);
  }, [go, i, modal]);
  const stop = finish;
  const toggleAuto = useCallback(() => update({ ...state, auto: !state.auto }), [state, update]);

  // Focus the card when the tour (re)starts, so keyboard and screen-reader users land in it.
  useEffect(() => {
    nextBtn.current?.focus({ preventScroll: true });
  }, []);

  // 1. Put the app where the step happens: role, page, language.
  useEffect(() => {
    if (user === undefined) return; // session still loading
    const target = step.path ? (ids ? step.path(ids) : undefined) : null;
    if (target === undefined) return; // ids loading
    const key = `${i}|${step.role ?? ""}|${target ?? ""}`;
    if (prepared.current === key) return;
    prepared.current = key;
    // Not cancelled on cleanup: signing in changes `user`, which re-runs this effect mid-flight.
    // Instead, bail out only if the tour has moved to another step meanwhile.
    (async () => {
      if (step.role && user?.role !== step.role) {
        setBusy(true);
        try {
          await signInAs(step.role);
        } catch (err) {
          console.error("[tour] demo sign-in failed", err);
          if (prepared.current === key) prepared.current = ""; // let the next render retry
          return;
        } finally {
          setBusy(false);
        }
      }
      if (prepared.current !== key) return;
      if (target) {
        const here = window.location.pathname + window.location.search;
        if (here !== target) {
          closeDialogs(); // a sheet left open would keep the next page inert
          router.push(target);
        }
      }
    })();
  }, [i, step, ids, user, signInAs, router]);

  // Language demo: flip on the way in, put the visitor's language back on the way out (either direction,
  // or on exit). The original is stored with the tour, so a reload on that step doesn't flip it twice.
  useEffect(() => {
    if (step.flipLocale && !state.restore) {
      update({ ...state, restore: locale });
      setLocale(locale === "es" ? "en" : "es");
    } else if (!step.flipLocale && state.restore) {
      setLocale(state.restore);
      update({ ...state, restore: undefined });
    }
  }, [step.flipLocale, state, locale, setLocale, update]);

  // 2. Find the target (keep looking while the step is open: it may appear after a click), scroll to it, track it.
  useLayoutEffect(() => {
    if (!step.target) return;
    let raf = 0;
    let scrolled = false;
    let last = "stale"; // forces a reset on the first frame if the target isn't there yet
    const tick = () => {
      const el = visible<HTMLElement>(step.target!);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        if (!scrolled) {
          scrolled = true;
          // Elements inside a modal dialog don't move with the page; leave the page scroll alone.
          if (!el.closest("dialog")) {
            const offset = headerOffset();
            const room = window.innerHeight - offset;
            // Phones: target to the top, the card docks at the bottom. Wide screens: center it,
            // unless it's too tall to fit, then show its top under the sticky header.
            const toTop = narrow() || r.height > room * 0.8;
            const y = window.scrollY + r.top - offset - (toTop ? 0 : Math.max(0, (room - r.height) / 2));
            window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? "auto" : "smooth" });
          }
        }
        const sig = `${r.top}|${r.left}|${r.width}|${r.height}`;
        if (sig !== last) {
          last = sig;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      } else if (last) {
        last = "";
        scrolled = false;
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, step.target, pathname]);

  // Give a missing target a moment once we're on the right page (data loading, a dialog opening),
  // then stop waiting and show the card centered.
  const dest = step.path && ids ? step.path(ids) : null;
  const arrived = !dest || pathname === dest.split("?")[0];
  const waiting = Boolean(step.target) && !rect;
  useEffect(() => {
    if (!waiting || busy || !arrived) return;
    const id = setTimeout(() => setLostAt(i), 2500);
    return () => clearTimeout(id);
  }, [waiting, busy, arrived, i]);
  const lost = waiting && lostAt === i;

  // 3. Autoplay. The clock starts once the step is actually on screen (signed in, page loaded,
  //    target found), so slow navigations don't eat into the reading time.
  const dwell = step.ms ?? 9000;
  const ready = !busy && !(waiting && !lost);
  useEffect(() => {
    if (!state.auto || !ready) return;
    const id = setTimeout(next, dwell);
    return () => clearTimeout(id);
  }, [state.auto, ready, next, dwell, i]);

  // 4. Keyboard (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        if (!visible('dialog[open], [role="dialog"]')) stop(); // otherwise let the dialog close first
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (ownsArrows(el)) return; // e.g. ← on the donate deck passes a card; don't also rewind the tour
        if (e.key === "ArrowRight") next();
        else back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, stop]);

  // 5. Scripting hook for recordings.
  useEffect(() => {
    const w = window as unknown as { __impactoTour?: unknown };
    w.__impactoTour = { next, back, go, stop, step: step.id, index: i };
    return () => {
      delete w.__impactoTour;
    };
  }, [next, back, go, stop, step.id, i]);

  // 6. A native modal <dialog> sits in the top layer and makes everything else inert, so while one is
  //    open the narration moves *inside* it (portaled, first in its flex column).
  useEffect(() => {
    const id = setInterval(() => {
      const d = visible<HTMLDialogElement>("dialog[open]");
      setModal((m) => (m === d ? m : d));
    }, 200);
    return () => clearInterval(id);
  }, []);
  // Opening the pledge sheet from the deck step is the "try it": move on to the sheet step. Closing it
  // again on the sheet step means they're done there. Only on the open/close *transition*, so going
  // Back to the deck with the sheet still open doesn't bounce straight forward again.
  const prevModal = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const was = prevModal.current;
    prevModal.current = modal;
    if (!was && modal && step.id === "deck") next();
    else if (was && !modal && step.needsDialog) next();
  }, [modal, step.id, step.needsDialog, next]);

  // Spotlight = the target's box (padded), clipped to the viewport on every side.
  const pad = 10;
  let spot: Rect | null = null;
  if (rect) {
    const top = Math.max(rect.top - pad, 4);
    const left = Math.max(rect.left - pad, 4);
    const bottom = Math.min(rect.top + rect.height + pad, window.innerHeight - 4);
    const right = Math.min(rect.left + rect.width + pad, window.innerWidth - 4);
    if (bottom - top > 8 && right - left > 8) spot = { top, left, width: right - left, height: bottom - top };
  }
  // Dock the card away from the target: the other side on wide screens, top/bottom on phones.
  const dockLeft = spot ? spot.left + spot.width / 2 > window.innerWidth * 0.55 : false;
  const dockTop = spot ? narrow() && spot.top + spot.height / 2 > window.innerHeight * 0.55 : false;
  const centered = !step.target || lost;
  const roleLabel = step.role ? t(`role.${step.role}` as DictKey) : null;

  const stepLabel = t("tour.stepOf").replace("{n}", String(i + 1)).replace("{total}", String(total));

  if (modal) {
    return createPortal(
      <aside
        aria-label={t("tour.label")}
        aria-live="polite"
        data-tour-card
        key={step.id}
        style={{ order: -1 }}
        className="tour-card shrink-0 border-b border-border bg-navy-soft px-5 py-3.5 sm:px-7"
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t("tour.label")} · {stepLabel}
            </p>
            <p className="mt-0.5 font-display text-[1.2rem] leading-tight text-navy">{t(step.titleKey)}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-foreground/85">{t(step.bodyKey)}</p>
            {step.tryKey && (
              <p className="mt-1.5 text-[13px] text-gold-ink">
                <span className="font-semibold">{t("tour.tryIt")}: </span>
                {t(step.tryKey)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={next}
            data-tour-next
            className="mt-1 min-h-10 shrink-0 bg-navy px-4 text-[13px] font-semibold text-white hover:bg-navy-hover"
          >
            {i === total - 1 ? t("tour.finish") : t("tour.next")}
          </button>
        </div>
      </aside>,
      modal,
    );
  }

  if (mini) {
    return (
      <button
        type="button"
        onClick={() => setMini(false)}
        data-tour-card
        className="tour-card fixed bottom-4 right-4 z-[70] flex min-h-11 items-center gap-2 border border-border bg-surface px-4 text-[13px] font-semibold text-navy shadow-[0_10px_30px_-10px_rgba(8,22,48,0.45)] sm:bottom-6 sm:right-6"
      >
        <span aria-hidden className="size-2 rounded-full bg-gold" />
        {t("tour.label")} · {stepLabel}
        <span className="text-muted">— {t("tour.expand")}</span>
      </button>
    );
  }

  return (
    <div className="tour-root">
      {/* Stable live region (the card itself remounts per step, which screen readers can miss). */}
      <p className="sr-only" aria-live="polite">
        {stepLabel}. {t(step.titleKey)}. {t(step.bodyKey)}
      </p>
      {/* Dim + spotlight (visual only). */}
      {centered ? (
        <div aria-hidden className="tour-dim fixed inset-0 z-[60] pointer-events-none" />
      ) : (
        spot && (
          <div
            aria-hidden
            className="tour-spot fixed z-[60] pointer-events-none"
            style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
          />
        )
      )}

      <aside
        aria-label={t("tour.label")}
        data-tour-card
        key={step.id}
        className={`tour-card fixed z-[70] w-[calc(100vw-2rem)] max-w-[25rem] border border-border bg-surface text-foreground shadow-[0_18px_50px_-12px_rgba(8,22,48,0.45)] ${
          centered
            ? "inset-0 m-auto h-fit max-w-[30rem]"
            : `${dockTop ? "top-4" : "bottom-4"} ${dockLeft ? "left-4 sm:left-6" : "right-4 sm:right-6"} sm:bottom-6 sm:top-auto`
        }`}
      >
        {/* Tricolor band doubles as the autoplay progress bar. */}
        <div className="relative flex h-1.5" aria-hidden>
          <span className="flex-[2] bg-gold" />
          <span className="flex-1 bg-navy" />
          <span className="flex-1 bg-red" />
          {state.auto && ready && (
            <span
              key={`p-${i}`}
              className="tour-progress absolute inset-y-0 left-0 bg-white/60"
              style={{ animationDuration: `${dwell}ms` }}
            />
          )}
        </div>

        <div className="max-h-[48vh] overflow-y-auto px-5 pb-4 pt-4 sm:max-h-none sm:px-6 sm:pt-5">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
            <span>{stepLabel}</span>
            {roleLabel && (
              <>
                <span aria-hidden>·</span>
                <span className="text-navy">{roleLabel}</span>
              </>
            )}
            <button
              type="button"
              onClick={() => setMini(true)}
              aria-label={t("tour.minimize")}
              title={t("tour.minimize")}
              className="ml-auto grid size-9 place-items-center text-lg leading-none text-muted hover:text-foreground"
            >
              –
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label={t("tour.exit")}
              className="-mr-2 grid size-9 place-items-center text-lg leading-none text-muted hover:text-foreground"
            >
              ×
            </button>
          </div>

          <h2 className="mt-1 font-display text-[1.6rem] font-normal leading-[1.1] sm:text-[1.8rem]">{t(step.titleKey)}</h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-foreground/85">{t(step.bodyKey)}</p>

          {step.tryKey && (
            <p className="mt-3 border-l-[3px] border-gold bg-gold-soft px-3 py-2 text-[14px] text-gold-ink">
              <span className="font-semibold">{t("tour.tryIt")}: </span>
              {t(step.tryKey)}
            </p>
          )}

          {busy && <p className="mt-3 text-[13px] text-muted">{t("tour.loading")}</p>}

          <ol className="mt-4 flex gap-1" aria-hidden>
            {TOUR_STEPS.map((s, n) => (
              <li
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors ${n < i ? "bg-navy" : n === i ? "bg-gold" : "bg-border"}`}
              />
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAuto}
              className="min-h-11 px-2 text-[13px] font-semibold text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              {state.auto ? `❚❚ ${t("tour.pause")}` : `▶ ${t("tour.play")}`}
            </button>
            <div className="ml-auto flex gap-2">
              {i > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="min-h-11 border border-navy px-4 text-[14px] font-semibold text-navy hover:bg-navy-soft"
                >
                  {t("tour.back")}
                </button>
              )}
              <button
                ref={nextBtn}
                type="button"
                onClick={next}
                data-tour-next
                className="min-h-11 bg-navy px-5 text-[14px] font-semibold text-white hover:bg-navy-hover"
              >
                {i === total - 1 ? t("tour.finish") : t("tour.next")}
              </button>
            </div>
          </div>
          <p className="mt-2 hidden text-[12px] text-muted sm:block">{t("tour.keys")}</p>
        </div>
      </aside>
    </div>
  );
}

function narrow() {
  return window.innerWidth < 640;
}

function reduceMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
