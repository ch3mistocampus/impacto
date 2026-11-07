"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useI18n } from "@/lib/i18n";
import { FinancialsTable } from "./Financials";
import { LedgerBar, StageLegend } from "./LedgerBar";
import { MaterialImage } from "./MaterialImage";
import { ProjectCard } from "./ProjectCard";
import { DemoStamp, DemoTag, useDateFmt } from "./PublicMeta";
import { STAGE_TEXT } from "./ledgerStyles";
import { api } from "../../../convex/_generated/api";
import type { WeeklyReport } from "./publicApi";
import { CATEGORY_STYLE } from "./types";

const COUNTERS = [
  "weeklyReportsPublished",
  "receiptsRecorded",
  "handoversSigned",
  "milestonesVerified",
  "outstandingUnverified",
] as const;

export function TransparencyDashboard() {
  const { t, tn, pick } = useI18n();
  const dash = useQuery(api.public.transparencyDashboard, {});
  const reports = useQuery(api.public.listWeeklyReports, {});

  return (
    <div className="pt-6 sm:pt-10">
      <header className="max-w-3xl">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.05]">{t("tr.title")}</h1>
        <p className="mt-3 text-lg text-muted leading-relaxed">{t("tr.lead")}</p>
        <DemoStamp asOf={dash?.asOf ?? null} explain className="mt-4" />
      </header>

      {/* Transparency counters: the record-keeping itself, as a ledger page */}
      <section aria-labelledby="counters-title" className="mt-10">
        <h2 id="counters-title" className="font-display text-2xl font-semibold">
          {t("tr.countersTitle")}
        </h2>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-5 border-y-2 border-foreground/80">
          {COUNTERS.map((k, i) => {
            const v = dash?.transparency[k];
            const warn = k === "outstandingUnverified" && (v ?? 0) > 0;
            return (
              <div
                key={k}
                className={`py-4 pr-3 ${i > 0 ? "sm:border-l sm:pl-4" : ""} ${i % 2 === 1 ? "border-l pl-4 sm:pl-4" : ""} border-border ${
                  i >= 2 ? "border-t sm:border-t-0" : ""
                }`}
              >
                <dd className={`font-display text-4xl font-semibold tabular-nums ${warn ? "text-amber" : ""}`}>
                  {v ?? "–"}
                </dd>
                <dt className="mt-1 text-sm text-muted leading-snug">{tn(`tr.counter.${k}`, v ?? 0)}</dt>
              </div>
            );
          })}
        </dl>
      </section>

      <details className="mt-6 max-w-2xl text-sm">
        <summary className="cursor-pointer font-semibold underline underline-offset-4 decoration-dotted">
          {t("stage.legendTitle")}
        </summary>
        <StageLegend className="mt-3" dense />
      </details>

      {/* Program buckets */}
      {dash === undefined ? (
        <p className="mt-12 text-muted">{t("common.loading")}</p>
      ) : (
        dash.categories.map((cat) => {
          const s = CATEGORY_STYLE[cat.category];
          const totals = cat.totals;
          return (
            <section
              key={cat.category}
              id={cat.category}
              aria-labelledby={`b-${cat.category}`}
              className={`mt-14 scroll-mt-24 border-t-[6px] ${s.border} pt-6`}
            >
              <div className="flex items-center gap-4">
                <div className={`size-16 shrink-0 rounded-2xl overflow-hidden ${s.soft}`}>
                  <MaterialImage src={s.image} alt="" emoji={s.emoji} className="size-full object-cover" />
                </div>
                <div>
                  <h2 id={`b-${cat.category}`} className={`font-display text-3xl sm:text-4xl font-semibold ${s.text}`}>
                    {t(`category.${cat.category}`)}
                  </h2>
                  <p className="text-sm text-muted">
                    {cat.projects.length} {tn("landing.projectsPublished", cat.projects.length)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
                <div>
                  <h3 className="font-semibold">{t("tr.materialTotals")}</h3>
                  <p className="text-xs text-muted">{t("tr.materialTotalsHint")}</p>
                  <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
                    <LedgerBar
                      ledger={{ ...totals, availableToPledge: 0 }}
                      showAvailable={false}
                    />
                  </div>
                  <h3 className="mt-6 font-semibold">{t("project.financials")}</h3>
                  <FinancialsTable rows={cat.financials} className="mt-2" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("tr.projects")}</h3>
                  {cat.projects.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">{t("landing.projectsEmpty")}</p>
                  ) : (
                    <div className="mt-1">
                      {cat.projects.map((p) => (
                        <ProjectCard key={p.projectId} p={p} hrefBase="/transparency/projects" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })
      )}

      {/* Weekly reports */}
      <section aria-labelledby="reports-title" className="mt-16">
        <h2 id="reports-title" className="font-display text-3xl font-semibold">
          {t("tr.reportsTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("tr.reportsLead")}</p>
        {reports === undefined ? (
          <p className="mt-4 text-muted">{t("common.loading")}</p>
        ) : reports.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("tr.reportsEmpty")}</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {[...reports]
              .sort((a, b) => b.periodEnd - a.periodEnd)
              .map((r) => (
                <ReportItem key={r.reportId} r={r} summary={pick(r.summaryEs, r.summaryEn)} />
              ))}
          </ol>
        )}
      </section>

      <p className="mt-12">
        <Link href="/donate" className="font-semibold underline underline-offset-4 decoration-2">
          {t("landing.ctaDonate")}
        </Link>
      </p>
    </div>
  );
}

const SNAP_STAGES = ["pledged", "received", "delivered", "used", "verified"] as const;
const SNAP_COUNTS = ["pledgesCreated", "milestonesVerified", "evidenceApproved", "projectsPublished", "projectsPaused"] as const;

function ReportItem({ r, summary }: { r: WeeklyReport; summary: string }) {
  const { t, tn, pick } = useI18n();
  const fmt = useDateFmt();
  const snap = r.snapshot;
  return (
    <li className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">
          {fmt.short(r.periodStart)} – {fmt.date(r.periodEnd)}
        </h3>
        <div className="flex items-center gap-2">
          {r.isDemo && <DemoTag />}
          <p className="text-xs text-muted">
            {t("tr.publishedOn")} {fmt.date(r.publishedAt)}
          </p>
        </div>
      </div>
      <p className="mt-2 leading-relaxed max-w-prose whitespace-pre-line">{summary}</p>

      <dl className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-2 text-sm">
        {SNAP_COUNTS.map((k) => (
          <div key={k}>
            <dd className="font-display text-xl font-semibold tabular-nums">{snap[k]}</dd>
            <dt className="text-xs text-muted leading-snug">{tn(`tr.snap.${k}`, snap[k])}</dt>
          </div>
        ))}
      </dl>

      {(snap.materials.length > 0 || snap.financials.length > 0) && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold underline underline-offset-4 decoration-dotted">
            {t("tr.snapshot")}
          </summary>
          {snap.materials.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th scope="col" className="py-1.5 pr-3 font-semibold">{t("project.materials")}</th>
                    {SNAP_STAGES.map((k) => (
                      <th key={k} scope="col" className={`py-1.5 px-2 font-semibold text-right ${STAGE_TEXT[k]}`}>
                        {t(`stage.${k}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snap.materials.map((m) => (
                    <tr key={m.itemKey} className="border-b border-border last:border-b-0">
                      <th scope="row" className="py-1.5 pr-3 font-medium text-left">
                        {pick(m.nameEs, m.nameEn)} <span className="text-muted font-normal">({m.unit})</span>
                      </th>
                      {SNAP_STAGES.map((k) => (
                        <td key={k} className="py-1.5 px-2 text-right tabular-nums">
                          {m[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {snap.financials.length > 0 && <FinancialsTable rows={snap.financials} className="mt-4 max-w-lg" />}
        </details>
      )}
    </li>
  );
}
