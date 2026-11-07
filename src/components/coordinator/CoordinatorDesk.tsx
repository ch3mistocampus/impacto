"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { AiNever, Chip, DemoLabel, Skeleton, categoryTone, formatDate, statusTone } from "./ui";
import { FinancialsPanel } from "./Financials";
import { WeeklyReportsPanel } from "./WeeklyReports";
import type { InboxItem } from "./types";
import { MaterialIcon } from "./MaterialIcon";

type Tab = "inbox" | "published" | "pledges" | "financials" | "reports";
const TABS: Tab[] = ["inbox", "published", "pledges", "financials", "reports"];

export function CoordinatorDesk() {
  const { t } = useI18n();
  const { sessionToken, user } = useSession();
  const [tab, setTab] = useState<Tab>("inbox");
  const inbox = useQuery(api.coordinator.inbox, sessionToken ? { sessionToken } : "skip");

  const counts: Record<Tab, number | undefined> = {
    inbox: inbox?.counts.inReview,
    published: inbox ? inbox.active.length + inbox.completed.length : undefined,
    pledges: inbox?.counts.activePledges,
    financials: undefined,
    reports: undefined,
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.indexOf(tab);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      setTab(next);
      document.getElementById(`coord-tab-${next}`)?.focus();
    }
  };

  return (
    <div className="pt-6 sm:pt-10">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="font-display text-3xl font-semibold leading-none sm:text-4xl">{t("coord.gate.title")}</h1>
        {user && (
          <p className="text-sm text-muted">
            {t("coord.signedInAs")} <strong className="text-foreground">{user.name}</strong>
          </p>
        )}
        <DemoLabel className="sm:ml-auto" />
      </div>
      <AiNever className="mt-4 max-w-3xl" />

      <div role="tablist" aria-label={t("coord.gate.title")} className="-mx-1 mt-6 flex gap-1 overflow-x-auto border-b border-border px-1">
        {TABS.map((k) => {
          const active = tab === k;
          return (
            <button
              key={k}
              id={`coord-tab-${k}`}
              role="tab"
              aria-selected={active}
              aria-controls={`coord-panel-${k}`}
              tabIndex={active ? 0 : -1}
              onKeyDown={onKey}
              onClick={() => setTab(k)}
              className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4 ${
                active ? "border-clay text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t(`coord.tab.${k}` as DictKey)}
              {counts[k] !== undefined && (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums ${
                    active ? "bg-clay text-white" : "bg-border/70 text-muted"
                  }`}
                >
                  {counts[k]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id={`coord-panel-${tab}`} role="tabpanel" aria-labelledby={`coord-tab-${tab}`} className="pt-5">
        {inbox === undefined ? (
          <Skeleton rows={3} />
        ) : tab === "inbox" ? (
          <ProjectList items={inbox.inReview} empty={t("coord.inbox.empty")} mode="review" />
        ) : tab === "financials" ? (
          <FinancialsPanel />
        ) : tab === "reports" ? (
          <WeeklyReportsPanel />
        ) : tab === "published" ? (
          <ProjectList items={[...inbox.active, ...inbox.completed]} empty={t("coord.published.empty")} mode="manage" />
        ) : (
          <PledgeList />
        )}
      </div>
    </div>
  );
}

function ProjectList({ items, empty, mode }: { items: InboxItem[]; empty: string; mode: "review" | "manage" }) {
  const { t, pick, locale } = useI18n();
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {items.map((p) => (
        <li key={p.projectId}>
          <Link
            href={`/coordinator/${p.projectId}`}
            className="group flex flex-col gap-2 px-4 py-4 transition hover:bg-background sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={categoryTone(p.category)}>{t(`category.${p.category}` as DictKey)}</Chip>
                {p.status !== "in_review" && (
                  <Chip tone={statusTone(p.status)}>{t(`coord.status.${p.status}` as DictKey)}</Chip>
                )}
                {p.urgency === "high" && <Chip tone="brick">{t("coord.urgency.high")}</Chip>}
                {p.needsConfirmationCount > 0 && (
                  <Chip tone="amber">
                    {p.needsConfirmationCount} · {t("ledger.needsConfirmation")}
                  </Chip>
                )}
              </div>
              <p className="mt-1.5 truncate font-display text-lg font-semibold">{pick(p.titleEs, p.titleEn)}</p>
              <p className="text-sm text-muted">
                {p.publicAlias}
                {p.region ? ` · ${p.region}` : ""} · {p.needsCount} {t("coord.needsCount")} ·{" "}
                {mode === "review"
                  ? `${t("coord.submittedAgo")} ${formatDate(p.createdAt, locale)}`
                  : p.publishedAt
                    ? `${t("coord.publishedAt")} ${formatDate(p.publishedAt, locale)}`
                    : ""}
              </p>
              {p.status === "paused" && p.safetyPauseReasonPublic && (
                <p className="mt-1 text-sm text-sky">{p.safetyPauseReasonPublic}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {mode === "manage" && p.activePledgesCount > 0 && (
                <span className="text-sm text-muted">
                  <strong className="tabular-nums text-foreground">{p.activePledgesCount}</strong>{" "}
                  {t("coord.tab.pledges").toLowerCase()}
                </span>
              )}
              <span className="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-white group-hover:brightness-110">
                {mode === "review" ? t("coord.review") : t("coord.manage")}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
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
      <p className="mb-3 text-sm text-muted">
        {t("coord.contact")}: {t("coord.contactPrivate")}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {pledges.map((pl) => {
          const name = pick(pl.needNameEs, pl.needNameEn);
          return (
            <li key={pl.pledgeId}>
              <Link
                href={`/coordinator/${pl.projectId}#need-${pl.needId}`}
                className="flex flex-col gap-3 px-4 py-3 transition hover:bg-background sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MaterialIcon itemKey={pl.itemKey} label={name} size={36} />
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="tabular-nums">{pl.qty}</span> {name}
                      <span className="text-muted"> · {pl.publicAlias}</span>
                    </p>
                    <p className="truncate text-sm text-muted">
                      {pl.donorName} · {pl.donorContact}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Chip tone="sky">{t(`coord.mode.${pl.mode}` as DictKey)}</Chip>
                  <Chip tone="amber">
                    {t("ledger.received")} {pl.receivedQty}/{pl.qty}
                  </Chip>
                  <span className="text-muted">
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
  return <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">{text}</p>;
}
