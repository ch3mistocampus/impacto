"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { CategoryBadge } from "./CategoryBadge";
import { EvidenceList } from "./EvidenceList";
import { FinancialsTable } from "./Financials";
import { LedgerBar, StageLegend } from "./LedgerBar";
import { MaterialImage } from "./MaterialImage";
import { DemoStamp, PausedNotice, StatusBadge, useDateFmt } from "./PublicMeta";
import { StageStrip } from "./ProjectCard";
import { Timeline, toTimelineItems } from "./Timeline";
import { VerifiedBadge } from "./VerifiedBadge";
import { CATEGORY_STYLE } from "./types";

export function ProjectDetail({ backHref = "/#proyectos" }: { backHref?: string }) {
  const params = useParams<{ projectId?: string; id?: string }>();
  const projectId = params.projectId ?? params.id ?? "";
  const { t, pick } = useI18n();
  const fmt = useDateFmt();
  const data = useQuery(api.public.getProject, { projectId });

  if (data === undefined) return <p className="py-16 text-muted">{t("common.loading")}</p>;
  if (data === null) {
    return (
      <div className="py-16">
        <p className="font-display text-2xl font-semibold">{t("project.notFound")}</p>
        <Link href="/" className="mt-4 inline-block font-semibold underline underline-offset-4">
          {t("project.backHome")}
        </Link>
      </div>
    );
  }

  const { project: p, needs, timeline, photos, evidence, financials, approvedAt, asOf } = data;
  const s = CATEGORY_STYLE[p.category];
  const canPledge = p.status === "published" && needs.some((n) => n.ledger.availableToPledge > 0);
  const outcomes = timeline.filter((m) => m.type === "outcome");
  const before = evidence.filter((e) => e.type === "before_photo" && e.url);
  const after = evidence.filter((e) => e.type === "after_photo" && e.url);
  const otherEvidence = evidence.filter((e) => e.type !== "before_photo" && e.type !== "after_photo");

  return (
    <div className="pt-6 sm:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-muted underline underline-offset-4">
          {t("common.back")}
        </Link>
        <DemoStamp asOf={asOf} />
      </div>

      <header className="mt-4 grid gap-6 md:grid-cols-[1fr_18rem] md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={p.category} />
            <StatusBadge status={p.status} />
          </div>
          <h1 className={`mt-3 font-display text-4xl sm:text-5xl font-semibold leading-[1.05] ${s.text}`}>
            {p.publicAlias}
          </h1>
          <p className="mt-2 font-display text-xl sm:text-2xl">{pick(p.titleEs, p.titleEn)}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            {p.region && (
              <p>
                {t("project.region")}: <span className="text-foreground font-semibold">{p.region}</span>
              </p>
            )}
            {approvedAt && (
              <p>
                {t("project.approvedOn")}{" "}
                <span className="text-foreground font-semibold">{fmt.date(approvedAt)}</span>
              </p>
            )}
          </div>
        </div>
        <div className={`hidden md:block aspect-square rounded-3xl overflow-hidden ${s.soft}`}>
          <MaterialImage
            src={p.coverPhotoUrl ?? s.image}
            alt=""
            emoji={s.emoji}
            className={`size-full ${p.coverPhotoUrl ? "object-cover" : ""}`}
          />
        </div>
      </header>

      {p.status === "paused" && (
        <div className="mt-6">
          <PausedNotice reason={p.safetyPauseReasonPublic} />
        </div>
      )}

      <p className="mt-6 text-lg leading-relaxed max-w-[38rem]">{pick(p.summaryEs, p.summaryEn)}</p>
      <p className="mt-3 text-sm text-muted max-w-[38rem]">{t("project.privacyNote")}</p>

      {canPledge && (
        <Link
          href={`/donate?category=${p.category}`}
          className="mt-6 inline-flex rounded-full bg-clay text-white px-6 py-3.5 font-semibold shadow-[0_2px_0_var(--brick)]"
        >
          {t("project.pledgeCta")}
        </Link>
      )}

      {/* How things changed — verified outcome milestones only */}
      <section className="mt-12 rounded-3xl bg-leaf-soft/60 border border-leaf/25 p-5 sm:p-7" aria-labelledby="changed-title">
        <h2 id="changed-title" className="font-display text-2xl sm:text-3xl font-semibold text-leaf">
          {t("project.howChanged")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("project.howChangedLead")}</p>
        {outcomes.length === 0 ? (
          <p className="mt-4 text-sm">{t("project.howChangedEmpty")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {outcomes.map((m) => (
              <li key={m.milestoneId} className="grid grid-cols-[auto_1fr] gap-3 items-start">
                <VerifiedBadge compact label={t("project.verifiedByOrg")} className="mt-0.5" />
                <div>
                  <p className="leading-relaxed">{pick(m.descriptionEs, m.descriptionEn)}</p>
                  <p className="text-xs text-muted">{fmt.date(m.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(before.length > 0 || after.length > 0) && (
          <div className="mt-6">
            <h3 className="font-semibold">{t("project.beforeAfter")}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                { label: t("evidence.before_photo"), list: before },
                { label: t("evidence.after_photo"), list: after },
              ].map((col) => (
                <figure key={col.label}>
                  {col.list[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={col.list[0].url}
                      alt={`${col.label}: ${p.publicAlias}`}
                      className="aspect-[4/3] w-full rounded-xl object-cover border border-border"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full rounded-xl border-2 border-dashed border-border" />
                  )}
                  <figcaption className="mt-1 text-xs font-semibold">{col.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
        <section aria-labelledby="materials-title">
          <h2 id="materials-title" className="font-display text-2xl sm:text-3xl font-semibold">
            {t("project.materials")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("project.materialsLead")}</p>
          <StageStrip totals={p.totals} className="mt-4 rounded-xl border border-border bg-surface p-3" />
          <ul className="mt-4 space-y-4">
            {needs.map((n) => (
              <li key={n.needId} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`size-14 shrink-0 rounded-xl ${s.soft} grid place-items-center`}>
                    <MaterialImage itemKey={n.itemKey} alt="" className="size-12" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl font-semibold leading-tight">{pick(n.nameEs, n.nameEn)}</h3>
                    <p className="text-xs text-muted">{n.unit}</p>
                  </div>
                  {n.verified && <VerifiedBadge compact />}
                </div>
                <LedgerBar ledger={n.ledger} unit={n.unit} showAvailable={p.status === "published"} />
              </li>
            ))}
          </ul>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold underline underline-offset-4 decoration-dotted">
              {t("stage.legendTitle")}
            </summary>
            <StageLegend className="mt-3" />
          </details>
        </section>

        <section aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="font-display text-2xl sm:text-3xl font-semibold">
            {t("project.timeline")}
          </h2>
          <div className="mt-5">
            <Timeline items={toTimelineItems(timeline)} />
          </div>
        </section>
      </div>

      {financials.length > 0 && (
        <section className="mt-12" aria-labelledby="fin-title">
          <h2 id="fin-title" className="font-display text-2xl sm:text-3xl font-semibold">
            {t("project.financials")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("project.financialsLead")}</p>
          <FinancialsTable rows={financials} className="mt-4 max-w-xl" />
        </section>
      )}

      <section className="mt-12" aria-labelledby="evidence-title">
        <h2 id="evidence-title" className="font-display text-2xl sm:text-3xl font-semibold">
          {t("project.evidence")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("project.evidenceLead")}</p>
        <div className="mt-4">
          <EvidenceList items={otherEvidence} />
        </div>
      </section>

      <section className="mt-12" aria-labelledby="photos-title">
        <h2 id="photos-title" className="font-display text-2xl sm:text-3xl font-semibold">
          {t("project.photos")}
        </h2>
        {photos.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("project.noPhotos")}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((ph) => {
              const cap = pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined);
              return (
                <li key={ph.photoId}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ph.url}
                      alt={cap || p.publicAlias}
                      className="aspect-[4/3] w-full rounded-xl object-cover border border-border"
                    />
                    {cap && <figcaption className="mt-1 text-xs text-muted">{cap}</figcaption>}
                  </figure>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-12">
        <Link href="/transparency" className="font-semibold underline underline-offset-4 decoration-2">
          {t("project.transparencyLink")}
        </Link>
      </p>
    </div>
  );
}
