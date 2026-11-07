"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { Button, Chip, Label, Section, Skeleton, VerifiedBy, formatDate, inputCls, useAction } from "./ui";
import type { WeeklyReport } from "./types";
import type { DictKey } from "@/lib/dict";
import { formatMoney } from "./Financials";

const DAY = 24 * 60 * 60 * 1000;

function toInput(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromInput(s: string, endOfDay: boolean) {
  const [y, m, d] = s.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
}
function formatDay(ms: number, locale: string) {
  return new Date(ms).toLocaleDateString(locale === "es" ? "es-PR" : "en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function WeeklyReportsPanel() {
  const { t, locale } = useI18n();
  const { sessionToken, user } = useSession();
  const reports = useQuery(api.coordinator.listWeeklyReports, sessionToken ? { sessionToken } : "skip");
  const generate = useMutation(api.coordinator.generateWeeklyReport);
  const { busy, run } = useAction();
  // Default period: the last 7 days, ending today.
  const [range, setRange] = useState(() => {
    const now = Date.now();
    return { from: toInput(now - 6 * DAY), to: toInput(now) };
  });
  const [openId, setOpenId] = useState<Id<"weeklyReports"> | null>(null);
  const validRange = range.from && range.to && range.from <= range.to;

  const sorted = reports ? [...reports].sort((a, b) => b.periodEnd - a.periodEnd) : undefined;
  const current = sorted?.find((r) => r.reportId === openId) ?? sorted?.find((r) => r.status === "draft");

  return (
    <div className="space-y-5">
      <Section title={t("coord.wr.title")}>
        <p className="mb-4 max-w-prose text-sm text-muted">{t("coord.wr.note")}</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sessionToken || !validRange) return;
            let id: Id<"weeklyReports"> | null = null;
            const ok = await run(
              "gen",
              async () => {
                id = await generate({
                  sessionToken,
                  periodStart: fromInput(range.from, false),
                  periodEnd: fromInput(range.to, true),
                });
              },
              t("coord.wr.generated.toast"),
              user ? `${formatDay(fromInput(range.from, false), locale)} – ${formatDay(fromInput(range.to, true), locale)}` : undefined,
            );
            if (ok && id) setOpenId(id);
          }}
        >
          <div>
            <Label htmlFor="wr-from">{t("coord.wr.from")}</Label>
            <input id="wr-from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <Label htmlFor="wr-to">{t("coord.wr.to")}</Label>
            <input id="wr-to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={inputCls} />
          </div>
          <Button type="submit" variant="primary" busy={busy === "gen"} disabled={!validRange}>
            {t("coord.wr.generate")}
          </Button>
        </form>
      </Section>

      {sorted === undefined ? (
        <Skeleton rows={2} />
      ) : (
        <>
          {current && <ReportEditor key={current.reportId} report={current} />}
          <Section title={t("coord.wr.past")}>
            {sorted.length === 0 ? (
              <p className="text-sm text-muted">{t("coord.wr.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {sorted.map((r) => (
                  <li key={r.reportId}>
                    <button
                      type="button"
                      onClick={() => setOpenId(r.reportId)}
                      aria-current={current?.reportId === r.reportId || undefined}
                      className="flex w-full flex-wrap items-center gap-3 py-2.5 text-left text-sm hover:text-foreground aria-[current]:font-semibold"
                    >
                      <span className="tabular-nums">
                        {formatDay(r.periodStart, locale)} – {formatDay(r.periodEnd, locale)}
                      </span>
                      <Chip tone={r.status === "published" ? "leaf" : "amber"}>
                        {r.status === "published" ? t("coord.wr.published") : t("coord.wr.draft")}
                      </Chip>
                      {r.publishedAt && <span className="text-xs text-muted">{formatDate(r.publishedAt, locale)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function ReportEditor({ report }: { report: WeeklyReport }) {
  const { t, locale } = useI18n();
  const { sessionToken, user } = useSession();
  const update = useMutation(api.coordinator.updateWeeklyReport);
  const publish = useMutation(api.coordinator.publishWeeklyReport);
  const { busy, run } = useAction();
  const [es, setEs] = useState(report.summaryEs);
  const [en, setEn] = useState(report.summaryEn);
  const dirty = es !== report.summaryEs || en !== report.summaryEn;
  const isDraft = report.status === "draft";
  const signed = user ? `${t("coord.verifiedBy")} ${user.name}` : undefined;

  return (
    <Section
      title={`${t("coord.wr.period")}: ${formatDay(report.periodStart, locale)} – ${formatDay(report.periodEnd, locale)}`}
      aside={
        <Chip tone={isDraft ? "amber" : "leaf"}>{isDraft ? t("coord.wr.draft") : t("coord.wr.published")}</Chip>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-muted">{t("coord.wr.snapshot")}</p>
          <SnapshotView snapshot={report.snapshot} />
        </div>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sessionToken) return;
            await run("save", () => update({ sessionToken, reportId: report.reportId, summaryEs: es, summaryEn: en }), t("coord.wr.saved.toast"));
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor={`wr-es-${report.reportId}`}>{t("coord.wr.summaryEs")}</Label>
            <textarea
              id={`wr-es-${report.reportId}`}
              lang="es"
              rows={9}
              value={es}
              readOnly={!isDraft}
              onChange={(e) => setEs(e.target.value)}
              className={`${inputCls} leading-relaxed`}
            />
          </div>
          <div>
            <Label htmlFor={`wr-en-${report.reportId}`}>{t("coord.wr.summaryEn")}</Label>
            <textarea
              id={`wr-en-${report.reportId}`}
              lang="en"
              rows={9}
              value={en}
              readOnly={!isDraft}
              onChange={(e) => setEn(e.target.value)}
              className={`${inputCls} leading-relaxed`}
            />
          </div>
          </div>
          {isDraft ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="ghost" busy={busy === "save"} disabled={!dirty}>
                {t("coord.wr.saveSummary")}
              </Button>
              <Button
                type="button"
                variant="leaf"
                busy={busy === "pub"}
                disabled={!es.trim() || !en.trim()}
                onClick={() =>
                  sessionToken &&
                  run(
                    "pub",
                    async () => {
                      if (dirty) await update({ sessionToken, reportId: report.reportId, summaryEs: es, summaryEn: en });
                      await publish({ sessionToken, reportId: report.reportId });
                    },
                    t("coord.wr.published.toast"),
                    signed,
                  )
                }
              >
                {t("coord.wr.publish")}
              </Button>
            </div>
          ) : (
            report.publishedAt && <VerifiedBy text={`${t("coord.wr.published")} · ${t("badge.verified")}`} at={report.publishedAt} />
          )}
        </form>
      </div>
    </Section>
  );
}

type Snapshot = WeeklyReport["snapshot"];
const KPIS = ["pledgesCreated", "milestonesVerified", "evidenceApproved", "projectsPublished", "projectsPaused"] as const;
const MAT_STAGES = ["pledged", "received", "delivered", "used", "verified"] as const;

/** The computed snapshot (from real records only). Each stage stays its own column. */
function SnapshotView({ snapshot }: { snapshot: Snapshot }) {
  const { t, pick, locale } = useI18n();
  return (
    <div className="space-y-4 rounded-md border border-border bg-background/60 p-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {KPIS.map((k) => (
          <div key={k}>
            <dt className="text-xs text-muted">{t(`coord.wr.k.${k}` as DictKey)}</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{snapshot[k]}</dd>
          </div>
        ))}
      </dl>
      {snapshot.materials.length === 0 ? (
        <p className="text-xs text-muted">{t("coord.wr.noMovement")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-1.5 pr-2 text-left font-medium">{t("coord.material")}</th>
                {MAT_STAGES.map((s) => (
                  <th key={s} className="py-1.5 pl-2 text-right font-medium">
                    {t(`coord.stage.${s}` as DictKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot.materials.map((m) => (
                <tr key={`${m.itemKey}-${m.unit}`} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                    {pick(m.nameEs, m.nameEn)} <span className="text-xs font-normal text-muted">{m.unit}</span>
                  </th>
                  {MAT_STAGES.map((s) => (
                    <td key={s} className={`py-1.5 pl-2 text-right tabular-nums ${s === "verified" ? "font-semibold text-leaf" : ""}`}>
                      {m[s]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {snapshot.financials.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-3 text-xs">
          {snapshot.financials.map((f) => (
            <li key={f.currency} className="flex flex-wrap gap-x-3">
              <strong className="text-sm">{f.currency}</strong>
              <span>{t("coord.fin.received")} <span className="tabular-nums">{formatMoney(f.received, f.currency, locale)}</span></span>
              <span>{t("coord.fin.allocated")} <span className="tabular-nums">{formatMoney(f.allocated, f.currency, locale)}</span></span>
              <span>{t("coord.fin.spent")} <span className="tabular-nums">{formatMoney(f.spent, f.currency, locale)}</span></span>
              <span className="text-muted">{t("coord.fin.committed")} <span className="tabular-nums">{formatMoney(f.committed, f.currency, locale)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
