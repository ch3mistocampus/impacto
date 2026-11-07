"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { CategoryMark, FlagBand, Kicker, btn } from "@/components/ui/tricolor";
import { EvidenceList } from "./EvidenceList";
import { FinancialsTable } from "./Financials";
import { LedgerBar, StageLegend } from "./LedgerBar";
import { MaterialImage } from "./MaterialImage";
import { DemoStamp, PausedNotice } from "./PublicMeta";
import { ProjectStatusChip, ReportHeading, useReportFmt } from "./reportKit";
import { StageStrip } from "./ProjectCard";
import { Timeline, toTimelineItems } from "./Timeline";
import { VerifiedBadge } from "./VerifiedBadge";
import { CATEGORY_STYLE } from "./types";

export function ProjectDetail({ backHref = "/#proyectos" }: { backHref?: string }) {
  const params = useParams<{ projectId?: string; id?: string }>();
  const projectId = params.projectId ?? params.id ?? "";
  const { t, pick } = useI18n();
  const fmt = useReportFmt();
  const data = useQuery(api.public.getProject, { projectId });

  if (data === undefined) return <p className="py-16 text-muted">{t("common.loading")}</p>;
  if (data === null) {
    return (
      <div className="py-16">
        <p className="font-display text-3xl font-normal">{t("project.notFound")}</p>
        <Link href="/" className={btn("quiet", "md", "mt-4")}>
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
      <Link href={backHref} className={btn("quiet", "md", "text-sm text-muted min-h-11")}>
        {t("common.back")}
      </Link>

      {/* Report masthead */}
      <header className="mt-3 border border-border bg-surface">
        <FlagBand thickness={6} />
        <div className="grid gap-8 px-5 pt-8 pb-7 sm:px-10 sm:pt-10 md:grid-cols-[1fr_11rem] md:items-start">
          <div className="min-w-0">
            <Kicker className="flex items-center gap-2">
              <CategoryMark category={p.category} size={12} className="not-italic text-foreground" />
              {t(`category.${p.category}`)}
            </Kicker>
            <h1 className="mt-2 font-display text-[2.6rem] font-normal leading-[1.02] sm:text-6xl">{p.publicAlias}</h1>
            <p className="mt-3 font-display text-xl italic leading-snug text-muted sm:text-2xl">
              {pick(p.titleEs, p.titleEn)}
            </p>
          </div>
          <div className="hidden md:block aspect-square border border-border bg-surface text-foreground">
            <MaterialImage
              src={p.coverPhotoUrl ?? s.image}
              alt=""
              fallbackSrc={s.image}
              className="size-full"
              sizes="176px"
            />
          </div>
        </div>
        <dl className="grid border-t border-border text-sm sm:grid-cols-3">
          <div className="flex items-center justify-between gap-3 px-5 py-3 sm:block sm:px-10 sm:py-4">
            <dt className="text-[13px] text-muted">{t("report.status")}</dt>
            <dd className="sm:mt-1.5">
              <ProjectStatusChip status={p.status} />
            </dd>
          </div>
          {p.region && (
            <div className="flex items-baseline justify-between gap-3 border-t border-border px-5 py-3 sm:block sm:border-t-0 sm:border-l sm:px-6 sm:py-4">
              <dt className="text-[13px] text-muted">{t("project.region")}</dt>
              <dd className="font-display text-lg sm:mt-1">{p.region}</dd>
            </div>
          )}
          {approvedAt && (
            <div className="flex items-baseline justify-between gap-3 border-t border-border px-5 py-3 sm:block sm:border-t-0 sm:border-l sm:px-6 sm:py-4">
              <dt className="text-[13px] text-muted">{t("report.approved")}</dt>
              <dd className="font-display text-lg sm:mt-1 text-right sm:text-left">{fmt.date(approvedAt)}</dd>
            </div>
          )}
        </dl>
        <div className="border-t border-border px-5 py-3 sm:px-10">
          <DemoStamp asOf={asOf} />
        </div>
      </header>

      {p.status === "paused" && (
        <div className="mt-6">
          <PausedNotice reason={p.safetyPauseReasonPublic} />
        </div>
      )}

      <div className="mt-8 max-w-[40rem]">
        <p className="text-lg leading-relaxed">{pick(p.summaryEs, p.summaryEn)}</p>
        <p className="mt-3 text-[15px] text-muted">{t("project.privacyNote")}</p>
        {canPledge && (
          <Link href={`/donate?category=${p.category}`} className={btn("primary", "lg", "mt-6")}>
            {t("project.pledgeCta")}
          </Link>
        )}
      </div>

      {/* How things changed — verified outcome milestones only */}
      <section className="mt-14 border border-border bg-surface" aria-labelledby="changed-title">
        <div className="grid gap-6 px-5 py-7 sm:grid-cols-[1fr_auto] sm:px-10 sm:py-9">
          <div className="min-w-0">
            <h2 id="changed-title" className="font-display text-[1.75rem] font-normal leading-tight text-emerald sm:text-[2.1rem]">
              {t("project.howChanged")}
            </h2>
            <p className="mt-1.5 text-[15px] text-muted">{t("project.howChangedLead")}</p>
            {outcomes.length === 0 ? (
              <p className="mt-5 text-[15px]">{t("project.howChangedEmpty")}</p>
            ) : (
              <ul className="mt-5 divide-y divide-border border-y border-border">
                {outcomes.map((m) => (
                  <li key={m.milestoneId} className="grid grid-cols-[auto_1fr] items-start gap-3 py-3.5">
                    <VerifiedBadge compact label={t("project.verifiedByOrg")} className="mt-0.5" />
                    <div>
                      <p className="text-[15px] leading-relaxed sm:text-base">{pick(m.descriptionEs, m.descriptionEn)}</p>
                      <p className="mt-0.5 text-[13px] text-muted">{fmt.date(m.occurredAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {outcomes.length > 0 && (
            <VerifiedBadge variant="seal" label={t("report.sealVerified")} className="hidden sm:inline-grid" />
          )}
        </div>
        {(before.length > 0 || after.length > 0) && (
          <div className="border-t border-border px-5 py-7 sm:px-10">
            <h3 className="font-display text-xl font-normal">{t("project.beforeAfter")}</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
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
                      className="aspect-[4/3] w-full border border-border object-cover"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full border border-dashed border-border" />
                  )}
                  <figcaption className="mt-1.5 font-display text-[15px] italic">{col.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="mt-16 grid gap-x-14 gap-y-16 lg:grid-cols-[1.15fr_1fr]">
        <section aria-labelledby="materials-title" className="min-w-0">
          <ReportHeading id="materials-title" title={t("project.materials")} lead={t("project.materialsLead")} />
          <div className="mt-5 border-y border-rule py-4">
            <StageStrip totals={p.totals} />
          </div>
          <ul className="mt-2">
            {needs.map((n) => (
              <li key={n.needId} className="border-b border-border py-6">
                <div className="mb-4 flex items-center gap-4">
                  <div className="grid size-14 shrink-0 place-items-center border border-border bg-surface text-foreground">
                    <MaterialImage itemKey={n.itemKey} alt="" className="size-11" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[1.4rem] font-normal leading-tight">{pick(n.nameEs, n.nameEn)}</h3>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {t("report.unit")}: {n.unit}
                    </p>
                  </div>
                  {n.verified && <VerifiedBadge compact />}
                </div>
                <LedgerBar ledger={n.ledger} unit={n.unit} showAvailable={p.status === "published"} />
              </li>
            ))}
          </ul>
          <details className="mt-4 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold underline decoration-dotted decoration-1 underline-offset-[5px]">
              {t("stage.legendTitle")}
            </summary>
            <StageLegend className="mt-2" />
          </details>
        </section>

        <section aria-labelledby="timeline-title" className="min-w-0">
          <ReportHeading id="timeline-title" title={t("project.timeline")} />
          <div className="mt-6">
            <Timeline items={toTimelineItems(timeline)} />
          </div>
        </section>
      </div>

      {financials.length > 0 && (
        <section className="mt-16" aria-labelledby="fin-title">
          <ReportHeading id="fin-title" title={t("project.financials")} lead={t("project.financialsLead")} />
          <FinancialsTable rows={financials} className="mt-5 max-w-2xl" />
        </section>
      )}

      <section className="mt-16" aria-labelledby="evidence-title">
        <ReportHeading id="evidence-title" title={t("project.evidence")} lead={t("project.evidenceLead")} />
        <div className="mt-5">
          <EvidenceList items={otherEvidence} />
        </div>
      </section>

      <section className="mt-16" aria-labelledby="photos-title">
        <ReportHeading id="photos-title" title={t("project.photos")} />
        {photos.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">{t("project.noPhotos")}</p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.map((ph) => {
              const cap = pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined);
              return (
                <li key={ph.photoId}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ph.url}
                      alt={cap || p.publicAlias}
                      className="aspect-[4/3] w-full border border-border object-cover"
                    />
                    {cap && <figcaption className="mt-1.5 text-[13px] text-muted">{cap}</figcaption>}
                  </figure>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-14 border-t border-border pt-6">
        <Link href="/transparency" className={btn("secondary", "md")}>
          {t("project.transparencyLink")}
        </Link>
      </p>
    </div>
  );
}
