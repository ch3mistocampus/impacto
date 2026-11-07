"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { DoubleRule, FlagBand, Kicker } from "@/components/ui/tricolor";
import {
  AiNever,
  Button,
  CategoryTag,
  Chip,
  CountBadge,
  DemoLabel,
  Skeleton,
  TabRow,
  deskBtn,
  formatDate,
  statusTone,
  useAction,
} from "./ui";
import { LockGlyph } from "./CoordinatorGate";
import { ConfirmDialog } from "../ConfirmDialog";
import { FinancialsPanel } from "./Financials";
import { WeeklyReportsPanel } from "./WeeklyReports";
import { CommunityModeration } from "./CommunityModeration";
import type { InboxItem } from "./types";
import { MaterialIcon } from "./MaterialIcon";

type Tab = "inbox" | "published" | "pledges" | "financials" | "reports" | "community";
const TABS: Tab[] = ["inbox", "published", "pledges", "financials", "reports", "community"];

export function CoordinatorDesk() {
  const { t } = useI18n();
  const { sessionToken, user } = useSession();
  const [tab, setTab] = useState<Tab>("inbox");
  const inbox = useQuery(api.coordinator.inbox, sessionToken ? { sessionToken } : "skip");
  const feedback = useQuery(api.community.listForModeration, sessionToken ? { sessionToken } : "skip");

  const counts: Record<Tab, number | undefined> = {
    inbox: inbox?.counts.inReview,
    published: inbox ? inbox.active.length + inbox.completed.length : undefined,
    pledges: inbox?.counts.activePledges,
    financials: undefined,
    reports: undefined,
    community: feedback?.pendingCount,
  };

  return (
    <div className="pt-6 sm:pt-10">
      <header>
        <FlagBand />
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 pt-6">
          <div className="min-w-[min(100%,22rem)] flex-1">
            <Kicker>{t("coord.desk.kicker")}</Kicker>
            <h1 className="mt-1 font-display text-4xl font-normal leading-[1.05] sm:text-5xl">{t("coord.gate.title")}</h1>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            {user && (
              <p className="text-[15px] text-muted">
                {t("coord.signedInAs")} <strong className="font-semibold text-foreground">{user.name}</strong>
              </p>
            )}
            <DemoLabel />
          </div>
        </div>
        <DoubleRule className="mt-5" />
        <AiNever className="mt-4 max-w-3xl" />
      </header>

      <div className="mt-8">
        <TabRow
          tabs={TABS}
          active={tab}
          onChange={setTab}
          label={t("coord.gate.title")}
          idPrefix="coord-tab-"
          panelPrefix="coord-panel-"
          render={(k, on) => (
            <>
              {t(`coord.tab.${k}` as DictKey)}
              {counts[k] !== undefined && <CountBadge n={counts[k]} active={on} />}
            </>
          )}
        />
      </div>

      <div id={`coord-panel-${tab}`} role="tabpanel" aria-labelledby={`coord-tab-${tab}`} className="pt-6">
        {inbox === undefined ? (
          <Skeleton rows={3} />
        ) : tab === "inbox" ? (
          <ProjectList items={inbox.inReview} empty={t("coord.inbox.empty")} mode="review" />
        ) : tab === "financials" ? (
          <FinancialsPanel />
        ) : tab === "reports" ? (
          <WeeklyReportsPanel />
        ) : tab === "community" ? (
          <CommunityModeration />
        ) : tab === "published" ? (
          <ProjectList items={[...inbox.active, ...inbox.completed]} empty={t("coord.published.empty")} mode="manage" />
        ) : (
          <PledgeList />
        )}
      </div>

      <DemoControls />
    </div>
  );
}

