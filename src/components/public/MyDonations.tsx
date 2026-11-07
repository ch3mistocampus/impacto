"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { parsePledges, pledgesSnapshot, subscribePledges, type SavedPledge } from "@/components/donate/followTokens";
import { CategoryBadge } from "./CategoryBadge";
import { MaterialImage } from "./MaterialImage";
import { PledgeProgress, VerifiedHeadline, pledgeStageQty } from "./PledgeProgress";
import { DemoStamp, DemoTag, PausedNotice, StatusBadge, useDateFmt } from "./PublicMeta";
import { api } from "../../../convex/_generated/api";
import type { FollowPledgeData } from "./publicApi";

type Row = { saved: SavedPledge; data: FollowPledgeData | null };

export function MyDonations() {
  const { t } = useI18n();
  // null on the server / before hydration so we don't flash "empty".
  const raw = useSyncExternalStore(subscribePledges, pledgesSnapshot, () => null);
  const saved = useMemo(() => (raw === null ? null : parsePledges(raw)), [raw]);
  const tokens = useMemo(() => (saved ?? []).map((p) => p.token), [saved]);
  const results = useQuery(api.public.myPledges, saved && tokens.length > 0 ? { followTokens: tokens } : "skip");

  const rows: Row[] | undefined = useMemo(() => {
    if (!saved) return undefined;
    if (tokens.length === 0) return [];
    if (results === undefined) return undefined;
    // myPledges omits tokens: match by pledgeId (saved since Update 2), else by item + qty + closest time.
    const pool = [...results];
    const take = (i: number) => (i >= 0 ? pool.splice(i, 1)[0] : null);
    const byToken = new Map<string, Row["data"]>();
    for (const sp of saved) {
      if (!sp.pledgeId) continue;
      byToken.set(sp.token, take(pool.findIndex((r) => r.pledgeId === sp.pledgeId)));
    }
    for (const sp of saved) {
      if (sp.pledgeId) continue;
      let best = -1;
      let bestGap = 10 * 60_000;
      pool.forEach((r, i) => {
        const gap = Math.abs(r.createdAt - sp.at);
        if (r.qty === sp.qty && r.need.nameEs === sp.nameEs && gap < bestGap) {
          best = i;
          bestGap = gap;
        }
      });
      byToken.set(sp.token, take(best));
    }
    return saved.map((s) => ({ saved: s, data: byToken.get(s.token) ?? null }));
  }, [saved, tokens, results]);

  const totals = useMemo(() => {
    let pledged = 0;
    let verified = 0;
    for (const r of rows ?? []) {
      if (!r.data || r.data.status === "canceled" || r.data.status === "expired") continue;
      const q = pledgeStageQty(r.data);
      pledged += q.pledged;
      verified += q.verified;
    }
    return { pledged, verified };
  }, [rows]);

  return (
    <div className="pt-6 sm:pt-10 max-w-3xl">
      <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.05]">{t("donations.title")}</h1>
      <p className="mt-3 text-lg text-muted leading-relaxed">{t("donations.lead")}</p>
      <DemoStamp className="mt-4" />

      {rows === undefined ? (
        <p className="mt-10 text-muted">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-3xl border-2 border-dashed border-border p-8 text-center">
          <p className="font-display text-2xl font-semibold">{t("donations.empty")}</p>
          <Link
            href="/donate"
            className="mt-5 inline-flex rounded-full bg-clay text-white px-6 py-3.5 font-semibold shadow-[0_2px_0_var(--brick)]"
          >
            {t("donations.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 border-y-2 border-foreground/80">
            <div className="py-4 pr-3">
              <dd className="font-display text-4xl font-semibold tabular-nums text-amber">{totals.pledged}</dd>
              <dt className="text-sm text-muted">{t("donations.totalPledged")}</dt>
            </div>
            <div className="py-4 pl-4 border-l border-border">
              <dd className="font-display text-4xl font-semibold tabular-nums text-leaf">{totals.verified}</dd>
              <dt className="text-sm font-semibold text-leaf">{t("donations.totalVerified")}</dt>
            </div>
          </dl>
          <ul className="mt-8 space-y-5">
            {rows.map((r) => (
              <PledgeItem key={r.saved.token} row={r} />
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted">{t("donations.localOnly")}</p>
        </>
      )}
    </div>
  );
}

function PledgeItem({ row }: { row: Row }) {
  const { t, pick } = useI18n();
  const fmt = useDateFmt();
  const { saved, data } = row;
  if (!data) {
    return (
      <li className="rounded-3xl border border-border bg-surface p-5">
        <p className="font-display text-xl font-semibold tabular-nums">
          {saved.qty} {pick(saved.nameEs, saved.nameEn)} <span className="text-muted text-base">({saved.alias})</span>
        </p>
        <p className="mt-1 text-sm text-muted">{t("donations.missing")}</p>
      </li>
    );
  }
  const inactive = data.status === "canceled" || data.status === "expired";
  const verified = pledgeStageQty(data).verified;
  return (
    <li className={`rounded-3xl border bg-surface p-5 sm:p-6 ${verified > 0 ? "border-leaf/50" : "border-border"}`}>
      <div className="flex items-start gap-4">
        <div className="size-14 shrink-0 rounded-2xl bg-background grid place-items-center">
          <MaterialImage itemKey={data.need.itemKey} alt="" className="size-12" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {data.project && <CategoryBadge category={data.project.category} />}
            {data.project && <StatusBadge status={data.project.status} />}
            <DemoTag />
          </div>
          <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums leading-tight">
            {data.qty} {pick(data.need.nameEs, data.need.nameEn).toLocaleLowerCase()}
          </p>
          <p className="text-sm text-muted">
            {data.project?.publicAlias ?? saved.alias} · {t(`donate.mode.${data.mode}` as DictKey)} ·{" "}
            {fmt.date(data.createdAt)}
          </p>
        </div>
      </div>

      {inactive ? (
        <p className="mt-4 inline-flex rounded-xl border-2 border-border px-3 py-1.5 font-semibold text-muted">
          {t(`project.follow.status.${data.status}` as DictKey)}
        </p>
      ) : (
        <>
          <div className="mt-5">
            <PledgeProgress data={data} compact />
          </div>
          {verified > 0 ? (
            <VerifiedHeadline data={data} className="mt-4 text-2xl" />
          ) : (
            <p className="mt-4 text-sm font-semibold text-amber">{t("donations.notYetVerified")}</p>
          )}
        </>
      )}

      {data.project?.status === "paused" && (
        <div className="mt-4">
          <PausedNotice reason={data.project.safetyPauseReasonPublic} compact />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        <Link href={`/follow/${saved.token}`} className="underline underline-offset-4 decoration-2">
          {t("donations.follow")}
        </Link>
        {data.project && (
          <Link
            href={`/transparency/projects/${data.project.projectId}`}
            className="underline underline-offset-4 decoration-2"
          >
            {t("donate.viewProject")}
          </Link>
        )}
      </div>
    </li>
  );
}
