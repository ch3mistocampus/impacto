"use client";

import { useId } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { Chip, DoubleRule, FlagBand, Kicker, btn } from "@/components/ui/tricolor";
import { ScriptRail, Stopwatch } from "./ScriptRail";
import { LiveSplitView } from "./LiveSplitView";
import { Preflight } from "./Preflight";
import { useDemoClock, useNewTabPref } from "./useDemoClock";

/**
 * /demo — presenter console for the 3-minute judging run (ROADMAP D3).
 * Script rail with one-click role switch, stopwatch, pre-flight checklist + reset, and a
 * read-only live split view (donor card · coordinator ledger · public timeline).
 */
export function PresenterConsole() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useSession();
  const live = useQuery(api.presenter.liveDemo);
  const c = useDemoClock();
  const [newTab, setNewTab] = useNewTabPref();
  const tabId = useId();
  const liveIds = live === undefined ? undefined : live ? { projectId: live.projectId, bricksNeedId: live.bricksNeedId } : null;

  return (
    <div className="pt-6">
      <FlagBand />
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Kicker>{t("demo.kicker")}</Kicker>
          <h1 className="font-display text-4xl font-normal leading-tight sm:text-5xl">{t("demo.title")}</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">{t("demo.lead")}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Chip tone="gold">{t("demo.dataLabel")}</Chip>
          {user && (
            <p className="text-sm text-muted">
              {t("nav.viewingAs")}: <span className="font-semibold text-foreground">{t(`role.${user.role}`)}</span>
            </p>
          )}
          <button
            type="button"
            className={btn("secondary", "sm")}
            onClick={() => setLocale(locale === "es" ? "en" : "es")}
            lang={locale === "es" ? "en" : "es"}
          >
            {t("demo.langSwitch")}
          </button>
        </div>
      </header>
      <DoubleRule className="mt-6" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="order-2 lg:order-1">
          <ScriptRail c={c} live={liveIds} newTab={newTab} />
        </div>
        <aside className="order-1 space-y-4 lg:order-2">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Stopwatch c={c} />
            <fieldset className="border border-border bg-surface p-4">
              <legend className="px-1 text-sm font-semibold text-muted">{t("demo.settings")}</legend>
              <label htmlFor={tabId} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                <input
                  id={tabId}
                  type="checkbox"
                  className="size-5 accent-[var(--navy)]"
                  checked={newTab}
                  onChange={(e) => setNewTab(e.target.checked)}
                />
                {t("demo.openNewTab")}
              </label>
            </fieldset>
            <Preflight live={live} onReset={c.reset} />
          </div>
        </aside>
      </div>

      <LiveSplitView live={live} />
    </div>
  );
}