/** Rehearsal helper: resets synthetic demo data. Server-gated by role + DEMO_MODE env var. */
function DemoControls() {
  const { t } = useI18n();
  const { sessionToken } = useSession();
  const enabled = useQuery(api.demo.isEnabled, {});
  const reset = useMutation(api.demo.resetDemoFromUI);
  const { busy, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  return (
    <section
      aria-labelledby="coord-demo-title"
      className="mt-16 border-t border-border pt-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 id="coord-demo-title" className="font-display text-lg font-normal italic text-muted">
            {t("coord.demo.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {enabled === false ? t("coord.demo.disabled") : t("coord.demo.body")}
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          aria-haspopup="dialog"
          disabled={!sessionToken || enabled !== true}
          busy={busy === "reset"}
          onClick={() => setConfirming(true)}
        >
          {t("coord.demo.reset")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t("coord.demo.confirmTitle")}
        body={t("coord.demo.confirmBody")}
        confirmLabel={t("coord.demo.confirm")}
        cancelLabel={t("common.cancel")}
        busy={busy === "reset"}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          if (!sessionToken) return;
          await run("reset", () => reset({ sessionToken }), t("coord.demo.done.toast"));
          setConfirming(false);
        }}
      />
    </section>
  );
}

function ProjectList({ items, empty, mode }: { items: InboxItem[]; empty: string; mode: "review" | "manage" }) {
  const { t, tn, pick, locale } = useI18n();
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <ol className="border-y border-rule">
      {items.map((p, i) => (
        <li key={p.projectId} className="border-b border-border last:border-b-0">
          <Link
            href={`/coordinator/${p.projectId}`}
            className="group grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-3 px-1 py-4 transition-colors hover:bg-paper sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-2"
          >
            <span aria-hidden className="self-start pt-0.5 font-display text-lg tabular-nums text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <CategoryTag category={p.category} />
                {p.status !== "in_review" && (
                  <Chip tone={statusTone(p.status)}>{t(`coord.status.${p.status}` as DictKey)}</Chip>
                )}
                {p.urgency === "high" && <Chip tone="navy">{t("coord.urgency.high")}</Chip>}
                {p.needsConfirmationCount > 0 && (
                  <Chip tone="gold">
                    <span className="tabular-nums">{p.needsConfirmationCount}</span> · {t("ledger.needsConfirmation")}
                  </Chip>
                )}
              </div>
              <p className="mt-1.5 truncate font-display text-[22px] leading-snug group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                {pick(p.titleEs, p.titleEn)}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {p.publicAlias}
                {p.region ? ` · ${p.region}` : ""} · <span className="tabular-nums">{p.needsCount}</span>{" "}
                {tn("coord.needsCount", p.needsCount)} ·{" "}
                {mode === "review"
                  ? `${t("coord.submittedAgo")} ${formatDate(p.createdAt, locale)}`
                  : p.publishedAt
                    ? `${t("coord.publishedAt")} ${formatDate(p.publishedAt, locale)}`
                    : ""}
              </p>
              {p.status === "paused" && p.safetyPauseReasonPublic && (
                <p className="mt-1 border-l border-rule pl-2 text-sm text-foreground">{p.safetyPauseReasonPublic}</p>
              )}
            </div>
            <div className="col-start-2 flex items-center gap-4 sm:col-start-3 sm:justify-end">
              {mode === "manage" && p.activePledgesCount > 0 && (
                <span className="text-sm text-gold-ink">
                  <span className="font-display text-lg tabular-nums">{p.activePledgesCount}</span>{" "}
                  {tn("coord.pledgesCount", p.activePledgesCount)}
                </span>
              )}
              <span className={deskBtn(mode === "review" ? "primary" : "secondary", "sm")}>
                {mode === "review" ? t("coord.review") : t("coord.manage")}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function PledgeList() {
  const { t, pick, locale } = useI18n();
  const { sessionToken } = useSession();
  const pledges = useQuery(api.coordinator.listPledges, sessionToken ? { sessionToken, status: "active" } : "skip");
  if (pledges === undefined) return <Skeleton rows={3} />;
  if (pledges.length === 0) return <Empty text={t("coord.pledges.empty")} />;
  return (
    <>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted">
        <LockGlyph className="size-4" />
        <span>
          {t("coord.contact")}: {t("coord.contactPrivate")}
        </span>
      </p>
      <ul className="border-y border-rule">
        {pledges.map((pl) => {
          const name = pick(pl.needNameEs, pl.needNameEn);
          return (
            <li key={pl.pledgeId} className="border-b border-border last:border-b-0">
              <Link
                href={`/coordinator/${pl.projectId}#need-${pl.needId}`}
                className="flex flex-col gap-3 px-1 py-3.5 transition-colors hover:bg-paper sm:flex-row sm:items-center sm:px-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MaterialIcon itemKey={pl.itemKey} label={name} size={40} />
                  <div className="min-w-0">
                    <p className="text-[15px]">
                      <span className="font-display text-xl tabular-nums">{pl.qty}</span> <span className="font-semibold">{name}</span>
                      <span className="text-muted"> · {pl.publicAlias}</span>
                    </p>
                    <p className="truncate text-sm text-muted">
                      {pl.donorName} · {pl.donorContact}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-[52px] text-xs sm:pl-0">
                  <Chip tone="navy">{t(`coord.mode.${pl.mode}` as DictKey)}</Chip>
                  <Chip tone="gold">
                    {t("ledger.received")} <span className="tabular-nums">{pl.receivedQty}/{pl.qty}</span>
                  </Chip>
                  <span className="text-[13px] text-muted">
                    {t("coord.expires")} {formatDate(pl.expiresAt, locale)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="border-y border-border px-4 py-12 text-center font-display text-lg italic text-muted">{text}</p>
  );
}
