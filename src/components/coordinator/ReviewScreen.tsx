"use client";

import Link from "next/link";
import { Component, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, Label, Skeleton, VerifiedBy, categoryTone, formatDate, inputCls, useAction } from "./ui";
import { EvidencePanel, PhotoReview } from "./Evidence";
import { PrivatePanel } from "./PrivatePanel";
import { ReviewForm } from "./ReviewForm";
import { LedgerPanel } from "./Ledger";
import { MilestonePanel } from "./Milestones";
import { containsPrivate, type ReviewData } from "./types";

export function ReviewScreen({ projectId }: { projectId: string }) {
  return (
    <LoadBoundary>
      <ReviewLoader projectId={projectId} />
    </LoadBoundary>
  );
}

/** Wider than the app's default max-w-5xl so the two-column review breathes on desktop. */
function Wide({ children }: { children: ReactNode }) {
  return <div className="relative left-1/2 w-[min(calc(100vw-2.5rem),78rem)] -translate-x-1/2">{children}</div>;
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
        <Link href="/coordinator" className="text-sm text-muted hover:text-foreground">
          ← {t("coord.backToDesk")}
        </Link>
        <header className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={categoryTone(p.category)}>{t(`category.${p.category}` as DictKey)}</Chip>
              <Chip tone={p.status === "published" ? "leaf" : p.status === "paused" ? "amber" : "neutral"}>
                {t(`coord.status.${p.status}` as DictKey)}
              </Chip>
              <Chip tone={p.urgency === "high" ? "brick" : "neutral"}>{t(`coord.urgency.${p.urgency}` as DictKey)}</Chip>
              {p.region && <span className="text-xs text-muted">{p.region}</span>}
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
              {reviewing ? pick(p.titleEs, p.titleEn) : p.publicAlias}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {reviewing ? p.publicAlias : pick(p.titleEs, p.titleEn)}
              {p.createdByName && ` · ${t("role.field_worker")}: ${p.createdByName}`} · {formatDate(p.createdAt, locale)}
            </p>
            {p.publishedAt && (
              <div className="mt-1.5">
                <VerifiedBy text={`${t("coord.publishedAt")} · ${t("badge.verified")}`} at={p.publishedAt} />
              </div>
            )}
          </div>
          {!reviewing && (
            <Link
              href={`/p/${p.projectId}`}
              target="_blank"
              className="rounded-md px-3 py-2 text-sm font-medium text-sky ring-1 ring-sky/40 hover:bg-sky-soft"
            >
              {t("coord.viewPublic")} ↗
            </Link>
          )}
        </header>

        {reviewing ? <ReviewLayout data={data} /> : <ManageLayout data={data} />}
      </div>
    </Wide>
  );
}

function ReviewLayout({ data }: { data: ReviewData }) {
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="space-y-5">
        <EvidencePanel reports={data.fieldReports} photos={data.photos} />
      </div>
      <div className="space-y-5">
        <PrivatePanel priv={data.private} />
        <ReviewForm data={data} />
      </div>
    </div>
  );
}

function ManageLayout({ data }: { data: ReviewData }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 space-y-5">
      <StatusControls data={data} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <LedgerPanel data={data} />
        <MilestonePanel data={data} />
      </div>
      <details className="group rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 font-display text-lg font-semibold">
          <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
          {t("coord.evidence")} · {t("coord.photos")} · {t("coord.private")}
        </summary>
        <div className="grid gap-5 border-t border-border p-4 lg:grid-cols-2">
          <div className="space-y-5">
            <EvidencePanel reports={data.fieldReports} photos={[]} />
          </div>
          <div className="space-y-5">
            <PrivatePanel priv={data.private} />
            <PhotoReview photos={data.photos} />
          </div>
        </div>
      </details>
    </div>
  );
}

function StatusControls({ data }: { data: ReviewData }) {
  const { t } = useI18n();
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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber/50 bg-amber-soft px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber">{t("coord.status.paused")}</p>
          {p.safetyPauseReasonPublic && <p className="text-sm">{p.safetyPauseReasonPublic}</p>}
        </div>
        <Button
          variant="leaf"
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
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted">{t("coord.pause.hint")}</p>
          <Button variant="danger" onClick={() => setOpen(true)}>
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
          <p className="text-sm font-semibold">{t("coord.pause.reason")}</p>
          <p className="text-xs text-muted">{t("coord.pause.reasonNote")}</p>
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
            <p role="alert" className="rounded-md bg-brick-soft px-2.5 py-1.5 text-xs font-medium text-brick">
              {t("coord.textWarnName")}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" busy={busy === "pause"} disabled={!es.trim() || leak}>
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
      <Link href="/coordinator" className="text-sm text-muted hover:text-foreground">
        ← {t("coord.backToDesk")}
      </Link>
      <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
        {t("coord.notFound")}
      </p>
    </div>
  );
}
