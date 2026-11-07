"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useI18n } from "@/lib/i18n";
import { CategoryMark, DoubleRule, FlagBand, Kicker, btn } from "@/components/ui/tricolor";
import { FinancialsTable } from "./Financials";
import { LedgerBar, StageLegend } from "./LedgerBar";
import { ProjectCard } from "./ProjectCard";
import { DemoStamp } from "./PublicMeta";
import { ReportHeading, useReportFmt } from "./reportKit";
import { STAGE_TEXT } from "./ledgerStyles";
import { VerifiedBadge } from "./VerifiedBadge";
import { api } from "../../../convex/_generated/api";
import type { WeeklyReport } from "./publicApi";

const COUNTERS = [
  "weeklyReportsPublished",
  "receiptsRecorded",
  "handoversSigned",
  "milestonesVerified",
  "outstandingUnverified",
] as const;

export function TransparencyDashboard() {
  const { t, tn, pick } = useI18n();
  const fmt = useReportFmt();
  const dash = useQuery(api.public.transparencyDashboard, {});
  const reports = useQuery(api.public.listWeeklyReports, {});

  return (
    <div className="pt-6 sm:pt-10">
      {/* Report masthead */}
      <header className="relative border border-border bg-surface">
        <FlagBand thickness={6} />
        <div className="px-5 pt-9 pb-7 text-center sm:px-12 sm:pt-12">
          <Kicker>{t("report.kicker")}</Kicker>
          <h1 className="mx-auto mt-2 max-w-[16ch] font-display text-[2.6rem] font-normal leading-[1.02] sm:text-6xl">
            {t("tr.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-[46ch] text-[17px] leading-relaxed text-muted">{t("tr.lead")}</p>
          <p className="mt-3 text-[13px] text-muted">{t("report.issuedBy")}</p>
          <div className="mt-5 flex justify-center">
            <DemoStamp asOf={dash?.asOf ?? null} explain className="justify-center text-center" />
          </div>
        </div>

        {/* Accountability counters: a certificate-style ruled band of figures */}
        <section aria-labelledby="counters-title" className="px-5 pb-8 sm:px-12">
          <h2 id="counters-title" className="text-center font-display text-xl font-normal italic text-muted">
            {t("tr.countersTitle")}
          </h2>
          <DoubleRule className="mt-3" />
          <dl className="grid grid-cols-2 text-center sm:grid-cols-5">
            {COUNTERS.map((k, i) => {
              const v = dash?.transparency[k];
              const outstanding = k === "outstandingUnverified";
              return (
                <div
                  key={k}
                  className={`flex flex-col-reverse justify-end border-border px-2 py-5 sm:px-3 ${
                    i % 2 === 1 ? "border-l" : ""
                  } ${i > 0 ? "sm:border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${
                    outstanding ? "col-span-2 sm:col-span-1" : ""
                  }`}
                >
                  <dt className={`mt-2 text-[13px] leading-snug ${outstanding ? "text-gold-ink" : "text-muted"}`}>
                    {tn(`tr.counter.${k}`, v ?? 0)}
                  </dt>
                  <dd
                    className={`font-display text-[2.6rem] font-normal leading-none tabular-nums sm:text-[2.9rem] ${
                      outstanding ? "text-gold-ink" : ""
                    }`}
                  >
                    {v == null ? "–" : fmt.num(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
          <DoubleRule />
        </section>
      </header>

      <details className="mt-6 border-b border-border pb-4 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold underline decoration-dotted decoration-1 underline-offset-[5px]">
          {t("stage.legendTitle")}
        </summary>
        <StageLegend className="mt-2 max-w-3xl" dense />
      </details>

      {/* Program buckets */}
      {dash === undefined ? (
        <p className="mt-12 text-muted">{t("common.loading")}</p>
      ) : (
        dash.categories.map((cat) => (
          <section
            key={cat.category}
            id={cat.category}
            aria-labelledby={`b-${cat.category}`}
            className="mt-16 scroll-mt-24"
          >
            <Kicker className="!text-base">{t("report.program")}</Kicker>
            <ReportHeading
              id={`b-${cat.category}`}
              mark={<CategoryMark category={cat.category} size={18} />}
              title={t(`category.${cat.category}`)}
              lead={`${fmt.num(cat.projects.length)} ${tn("landing.projectsPublished", cat.projects.length)}`}
            />

            <div className="mt-7 grid gap-x-12 gap-y-10 lg:grid-cols-[1fr_1.1fr]">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-normal">{t("tr.materialTotals")}</h3>
                <p className="mt-0.5 text-[13px] text-muted">{t("tr.materialTotalsHint")}</p>
                <div className="mt-3 border-t border-rule pt-2">
                  <LedgerBar ledger={{ ...cat.totals, availableToPledge: 0 }} showAvailable={false} />
                </div>
                <h3 className="mt-9 font-display text-xl font-normal">{t("project.financials")}</h3>
                <FinancialsTable rows={cat.financials} className="mt-3" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-normal">{t("tr.projects")}</h3>
                {cat.projects.length === 0 ? (
                  <p className="mt-2 text-[15px] text-muted">{t("landing.projectsEmpty")}</p>
                ) : (
                  <div className="mt-3 border-t border-rule">
                    {cat.projects.map((p) => (
                      <ProjectCard key={p.projectId} p={p} hrefBase="/transparency/projects" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ))
      )}

      {/* Weekly reports, each as a certificate */}
      <section aria-labelledby="reports-title" className="mt-20">
        <ReportHeading id="reports-title" title={t("tr.reportsTitle")} lead={t("tr.reportsLead")} />
        {reports === undefined ? (
          <p className="mt-4 text-muted">{t("common.loading")}</p>
        ) : reports.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">{t("tr.reportsEmpty")}</p>
        ) : (
          <ol className="mt-8 space-y-8">
            {[...reports]
              .sort((a, b) => b.periodEnd - a.periodEnd)
              .map((r) => (
                <ReportItem key={r.reportId} r={r} summary={pick(r.summaryEs, r.summaryEn)} />
              ))}
          </ol>
        )}
      </section>

      <p className="mt-14">
        <Link href="/donate" className={btn("primary", "lg")}>
          {t("landing.ctaDonate")}
        </Link>
      </p>
    </div>
  );
}

const SNAP_STAGES = ["pledged", "received", "delivered", "used", "verified"] as const;
const SNAP_COUNTS = ["pledgesCreated", "milestonesVerified", "evidenceApproved", "projectsPublished", "projectsPaused"] as const;

function ReportItem({ r, summary }: { r: WeeklyReport; summary: string }) {
  const { t, tn, pick, u } = useI18n();
  const fmt = useReportFmt();
  const snap = r.snapshot;
  return (
    <li className="border border-border bg-surface">
      <FlagBand />
      <div className="px-5 py-7 sm:px-10 sm:py-9">
        <div className="text-center">
          <Kicker className="!text-base">{t("report.weekly")}</Kicker>
          <h3 className="mt-1 font-display text-[1.7rem] font-normal leading-tight sm:text-[2.2rem]">
            {fmt.short(r.periodStart)} – {fmt.date(r.periodEnd)}
          </h3>
        </div>

        <p className="mx-auto mt-5 max-w-prose whitespace-pre-line text-[15px] leading-relaxed sm:text-base">{summary}</p>

        <dl className="mt-6 grid grid-cols-2 border-y border-rule text-center sm:grid-cols-5">
          {SNAP_COUNTS.map((k, i) => (
            <div
              key={k}
              className={`flex flex-col-reverse justify-end border-border px-2 py-4 ${i % 2 === 1 ? "border-l" : ""} ${
                i > 0 ? "sm:border-l" : ""
              } ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}
            >
              <dt className="mt-1.5 text-[13px] leading-snug text-muted">{tn(`tr.snap.${k}`, snap[k])}</dt>
              <dd className="font-display text-[1.9rem] font-normal leading-none tabular-nums">{fmt.num(snap[k])}</dd>
            </div>
          ))}
        </dl>

        {(snap.materials.length > 0 || snap.financials.length > 0) && (
          <details className="mt-5 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold underline decoration-dotted decoration-1 underline-offset-[5px]">
              {t("tr.snapshot")}
            </summary>
            {snap.materials.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-y border-rule text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[13px] text-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">
                        {t("project.materials")}
                      </th>
                      {SNAP_STAGES.map((k) => (
                        <th
                          key={k}
                          scope="col"
                          className={`px-2 py-2 text-right font-semibold ${k === "verified" || k === "pledged" ? STAGE_TEXT[k] : ""}`}
                        >
                          {t(`stage.${k}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snap.materials.map((m) => (
                      <tr key={m.itemKey} className="border-b border-border last:border-b-0">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          {pick(m.nameEs, m.nameEn)} <span className="text-muted">({u(m.unit)})</span>
                        </th>
                        {SNAP_STAGES.map((k) => (
                          <td key={k} className={`px-2 py-2 text-right font-display text-[15px] tabular-nums ${STAGE_TEXT[k]}`}>
                            {fmt.num(m[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {snap.financials.length > 0 && <FinancialsTable rows={snap.financials} className="mt-5 max-w-lg" />}
          </details>
        )}

        <footer className="mt-7 flex items-center gap-4 border-t border-border pt-6">
          <VerifiedBadge variant="seal" label={t("report.sealVerified")} className="shrink-0" />
          <div className="min-w-0 text-[13px] leading-relaxed text-muted">
            <p className="font-display text-base italic text-foreground">{t("report.sealVerified")}</p>
            <p>
              {t("tr.publishedOn")} {fmt.date(r.publishedAt)}
            </p>
          </div>
        </footer>
      </div>
    </li>
  );
}
