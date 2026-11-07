"use client";

import { displayAlias } from "@/lib/alias";
import Link from "next/link";
import { Component, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { DoubleRule, FlagBand } from "@/components/ui/tricolor";
import {
  AiNever,
  Button,
  CategoryTag,
  Chip,
  DemoLabel,
  Label,
  Skeleton,
  TabRow,
  VerifiedBy,
  deskBtn,
  formatDate,
  inputCls,
  statusTone,
  useAction,
} from "./ui";
import { EvidencePanel, PhotoReview } from "./Evidence";
import { PrivatePanel } from "./PrivatePanel";
import { ReviewForm } from "./ReviewForm";
import { LedgerPanel } from "./Ledger";
import { MilestonePanel, ProposedMilestones } from "./Milestones";
import { EvidenceReviewPanel } from "./EvidenceReview";
import { FollowUpReviewPanel } from "./FollowUpReview";
import { FinancialsPanel } from "./Financials";
import { containsPrivate, type ReviewData } from "./types";

export function ReviewScreen({ projectId }: { projectId: string }) {
  return (
    <LoadBoundary>
      <ReviewLoader projectId={projectId} />
    </LoadBoundary>
  );
}

/** The layout's <main> is max-w-6xl; the review uses its full width. */
function Wide({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>;
}

function ReviewLoader({ projectId }: { projectId: string }) {
  const { sessionToken } = useSession();
  const data = useQuery(
    api.coordinator.getProjectForReview,
    sessionToken ? { sessionToken, projectId: projectId as Id<"projects"> } : "skip",
  );
  if (data === undefined) {
    return (
      <div className="pt-8">
        <Skeleton rows={4} />
      </div>
    );
  }
  return <ReviewBody data={data} />;
}

function ReviewBody({ data }: { data: ReviewData }) {
  const { t, pick, locale } = useI18n();
  const p = data.project;
  const reviewing = p.status === "in_review" || p.status === "draft";

  return (
    <Wide>
      <div className="pt-5 sm:pt-8">
        <Link href="/coordinator" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
          ← {t("coord.backToDesk")}
        </Link>
        <FlagBand className="mt-4" />
        <header className="flex flex-wrap items-end gap-x-6 gap-y-4 pt-5">
          <div className="min-w-[min(100%,20rem)] flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <CategoryTag category={p.category} />
              <Chip tone={statusTone(p.status)}>{t(`coord.status.${p.status}` as DictKey)}</Chip>
              <Chip tone={p.urgency === "high" ? "navy" : "neutral"}>{t(`coord.urgency.${p.urgency}` as DictKey)}</Chip>
              {p.region && <span className="text-[13px] text-muted">{p.region}</span>}
              {p.isDemo && <DemoLabel />}
            </div>
            <h1 className="mt-3 font-display text-4xl font-normal leading-[1.08] sm:text-5xl">
              {reviewing ? pick(p.titleEs, p.titleEn) : displayAlias(p.publicAlias, locale)}
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              {reviewing ? displayAlias(p.publicAlias, locale) : pick(p.titleEs, p.titleEn)}
              {p.createdByName && ` · ${t("role.field_worker")}: ${p.createdByName}`} · {formatDate(p.createdAt, locale)}
            </p>
            {p.publishedAt && (
              <div className="mt-2">
                <VerifiedBy text={`${t("coord.publishedAt")} · ${t("badge.verified")}`} at={p.publishedAt} />
              </div>
            )}
          </div>
          {!reviewing && (
            <Link href={`/p/${p.projectId}`} target="_blank" className={deskBtn("secondary", "sm")}>
              {t("coord.viewPublic")} ↗
            </Link>
          )}
        </header>
        <DoubleRule className="mt-5" />

        {reviewing ? <ReviewLayout data={data} /> : <ManageLayout data={data} />}
      </div>
    </Wide>
  );
}

function ReviewLayout({ data }: { data: ReviewData }) {
  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0 space-y-5">
        <AiNever />
        <div data-tour="coord-evidence">
          <EvidencePanel reports={data.fieldReports} photos={data.photos} />
        </div>
        <ProposedMilestones reports={data.fieldReports} />
      </div>
      <div className="min-w-0 space-y-5">
        <div data-tour="coord-private">
          <PrivatePanel priv={data.private} />
        </div>
        <div data-tour="coord-publish">
          <ReviewForm data={data} />
        </div>
      </div>
    </div>
  );
}

type ManageTab = "materials" | "evidence" | "financials" | "timeline" | "field";
const MANAGE_TABS: ManageTab[] = ["materials", "evidence", "financials", "timeline", "field"];

function ManageLayout({ data }: { data: ReviewData }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ManageTab>("materials");
  return (
    <div className="mt-6 space-y-5">
      <StatusControls data={data} />
      <TabRow
        tabs={MANAGE_TABS}
        active={tab}
        onChange={setTab}
        label={t("coord.manage")}
        idPrefix="mtab-"
        panelPrefix="mpanel-"
        render={(k) => t(`coord.mtab.${k}` as DictKey)}
      />
      <div id={`mpanel-${tab}`} role="tabpanel" aria-labelledby={`mtab-${tab}`}>
        {tab === "materials" && <LedgerPanel data={data} />}
        {tab === "evidence" && (
          <div className="space-y-5">
            <EvidenceReviewPanel data={data} />
            <PhotoReview photos={data.photos} />
          </div>
        )}
        {tab === "financials" && <FinancialsPanel projectId={data.project.projectId} />}
        {tab === "timeline" && <MilestonePanel data={data} />}
        {tab === "field" && <FollowUpReviewPanel projectId={data.project.projectId} />}
        {tab === "field" && (
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <AiNever />
              <EvidencePanel reports={data.fieldReports} photos={[]} />
            </div>
            <PrivatePanel priv={data.private} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusControls({ data }: { data: ReviewData }) {
  const { t, pick } = useI18n();
  const { sessionToken, user } = useSession();
  const p = data.project;
  const pause = useMutation(api.coordinator.pause);
  const resume = useMutation(api.coordinator.resume);
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  const name = data.private?.beneficiaryName;
  const leak = containsPrivate(es, name) || containsPrivate(en, name);
  const signed = user ? `${t("coord.verifiedBy")} ${user.name}` : undefined;

  if (p.status === "paused") {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-[2px] border border-rule bg-navy-soft px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl">{t("coord.status.paused")}</p>
          {p.safetyPauseReasonPublic && <p className="mt-1 text-[15px]">{pick(p.safetyPauseReasonPublic ?? undefined, p.safetyPauseReasonPublicEn ?? undefined)}</p>}
          <p className="mt-1 text-[13px] text-muted">{t("coord.paused.calm")}</p>
        </div>
        <Button
          variant="primary"
          busy={busy === "resume"}
          onClick={() =>
            sessionToken && run("resume", () => resume({ sessionToken, projectId: p.projectId }), t("coord.resumed.toast"), signed)
          }
        >
          {t("coord.resume")}
        </Button>
      </div>
    );
  }
  if (p.status !== "published") return null;

  return (
    <div className="rounded-[2px] border border-border bg-surface px-4 py-3 sm:px-5">
      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-[14rem] flex-1 text-sm text-muted">{t("coord.pause.hint")}</p>
          <Button variant="ghost" onClick={() => setOpen(true)}>
            {t("coord.pause")}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sessionToken || !es.trim() || leak) return;
            const ok = await run(
              "pause",
              () =>
                pause({
                  sessionToken,
                  projectId: p.projectId,
                  reasonPublicEs: es.trim(),
                  reasonPublicEn: en.trim() || undefined,
                }),
              t("coord.paused.toast"),
              signed,
            );
            if (ok) setOpen(false);
          }}
        >
          <p className="font-display text-xl">{t("coord.pause.reason")}</p>
          <p className="text-[13px] text-muted">{t("coord.pause.reasonNote")}</p>
          <p className="text-[13px] text-muted">{t("coord.paused.calm")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pause-es">{t("coord.noteEs")}</Label>
              <input
                id="pause-es"
                lang="es"
                autoFocus
                value={es}
                onChange={(e) => setEs(e.target.value)}
                placeholder={t("coord.pause.reasonPlaceholder")}
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="pause-en">{t("coord.noteEn")}</Label>
              <input id="pause-en" lang="en" value={en} onChange={(e) => setEn(e.target.value)} className={inputCls} />
            </div>
          </div>
          {leak && (
            <p role="alert" className="rounded-[2px] border-l-2 border-red bg-red-soft px-2.5 py-1.5 text-[13px] font-semibold text-red">
              {t("coord.textWarnName")}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" busy={busy === "pause"} disabled={!es.trim() || leak}>
              {t("coord.pause")}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

class LoadBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <NotFound />;
    return this.props.children;
  }
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="pt-10">
      <Link href="/coordinator" className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
        ← {t("coord.backToDesk")}
      </Link>
      <p className="mt-6 border-y border-border px-4 py-12 text-center font-display text-lg italic text-muted">
        {t("coord.notFound")}
      </p>
    </div>
  );
}
