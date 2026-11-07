"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { DoubleRule, FlagBand, Kicker, STAGE_TEXT, Seal, StageSwatch, intlLocale } from "@/components/ui/tricolor";
import { Button, Caption, Chip, Label, Leader, Section, Skeleton, VerifiedBy, formatDate, inputCls, useAction } from "./ui";
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
  return new Date(ms).toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric", year: "numeric" });
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
              <ul className="-my-2 divide-y divide-border">
                {sorted.map((r) => (
                  <li key={r.reportId}>
                    <button
                      type="button"
                      onClick={() => setOpenId(r.reportId)}
                      aria-current={current?.reportId === r.reportId || undefined}
                      className="group flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left"
                    >
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 ${current?.reportId === r.reportId ? "bg-navy" : "shadow-[inset_0_0_0_1px_var(--border)]"}`}
                      />
                      <span className="font-display text-lg tabular-nums group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                        {formatDay(r.periodStart, locale)} – {formatDay(r.periodEnd, locale)}
                      </span>
                      <Chip tone={r.status === "published" ? "navy" : "neutral"}>
                        {r.status === "published" ? t("coord.wr.published") : t("coord.wr.draft")}
                      </Chip>
                      {r.publishedAt && <span className="text-[13px] text-muted">{formatDate(r.publishedAt, locale)}</span>}
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
    <div>
      <Caption>{isDraft ? t("coord.wr.preview") : t("coord.wr.published")}</Caption>
      <article className="relative rounded-[2px] border border-border bg-surface">
        <FlagBand className="absolute inset-x-0 top-0" />
        <header className="px-5 pb-6 pt-10 text-center sm:px-10">
          <Kicker>{t("coord.wr.certificate")}</Kicker>
          <h2 className="mt-2 font-display text-3xl font-normal leading-tight tabular-nums sm:text-4xl">
            <span className="sr-only">{t("coord.wr.period")}: </span>
            {formatDay(report.periodStart, locale)} – {formatDay(report.periodEnd, locale)}
          </h2>
          <div className="mt-3 flex justify-center">
            <Chip tone={isDraft ? "neutral" : "navy"}>{isDraft ? t("coord.wr.draft") : t("coord.wr.published")}</Chip>
          </div>
        </header>
        <DoubleRule className="mx-5 sm:mx-10" />
        <div className="space-y-6 px-5 pb-8 pt-6 sm:px-10">
          <div>
            <Caption className="text-center">{t("coord.wr.snapshot")}</Caption>
            <SnapshotView snapshot={report.snapshot} />
          </div>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!sessionToken) return;
              await run("save", () => update({ sessionToken, reportId: report.reportId, summaryEs: es, summaryEn: en }), t("coord.wr.saved.toast"));
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor={`wr-es-${report.reportId}`}>{t("coord.wr.summaryEs")}</Label>
                <textarea
                  id={`wr-es-${report.reportId}`}
                  lang="es"
                  rows={9}
                  value={es}
                  readOnly={!isDraft}
                  onChange={(e) => setEs(e.target.value)}
                  className={`${inputCls} leading-relaxed ${isDraft ? "" : "border-transparent! bg-transparent! px-0!"}`}
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
                  className={`${inputCls} leading-relaxed ${isDraft ? "" : "border-transparent! bg-transparent! px-0!"}`}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-5">
              <Seal size={76} title="Espejo de Agua">
                Espejo
                <br />
                de Agua
              </Seal>
              <p className="min-w-[12rem] flex-1 font-display text-[15px] italic text-muted">
                {t("coord.wr.signedBy")} Espejo de Agua
                {user && (
                  <span className="block font-sans text-[13px] not-italic">
                    {isDraft ? t("coord.youWillSign") : t("coord.verifiedBy")}{" "}
                    <strong className="font-semibold text-foreground">{user.name}</strong>
                  </span>
                )}
              </p>
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
            </div>
          </form>
        </div>
      </article>
    </div>
  );
}

type Snapshot = WeeklyReport["snapshot"];
const KPIS = ["pledgesCreated", "milestonesVerified", "evidenceApproved", "projectsPublished", "projectsPaused"] as const;
const MAT_STAGES = ["pledged", "received", "delivered", "used", "verified"] as const;

/** The computed snapshot (from real records only). Each stage stays its own column. */
function SnapshotView({ snapshot }: { snapshot: Snapshot }) {
  const { t, pick, locale, u } = useI18n();
  return (
    <div className="space-y-6 text-sm">
      <dl className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
        {KPIS.map((k) => (
          <div key={k} className="flex flex-col-reverse justify-end gap-1.5 bg-surface px-3 py-4 text-center last:col-span-2 lg:last:col-span-1">
            <dt className="text-[13px] leading-tight text-muted">{t(`coord.wr.k.${k}` as DictKey)}</dt>
            <dd className={`font-display text-4xl font-normal leading-none tabular-nums ${k === "milestonesVerified" && snapshot[k] > 0 ? "text-emerald" : ""}`}>
              {snapshot[k]}
            </dd>
          </div>
        ))}
      </dl>
      {snapshot.materials.length === 0 ? (
        <p className="text-center font-display text-[15px] italic text-muted">{t("coord.wr.noMovement")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-y border-rule text-sm">
            <thead>
              <tr className="border-b border-border text-[13px] text-muted">
                <th className="py-2 pr-2 text-left font-semibold">{t("coord.material")}</th>
                {MAT_STAGES.map((s) => (
                  <th key={s} className={`py-2 pl-2 text-right font-semibold ${s === "pledged" || s === "verified" ? STAGE_TEXT[s] : ""}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <StageSwatch stage={s} size={8} />
                      {t(`coord.stage.${s}` as DictKey)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot.materials.map((m) => (
                <tr key={`${m.itemKey}-${m.unit}`} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-2 text-left font-semibold">
                    {pick(m.nameEs, m.nameEn)} <span className="text-[13px] font-normal text-muted">{u(m.unit)}</span>
                  </th>
                  {MAT_STAGES.map((s) => (
                    <td key={s} className={`py-2 pl-2 text-right font-display text-lg tabular-nums ${m[s] === 0 ? "text-muted/60" : STAGE_TEXT[s]}`}>
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
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {snapshot.financials.map((f) => (
            <dl key={f.currency}>
              <p className="border-b border-rule pb-1 font-display text-xl">{f.currency}</p>
              <Leader label={t("coord.fin.received")} value={formatMoney(f.received, f.currency, locale)} />
              <Leader label={t("coord.fin.allocated")} value={formatMoney(f.allocated, f.currency, locale)} />
              <Leader label={t("coord.fin.spent")} value={formatMoney(f.spent, f.currency, locale)} />
              <Leader
                label={<span className="text-gold-ink">{t("coord.fin.committed")}</span>}
                value={formatMoney(f.committed, f.currency, locale)}
                valueClass="text-gold-ink"
              />
            </dl>
          ))}
        </div>
      )}
    </div>
  );
}
