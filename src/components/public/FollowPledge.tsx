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
import { MaterialGlyph } from "@/components/ui/MaterialGlyph";
import { DoubleRule, FlagBand, Kicker, StageSwatch, btn, intlLocale } from "@/components/ui/tricolor";
import { Timeline, toTimelineItems } from "./Timeline";
import { PledgeProgress, VerifiedHeadline, pledgeStageQty } from "./PledgeProgress";
import { DemoStamp, PausedNotice, StatusBadge } from "./PublicMeta";
import { ConfirmDialog } from "../ConfirmDialog";

export function FollowPledge() {
  const { token } = useParams<{ token: string }>();
  const { t, pick, locale, u } = useI18n();
  const data = useQuery(api.public.followPledge, { followToken: token });
  const cancel = useMutation(api.pledges.cancel);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (data === undefined) return <p className="py-16 text-muted">{t("common.loading")}</p>;
  if (data === null) {
    return (
      <div className="py-16">
        <p className="font-display text-2xl font-normal">{t("project.follow.notFound")}</p>
        <Link href="/donate" className={btn("quiet", "md", "mt-4")}>
          {t("nav.donate")}
        </Link>
      </div>
    );
  }

  const name = pick(data.need.nameEs, data.need.nameEn);
  const inactive = data.status === "canceled" || data.status === "expired";
  const tag = intlLocale(locale);
  const fmt = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long" });
  const nf = new Intl.NumberFormat(tag);

  async function onCancel() {
    setBusy(true);
    setErr(false);
    try {
      await cancel({ followToken: token });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const stamp = inactive
    ? "border-border text-muted outline-border"
    : data.status === "fulfilled"
      ? "border-rule text-foreground outline-rule"
      : "border-gold-ink text-gold-ink outline-gold-ink";

  return (
    <div className="pt-6 sm:pt-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/donations" className={btn("quiet", "md", "text-sm text-muted")}>
          {t("donations.title")}
        </Link>
        <DemoStamp />
      </div>

      <section
        aria-labelledby="follow-title"
        className="mt-5 border border-border bg-surface"
      >
        <FlagBand thickness={5} />
        <div className="px-5 sm:px-10 pt-7 pb-8">
          <div className="text-center">
            <Kicker className="text-base">{t("donate.receipt.kicker")}</Kicker>
            <h1 id="follow-title" className="mt-1 font-display text-3xl sm:text-4xl font-normal">
              {t("project.follow.title")}
            </h1>
            <MaterialGlyph itemKey={data.need.itemKey} className="mx-auto mt-5 size-12 text-foreground" />
            <p className="mt-2 font-display text-7xl sm:text-8xl font-normal tabular-nums leading-none">
              {nf.format(data.qty)}
            </p>
            <p className="mt-2 text-lg">
              {u(data.need.unit)} <span className="text-muted">· {name}</span>
            </p>
            <p
              role="status"
              className={`mt-6 inline-flex -rotate-2 items-center gap-2 rounded-[2px] border px-4 py-2 font-display italic text-xl outline outline-1 outline-offset-[3px] ${stamp}`}
            >
              {data.status === "active" && <StageSwatch stage="pledged" size={12} />}
              {t(`project.follow.status.${data.status}` as DictKey)}
            </p>
          </div>

          <DoubleRule className="my-7" />

          {!inactive && (
            <div>
              <PledgeProgress data={data} />
              {pledgeStageQty(data).verified > 0 ? (
                <VerifiedHeadline data={data} className="mt-6 text-3xl text-center" />
              ) : (
                <p className="mt-6 text-center text-[15px] font-semibold text-gold-ink">{t("donations.notYetVerified")}</p>
              )}
            </div>
          )}

          <div className={`${inactive ? "" : "mt-7 pt-6 border-t border-border"}`}>
            <LedgerBar ledger={data.need.ledger} unit={data.need.unit} compact showAvailable={false} />
          </div>

          <dl className="mt-6 grid grid-cols-2 border-y border-border text-[15px]">
            <div className="py-3 pr-3">
              <dt className="text-sm text-muted">{t("project.follow.mode")}</dt>
              <dd className="font-semibold">{t(`donate.mode.${data.mode}` as DictKey)}</dd>
            </div>
            {data.status === "active" && (
              <div className="py-3 pl-4 border-l border-border">
                <dt className="text-sm text-muted">{t("project.follow.expires")}</dt>
                <dd className="font-semibold">{fmt.format(data.expiresAt)}</dd>
              </div>
            )}
          </dl>

          {data.status === "active" && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={busy}
                aria-haspopup="dialog"
                className={btn("danger", "md")}
              >
                {busy ? t("project.follow.canceling") : t("project.follow.cancel")}
              </button>
              <ConfirmDialog
                open={confirming}
                title={t("project.follow.cancelTitle")}
                body={t("project.follow.cancelConfirm")}
                confirmLabel={busy ? t("project.follow.canceling") : t("project.follow.cancel")}
                cancelLabel={t("project.follow.cancelKeep")}
                busy={busy}
                onConfirm={onCancel}
                onCancel={() => setConfirming(false)}
              />
              {err && (
                <p role="alert" className="mt-2 text-sm text-red">
                  {t("project.follow.cancelError")}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {data.project && (
        <section className="mt-12" aria-labelledby="ftl">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={data.project.category} />
            <StatusBadge status={data.project.status} />
          </div>
          <h2 id="ftl" className="mt-3 font-display text-3xl font-normal">
            <Link
              href={`/transparency/projects/${data.project.projectId}`}
              className="underline decoration-1 underline-offset-[6px] hover:decoration-2"
            >
              {data.project.publicAlias}
            </Link>
          </h2>
          <p className="mt-1 text-muted">{pick(data.project.titleEs, data.project.titleEn)}</p>
          {data.project.status === "paused" && (
            <div className="mt-4">
              <PausedNotice reason={pick(data.project.safetyPauseReasonPublic ?? undefined, data.project.safetyPauseReasonPublicEn ?? undefined) || null} compact />
            </div>
          )}
          <h3 className="mt-8 border-t border-rule pt-4 font-display text-xl font-normal">
            {t("project.follow.projectTimeline")}
          </h3>
          <div className="mt-4">
            <Timeline items={toTimelineItems(data.timeline)} />
          </div>
        </section>
      )}
    </div>
  );
}
