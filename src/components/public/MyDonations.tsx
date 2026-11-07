"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { DoubleRule, FlagBand, Kicker, StageSwatch, btn, intlLocale } from "@/components/ui/tricolor";
import { MaterialGlyph } from "@/components/ui/MaterialGlyph";
import { parsePledges, pledgesSnapshot, subscribePledges, type SavedPledge } from "@/components/donate/followTokens";
import { CategoryBadge } from "./CategoryBadge";
import { PledgeProgress, VerifiedHeadline, pledgeStageQty } from "./PledgeProgress";
import { DemoStamp, PausedNotice, StatusBadge, useDateFmt } from "./PublicMeta";
import { api } from "../../../convex/_generated/api";
import type { FollowPledgeData } from "./publicApi";

type Source = "account" | "device";
type Row = { key: string; source: Source; saved: SavedPledge | null; data: FollowPledgeData | null };

const inactive = (d: FollowPledgeData) => d.status === "canceled" || d.status === "expired";

/** Pledges saved on this device (follow tokens in localStorage), matched to server rows. */
function useDeviceRows(): Row[] | undefined {
  // null on the server / before hydration so we don't flash "empty".
  const raw = useSyncExternalStore(subscribePledges, pledgesSnapshot, () => null);
  const saved = useMemo(() => (raw === null ? null : parsePledges(raw)), [raw]);
  const tokens = useMemo(() => (saved ?? []).map((p) => p.token), [saved]);
  const results = useQuery(api.public.myPledges, saved && tokens.length > 0 ? { followTokens: tokens } : "skip");

  return useMemo(() => {
    if (!saved) return undefined;
    if (tokens.length === 0) return [];
    if (results === undefined) return undefined;
    const byToken = new Map(results.map((r) => [r.followToken, r]));
    return saved.map((s) => ({
      key: `device:${s.token}`,
      source: "device" as const,
      saved: s,
      data: byToken.get(s.token) ?? null,
    }));
  }, [saved, tokens, results]);
}

export function MyDonations() {
  const { user, sessionToken } = useSession();
  const isDonor = user?.role === "donor" && !!sessionToken;
  const deviceRows = useDeviceRows();
  const account = useQuery(api.donor.myPledges, isDonor && sessionToken ? { sessionToken } : "skip");

  // Donor: account pledges first, then any device-only pledges (dedupe by pledgeId).
  const donorRows: Row[] | undefined = useMemo(() => {
    if (!isDonor || account === undefined || deviceRows === undefined) return undefined;
    const ids = new Set<string>(account.map((a) => a.pledgeId));
    const rows: Row[] = account.map((a) => ({ key: `acct:${a.pledgeId}`, source: "account", saved: null, data: a }));
    for (const r of deviceRows) {
      const id = r.data?.pledgeId ?? r.saved?.pledgeId;
      if (id && ids.has(id)) continue;
      if (id) ids.add(id);
      rows.push(r);
    }
    return rows;
  }, [isDonor, account, deviceRows]);

  if (isDonor) return <DonorHome name={user.name} rows={donorRows} />;
  return <AnonymousView rows={deviceRows} showSignInHint={user === null} />;
}

function totalsOf(rows: Row[] | undefined) {
  let committed = 0;
  let received = 0;
  let verified = 0;
  for (const r of rows ?? []) {
    if (!r.data || inactive(r.data)) continue;
    const q = pledgeStageQty(r.data);
    committed += q.pledged;
    received += q.received;
    verified += q.verified;
  }
  return { committed, received, verified };
}

/* ------------------------------------------------------------------ */
/* Signed-in donor                                                     */
/* ------------------------------------------------------------------ */

type Group = "waiting" | "custody" | "verified" | "closed";
const GROUPS: Group[] = ["waiting", "custody", "verified", "closed"];

function groupOf(d: FollowPledgeData): Group {
  if (inactive(d)) return "closed";
  const q = pledgeStageQty(d);
  if (q.verified > 0) return "verified";
  if (q.received > 0) return "custody";
  return "waiting";
}

