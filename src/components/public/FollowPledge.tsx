"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { CategoryBadge } from "./CategoryBadge";
import { LedgerBar } from "./LedgerBar";
import { MaterialImage } from "./MaterialImage";
import { Timeline, toTimelineItems } from "./Timeline";
import { CheckIcon } from "./VerifiedBadge";

export function FollowPledge() {
  const { token } = useParams<{ token: string }>();
  const { t, pick, locale } = useI18n();
  const data = useQuery(api.public.followPledge, { followToken: token });
  const cancel = useMutation(api.pledges.cancel);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  if (data === undefined) return <p className="py-16 text-muted">{t("common.loading")}</p>;
  if (data === null) {
    return (
      <div className="py-16">
        <p className="font-display text-2xl font-semibold">{t("project.follow.notFound")}</p>
        <Link href="/donate" className="mt-4 inline-block font-semibold underline underline-offset-4">
          {t("nav.donate")}
        </Link>
      </div>
    );
  }

  const name = pick(data.need.nameEs, data.need.nameEn);
  // Use is tracked per need, not per pledge: count this step done once everything received for the need is used.
  const usedReached = data.receivedQty > 0 && data.need.ledger.used >= data.need.ledger.received;
  const steps = [
    { key: "pledged", done: true },
    { key: "received", done: data.receivedQty > 0 },
    { key: "used", done: usedReached },
  ] as const;
  const inactive = data.status === "canceled" || data.status === "expired";
  const fmt = new Intl.DateTimeFormat(locale === "es" ? "es-PR" : "en-US", { day: "numeric", month: "long" });

  async function onCancel() {
    if (!window.confirm(t("project.follow.cancelConfirm"))) return;
    setBusy(true);
    setErr(false);
    try {
      await cancel({ followToken: token });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-6 sm:pt-10 max-w-2xl">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold">{t("project.follow.title")}</h1>

      <section className="mt-6 rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 rounded-2xl bg-background grid place-items-center">
            <MaterialImage itemKey={data.need.itemKey} alt="" className="size-14" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-3xl font-semibold tabular-nums leading-none">
              {data.qty} <span className="text-lg">{data.need.unit}</span>
            </p>
            <p className="text-muted">{name}</p>
          </div>
        </div>

        <p
          role="status"
          className={`mt-5 inline-flex rounded-2xl border-2 px-4 py-2 font-display text-xl font-semibold ${
            inactive
              ? "border-border text-muted"
              : data.status === "fulfilled"
                ? "border-sky bg-sky-soft text-sky"
                : "border-amber bg-amber-soft text-amber"
          }`}
        >
          {t(`project.follow.status.${data.status}` as DictKey)}
        </p>

        {!inactive && (
          <ol className="mt-6 grid grid-cols-3 gap-2" aria-label={t("project.follow.status")}>
            {steps.map((s, i) => (
              <li key={s.key} className="relative">
                <div className="flex items-center">
                  <span
                    className={`relative z-10 grid place-items-center size-9 rounded-full ${
                      s.done
                        ? s.key === "pledged"
                          ? "bg-amber text-white"
                          : "bg-sky text-white"
                        : "border-2 border-border bg-surface text-muted"
                    }`}
                    aria-hidden
                  >
                    {s.done ? <CheckIcon className="size-4" /> : <span className="text-sm font-semibold">{i + 1}</span>}
                  </span>
                  {i < steps.length - 1 && (
                    <span className={`h-1 flex-1 ${steps[i + 1].done ? "bg-sky" : "bg-border"}`} aria-hidden />
                  )}
                </div>
                <p className={`mt-2 text-sm ${s.done ? "font-semibold" : "text-muted"}`}>
                  {t(`project.follow.step.${s.key}` as DictKey)}
                  <span className="sr-only">{s.done ? " ✓" : ""}</span>
                </p>
                {s.key === "received" && data.receivedQty > 0 && (
                  <p className="text-xs text-muted tabular-nums">
                    {data.receivedQty} {t("project.follow.qtyOf")} {data.qty}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="mt-6 pt-5 border-t border-border">
          <LedgerBar ledger={data.need.ledger} unit={data.need.unit} compact showAvailable={false} />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">{t("project.follow.mode")}</dt>
            <dd className="font-semibold">{t(`donate.mode.${data.mode}` as DictKey)}</dd>
          </div>
          {data.status === "active" && (
            <div>
              <dt className="text-muted">{t("project.follow.expires")}</dt>
              <dd className="font-semibold">{fmt.format(data.expiresAt)}</dd>
            </div>
          )}
        </dl>

        {data.status === "active" && (
          <div className="mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-12 px-6 rounded-full border-2 border-brick text-brick font-semibold disabled:opacity-50"
            >
              {busy ? t("project.follow.canceling") : t("project.follow.cancel")}
            </button>
            {err && (
              <p role="alert" className="mt-2 text-sm text-brick">
                {t("project.follow.cancelError")}
              </p>
            )}
          </div>
        )}
      </section>

      {data.project && (
        <section className="mt-10" aria-labelledby="ftl">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={data.project.category} />
          </div>
          <h2 id="ftl" className="mt-2 font-display text-2xl font-semibold">
            <Link href={`/p/${data.project.projectId}`} className="underline underline-offset-4 decoration-2">
              {data.project.publicAlias}
            </Link>
          </h2>
          <p className="text-muted">{pick(data.project.titleEs, data.project.titleEn)}</p>
          {data.project.status === "paused" && (
            <div role="status" className="mt-4 rounded-2xl border-2 border-amber bg-amber-soft px-4 py-3 text-sm">
              <strong className="text-amber">{t("project.paused")}.</strong>{" "}
              {data.project.safetyPauseReasonPublic || t("project.pausedDefault")}
            </div>
          )}
          <h3 className="mt-6 font-semibold">{t("project.follow.projectTimeline")}</h3>
          <div className="mt-4">
            <Timeline items={toTimelineItems(data.timeline)} />
          </div>
        </section>
      )}
    </div>
  );
}
