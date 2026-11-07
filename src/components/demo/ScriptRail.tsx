"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, btn } from "@/components/ui/tricolor";
import { DEMO_STEPS, RUN_SECONDS, clock, scheduledStep, type LiveIds } from "./steps";
import type { useDemoClock } from "./useDemoClock";

type Clock = ReturnType<typeof useDemoClock>;

export function Stopwatch({ c }: { c: Clock }) {
  const { t } = useI18n();
  const step = DEMO_STEPS[c.step];
  const target = step.to - step.from;
  const over = c.stepElapsed > target;
  const totalOver = c.elapsed > RUN_SECONDS;
  const should = scheduledStep(c.elapsed);
  return (
    <section aria-labelledby="demo-timer" className="border border-border bg-surface p-4">
      <h2 id="demo-timer" className="text-sm font-semibold text-muted">
        {t("demo.timer")}
      </h2>
      <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-muted">{t("demo.timerTotal")}</p>
          <p
            className={`font-display text-5xl leading-none tabular-nums ${totalOver ? "text-red" : "text-foreground"}`}
            aria-label={`${t("demo.timerTotal")} ${clock(c.elapsed)} ${t("demo.timerOf")} ${clock(RUN_SECONDS)}`}
          >
            {clock(c.elapsed)}
            <span className="ml-2 text-xl text-muted">/ {clock(RUN_SECONDS)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">
            {t("demo.timerStep")} {step.n} · {t("demo.timerTarget")} {target} s
          </p>
          <p className={`font-display text-3xl leading-none tabular-nums ${over ? "text-red" : "text-foreground"}`}>
            {clock(c.stepElapsed)}
            <span className="ml-2 text-base text-muted">/ {clock(target)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.running ? (
            <Button variant="secondary" onClick={c.pause}>
              {t("demo.timerPause")}
            </Button>
          ) : (
            <Button onClick={c.start}>{c.elapsed > 0 ? t("demo.timerResume") : t("demo.timerStart")}</Button>
          )}
          <Button variant="quiet" onClick={c.reset}>
            {t("demo.timerReset")}
          </Button>
        </div>
      </div>
      {c.elapsed > 0 && (
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {over ? <Chip tone="red">{t("demo.timerOver")}</Chip> : <Chip tone="neutral">{t("demo.timerOnTrack")}</Chip>}
          {should !== c.step && (
            <span className="ml-2">
              {t("demo.timerShouldBe")} {DEMO_STEPS[should].n}.
            </span>
          )}
        </p>
      )}
    </section>
  );
}

export function ScriptRail({ c, live, newTab }: { c: Clock; live: LiveIds | undefined; newTab: boolean }) {
  const { t, setLocale } = useI18n();
  const { signInAs } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<{ step: number; key: DictKey } | null>(null);

  async function go(i: number, href: string, role = DEMO_STEPS[i].role) {
    const step = DEMO_STEPS[i];
    setBusy(i);
    setNote(null);
    // Open the tab synchronously inside the click so popup blockers allow it; navigate after sign-in.
    const win = newTab ? window.open("", "_blank") : null;
    try {
      await signInAs(role);
      if (step.locale) setLocale(step.locale);
      c.goToStep(i, true);
      if (newTab && win) {
        win.location.href = href;
      } else {
        if (newTab && !win) setNote({ step: i, key: "demo.popupBlocked" });
        router.push(href);
      }
    } catch {
      win?.close();
      setNote({ step: i, key: "demo.goError" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="demo-script">
      <h2 id="demo-script" className="font-display text-3xl font-normal">
        {t("demo.scriptTitle")}
      </h2>
      <ol className="mt-4 space-y-3">
        {DEMO_STEPS.map((s, i) => {
          const current = c.step === i;
          const liveIds = live ?? null;
          const href = s.href(liveIds);
          const altHref = s.alt?.href(liveIds) ?? null;
          return (
            <li
              key={s.n}
              aria-current={current ? "step" : undefined}
              className={`border bg-surface p-4 sm:p-5 ${current ? "border-rule shadow-[inset_4px_0_0_var(--navy)]" : "border-border"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl font-normal">
                  <span className="mr-2 text-muted tabular-nums">{s.n}.</span>
                  {t(s.titleKey)}
                </h3>
                <p className="text-sm font-semibold tabular-nums text-muted">
                  {clock(s.from)}–{clock(s.to)} · {s.to - s.from} s
                </p>
              </div>
              <p className="mt-1 text-sm">
                <span className="text-muted">{t("demo.roleLabel")}: </span>
                <span className="font-semibold">{t(`role.${s.role}`)}</span>
                {current && (
                  <Chip tone="navy" className="ml-2">
                    {t("demo.current")}
                  </Chip>
                )}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                {s.points.map((p) => (
                  <li key={p}>{t(p)}</li>
                ))}
              </ul>
              {s.noteKey && <p className="mt-2 text-sm italic text-muted">{t(s.noteKey)}</p>}
              {s.needsLive && live === null && <p className="mt-2 text-sm text-red">{t("demo.noLiveProject")}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  variant={current ? "primary" : "secondary"}
                  busy={busy === i}
                  disabled={busy !== null}
                  onClick={() => go(i, href)}
                  aria-label={`${t("demo.go")}: ${t(s.titleKey)} (${t(`role.${s.role}`)})`}
                >
                  {busy === i ? t("demo.going") : `${t("demo.go")} · ${t(`role.${s.role}`)}`}
                </Button>
                {altHref && (
                  <button
                    type="button"
                    className={btn("quiet", "md", "min-h-11")}
                    disabled={busy !== null}
                    onClick={() => go(i, altHref)}
                  >
                    {t(s.alt!.labelKey)}
                  </button>
                )}
                {!current && (
                  <button type="button" className={btn("quiet", "md", "min-h-11 text-muted")} onClick={() => c.goToStep(i)}>
                    {t("demo.markCurrent")}
                  </button>
                )}
              </div>
              {note?.step === i && (
                <p role="status" className={`mt-2 text-sm ${note.key === "demo.goError" ? "text-red" : "text-muted"}`}>
                  {t(note.key)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