function DonorHome({ name, rows }: { name: string; rows: Row[] | undefined }) {
  const { t, locale } = useI18n();
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const totals = totalsOf(rows);
  const live = (rows ?? []).filter((r): r is Row & { data: FollowPledgeData } => !!r.data);
  const action = live.filter((r) => r.data.status === "active" && r.data.receivedQty < r.data.qty);
  const grouped = GROUPS.map((g) => ({ g, items: live.filter((r) => groupOf(r.data) === g) })).filter((x) => x.items.length);
  const missing = (rows ?? []).filter((r) => !r.data);

  return (
    <div className="max-w-3xl pt-6 sm:pt-10">
      <Kicker>{t("donorHome.kicker")}</Kicker>
      <h1 className="mt-1 font-display text-4xl font-normal leading-[1.05] sm:text-5xl">
        {t("donorHome.greeting").replace("{name}", name)}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">{t("donorHome.lead")}</p>
      <DemoStamp className="mt-4" />

      {rows === undefined ? (
        <p className="mt-10 text-muted">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState text={t("donorHome.empty")} />
      ) : (
        <>
          <DoubleRule className="mt-8" />
          <dl className="grid grid-cols-3">
            <TotalCell label={t("donorHome.totalCommitted")} value={nf.format(totals.committed)} stage="pledged" tone="text-gold-ink" />
            <TotalCell label={t("donorHome.totalReceived")} value={nf.format(totals.received)} stage="received" tone="text-foreground" border />
            <TotalCell label={t("donorHome.totalVerified")} value={nf.format(totals.verified)} stage="verified" tone="text-emerald" border />
          </dl>

          <section aria-labelledby="donor-action" className="mt-10">
            <h2 id="donor-action" className="font-display text-2xl font-normal">
              {t("donorHome.actionTitle")}
            </h2>
            {action.length === 0 ? (
              <p className="mt-3 border-y border-border py-4 text-muted">{t("donorHome.noAction")}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {action.map((r) => (
                  <ActionItem key={r.key} data={r.data} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="donor-history" className="mt-12">
            <h2 id="donor-history" className="font-display text-2xl font-normal">
              {t("donorHome.historyTitle")}
            </h2>
            {grouped.map(({ g, items }) => (
              <div key={g} className="mt-6">
                <h3 className="flex items-center gap-2 border-b border-rule pb-1.5 text-sm font-semibold">
                  {g !== "closed" && <StageSwatch stage={g === "waiting" ? "pledged" : g === "custody" ? "received" : "verified"} />}
                  {t(`donorHome.group.${g}` as DictKey)}
                  <span className="ml-auto font-display text-base font-normal tabular-nums text-muted">{items.length}</span>
                </h3>
                <ul className="mt-4 space-y-5">
                  {items.map((r) => (
                    <PledgeItem key={r.key} row={r} showSource />
                  ))}
                </ul>
              </div>
            ))}
            {missing.length > 0 && (
              <ul className="mt-6 space-y-3">
                {missing.map((r) => (
                  <PledgeItem key={r.key} row={r} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TotalCell({
  label,
  value,
  stage,
  tone,
  border = false,
}: {
  label: string;
  value: string;
  stage: "pledged" | "received" | "verified";
  tone: string;
  border?: boolean;
}) {
  return (
    <div className={`flex flex-col-reverse justify-end py-4 ${border ? "border-l border-border pl-3 sm:pl-4" : "pr-3"}`}>
      <dt className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-muted">
        <StageSwatch stage={stage} className="mt-1" />
        {label}
      </dt>
      <dd className={`font-display text-4xl font-normal tabular-nums leading-none sm:text-5xl ${tone}`}>{value}</dd>
    </div>
  );
}

function ActionItem({ data }: { data: FollowPledgeData }) {
  const { t, pick, locale } = useI18n();
  const fmt = useDateFmt();
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const instructions = data.mode === "request_instructions";
  const remaining = data.qty - data.receivedQty;
  return (
    <li className="flex flex-col gap-3 border-l-2 border-gold bg-gold-soft/60 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MaterialGlyph itemKey={data.need.itemKey} className="size-10 shrink-0 text-gold-ink" />
        <div className="min-w-0">
          <p className="font-semibold text-gold-ink">
            {instructions ? t("donorHome.expectInstructions") : t("donorHome.expectDelivery")}
          </p>
          <p className="text-sm">
            {t("donorHome.remaining")}:{" "}
            <strong className="tabular-nums">{nf.format(remaining)}</strong> {pick(data.need.nameEs, data.need.nameEn).toLocaleLowerCase(locale)}
            {data.project && <span className="text-muted"> · {data.project.publicAlias}</span>}
          </p>
          <p className="text-xs text-muted">
            {t("donorHome.expires")} {fmt.date(data.expiresAt)}
          </p>
        </div>
      </div>
      <Link href={`/follow/${data.followToken}`} className={btn("secondary", "sm", "shrink-0 self-start sm:self-center")}>
        {t("donations.follow")}
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Anonymous (device-only follow tokens)                               */
/* ------------------------------------------------------------------ */

function AnonymousView({ rows, showSignInHint }: { rows: Row[] | undefined; showSignInHint: boolean }) {
  const { t, locale } = useI18n();
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const totals = totalsOf(rows);
  return (
    <div className="pt-6 sm:pt-10 max-w-3xl">
      <Kicker>{t("donations.receiptKicker")}</Kicker>
      <h1 className="mt-1 font-display text-[2.6rem] sm:text-6xl font-normal leading-[1.02]">{t("donations.title")}</h1>
      <p className="mt-3 text-[17px] text-muted leading-relaxed max-w-prose">{t("donations.lead")}</p>
      <DemoStamp className="mt-4" />
      {showSignInHint && <p className="mt-4 border-l-2 border-rule pl-3 text-sm text-muted">{t("donorHome.signInHint")}</p>}

      {rows === undefined ? (
        <p className="mt-10 text-muted">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState text={t("donations.empty")} />
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 border-y border-rule">
            <div className="py-5 pr-3 flex flex-col-reverse justify-end">
              <dt className="mt-1 flex items-center gap-2 text-sm text-gold-ink">
                <StageSwatch stage="pledged" size={10} />
                {t("donations.totalPledged")}
              </dt>
              <dd className="font-display text-5xl font-normal tabular-nums leading-none text-gold-ink">
                {nf.format(totals.committed)}
              </dd>
            </div>
            <div className="py-5 pl-5 border-l border-border flex flex-col-reverse justify-end">
              <dt className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald">
                <StageSwatch stage="verified" size={10} />
                {t("donations.totalVerified")}
              </dt>
              <dd className="font-display text-5xl font-normal tabular-nums leading-none text-emerald">
                {nf.format(totals.verified)}
              </dd>
            </div>
          </dl>
          <ul className="mt-2">
            {rows.map((r) => (
              <PledgeItem key={r.key} row={r} />
            ))}
          </ul>
          <p className="mt-6 border-t border-rule pt-4 text-xs text-muted">{t("donations.localOnly")}</p>
        </>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-10 border border-border">
      <FlagBand />
      <div className="p-8 sm:p-10 text-center">
        <p className="font-display text-2xl font-normal">{text}</p>
        <Link href="/donate" className={btn("primary", "lg", "mt-6")}>
          {t("donations.emptyCta")}
        </Link>
      </div>
    </div>
  );
}

function PledgeItem({ row, showSource = false }: { row: Row; showSource?: boolean }) {
  const { t, pick } = useI18n();
  const fmt = useDateFmt();
  const { saved, data } = row;
  if (!data) {
    if (!saved) return null;
    return (
      <li className="border-b border-border py-6">
        <p className="font-display text-2xl font-normal tabular-nums">
          {saved.qty} {pick(saved.nameEs, saved.nameEn)}{" "}
          <span className="font-sans text-base text-muted">({saved.alias})</span>
        </p>
        <p className="mt-1 text-sm text-muted">{t("donations.missing")}</p>
      </li>
    );
  }
  const closed = inactive(data);
  const verified = pledgeStageQty(data).verified;
  return (
    <li className={`border-b border-border py-7 ${verified > 0 ? "border-l-2 border-l-emerald pl-4 sm:pl-5" : ""}`}>
      <div className="flex items-start gap-4">
        <MaterialGlyph itemKey={data.need.itemKey} className="mt-1 size-11 shrink-0 text-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {data.project && <CategoryBadge category={data.project.category} />}
            {data.project && <StatusBadge status={data.project.status} />}
            {showSource && (
              <span className="text-xs text-muted">
                {t(row.source === "account" ? "donorHome.sourceAccount" : "donorHome.sourceDevice")}
              </span>
            )}
          </div>
          <p className="mt-2 font-display text-3xl font-normal tabular-nums leading-tight">
            {data.qty} {pick(data.need.nameEs, data.need.nameEn).toLocaleLowerCase()}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {data.project?.publicAlias ?? saved?.alias ?? ""} · {t(`donate.mode.${data.mode}` as DictKey)} ·{" "}
            {fmt.date(data.createdAt)}
          </p>
        </div>
      </div>

      {closed ? (
        <p className="mt-4 inline-flex rounded-[2px] px-3 py-1.5 font-display italic text-lg text-muted shadow-[inset_0_0_0_1px_var(--border)]">
          {t(`project.follow.status.${data.status}` as DictKey)}
        </p>
      ) : (
        <>
          <div className="mt-6">
            <PledgeProgress data={data} compact />
          </div>
          {verified > 0 ? (
            <VerifiedHeadline data={data} className="mt-5 text-2xl" />
          ) : (
            <p className="mt-5 text-sm font-semibold text-gold-ink">{t("donations.notYetVerified")}</p>
          )}
        </>
      )}

      {data.project?.status === "paused" && (
        <div className="mt-4">
          <PausedNotice reason={data.project.safetyPauseReasonPublic} compact />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 text-sm">
        <Link href={`/follow/${data.followToken}`} className={btn("quiet", "md", "min-h-11")}>
          {t("donations.follow")}
        </Link>
        {data.project && (
          <Link href={`/transparency/projects/${data.project.projectId}`} className={btn("quiet", "md", "min-h-11")}>
            {t("donate.viewProject")}
          </Link>
        )}
      </div>
    </li>
  );
}
