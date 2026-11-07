"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { CategoryMark, DoubleRule, FlagBand, Kicker, StageSwatch, btn, intlLocale } from "@/components/ui/tricolor";
import { CategoryBadge } from "@/components/public/CategoryBadge";
import { DemoStamp, useDateFmt } from "@/components/public/PublicMeta";
import { api } from "../../../convex/_generated/api";
import { CommunityVoices } from "./CommunityVoices";
import { FeedbackForm } from "./FeedbackForm";

function fill(s: string, vars: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

/** /community — plain-language, privacy-safe progress + moderated community voice. */
export function CommunityHome() {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const dash = useQuery(api.public.transparencyDashboard, {});

  return (
    <div className="pt-6 sm:pt-10">
      <header className="max-w-3xl">
        <FlagBand />
        <Kicker className="mt-5 block">{t("community.kicker")}</Kicker>
        <h1 className="mt-1 font-display text-4xl font-normal leading-[1.05] sm:text-5xl">{t("community.title")}</h1>
        {user?.role === "community" && (
          <p className="mt-3 font-display text-xl italic">{fill(t("community.greeting"), { name: user.name })}</p>
        )}
        <p className="mt-3 text-lg leading-relaxed text-muted">{t("community.lead")}</p>
        <DemoStamp asOf={dash?.asOf ?? null} className="mt-4" />
      </header>

      <DoubleRule className="mt-8" />

      {/* 1. Progress, three programs */}
      <section aria-labelledby="cm-progress" className="mt-8">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 id="cm-progress" className="font-display text-2xl font-normal sm:text-3xl">
            {t("community.progressTitle")}
          </h2>
          <Link href="/transparency" className="ml-auto text-sm font-semibold underline underline-offset-4">
            {t("community.seeAll")} →
          </Link>
        </div>
        {dash === undefined ? (
          <p className="mt-4 text-muted">{t("common.loading")}</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {dash.categories.map((c) => {
              const nf = new Intl.NumberFormat(intlLocale(locale));
              const tt = c.totals;
              return (
                <li key={c.category} className="border border-border bg-surface p-5">
                  <p className="flex items-center gap-2 font-display text-xl">
                    <CategoryMark category={c.category} size={14} />
                    {t(`category.${c.category}` as DictKey)}
                  </p>
                  {c.projects.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">{t("community.progress.none")}</p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-display text-lg tabular-nums text-foreground">{c.projects.length}</span>{" "}
                        {t("community.progress.projects")}
                      </p>
                      <p className="mt-4 font-display text-5xl font-normal leading-none tabular-nums text-emerald">
                        {nf.format(tt.verified)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald">
                        <StageSwatch stage="verified" />
                        {t("donorHome.totalVerified")}
                      </p>
                      <p className="mt-3 text-[15px] leading-relaxed">
                        {fill(t("community.progress.line"), {
                          requested: nf.format(tt.requested),
                          received: nf.format(tt.received),
                          verified: nf.format(tt.verified),
                        })}
                      </p>
                      {tt.pledged > 0 && (
                        <p className="mt-2 text-sm text-gold-ink">
                          {fill(t("community.progress.pledgedNote"), { pledged: nf.format(tt.pledged) })}
                        </p>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <WeekSummary />
        <RecentOutcomes />
      </div>

      {/* 4. Community voice */}
      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="cm-qa">
          <h2 id="cm-qa" className="font-display text-2xl font-normal sm:text-3xl">
            {t("community.qaTitle")}
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">{t("community.qaNote")}</p>
          <CommunityVoices />
        </section>
        <section aria-labelledby="cm-form" id="escribir" className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="cm-form" className="font-display text-2xl font-normal sm:text-3xl">
            {t("community.form.title")}
          </h2>
          <p className="mt-1 mb-5 text-[15px] text-muted">{t("community.form.lead")}</p>
          <FeedbackForm />
        </section>
      </div>
    </div>
  );
}

function WeekSummary() {
  const { t, pick, locale } = useI18n();
  const fmt = useDateFmt();
  const reports = useQuery(api.public.listWeeklyReports, {});
  const r = reports?.[0];
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const sum = (k: "received" | "verified") => (r ? r.snapshot.materials.reduce((s, m) => s + m[k], 0) : 0);
  return (
    <section aria-labelledby="cm-week">
      <h2 id="cm-week" className="font-display text-2xl font-normal sm:text-3xl">
        {t("community.weekTitle")}
      </h2>
      {reports === undefined ? (
        <p className="mt-4 text-muted">{t("common.loading")}</p>
      ) : !r ? (
        <p className="mt-4 border-y border-border py-4 text-muted">{t("community.weekNone")}</p>
      ) : (
        <div className="mt-4 border-y border-rule py-5">
          <p className="text-sm text-muted">
            {t("community.weekPeriod")} {fmt.date(r.periodStart)} – {fmt.date(r.periodEnd)}
          </p>
          <p className="mt-2 line-clamp-4 text-[17px] leading-relaxed">{pick(r.summaryEs, r.summaryEn)}</p>
          <Link href="/transparency" className="mt-1 inline-block text-sm font-semibold underline underline-offset-4">
            {t("community.seeAll")} →
          </Link>
          <dl className="mt-4 grid grid-cols-3 border-t border-border text-center">
            {[
              { v: sum("verified"), l: t("community.week.verified"), c: "text-emerald" },
              { v: sum("received"), l: t("community.week.received"), c: "" },
              { v: r.snapshot.milestonesVerified, l: t("community.week.milestones"), c: "" },
            ].map((x, i) => (
              <div key={i} className={`flex flex-col-reverse py-3 ${i > 0 ? "border-l border-border" : ""}`}>
                <dt className="mt-1 text-xs text-muted">{x.l}</dt>
                <dd className={`font-display text-3xl tabular-nums ${x.c}`}>{nf.format(x.v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

function RecentOutcomes() {
  const { t, pick } = useI18n();
  const fmt = useDateFmt();
  const rows = useQuery(api.community.recentOutcomes, { limit: 6 });
  return (
    <section aria-labelledby="cm-outcomes">
      <h2 id="cm-outcomes" className="font-display text-2xl font-normal sm:text-3xl">
        {t("community.outcomesTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("community.outcomesNote")}</p>
      {rows === undefined ? (
        <p className="mt-4 text-muted">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 border-y border-border py-4 text-muted">{t("community.outcomesNone")}</p>
      ) : (
        <ol className="mt-4 divide-y divide-border border-y border-rule">
          {rows.map((m) => (
            <li key={m.milestoneId} className="flex gap-3 py-3.5">
              <StageSwatch stage="verified" size={12} className="mt-1.5" />
              <div className="min-w-0">
                <p className="text-[15px] leading-snug">{pick(m.descriptionEs, m.descriptionEn)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <CategoryBadge category={m.category} />
                  <Link href={`/transparency/projects/${m.projectId}`} className="underline underline-offset-4">
                    {m.publicAlias}
                  </Link>
                  <span>· {fmt.date(m.occurredAt)}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Link href="/transparency" className={btn("secondary", "sm", "mt-4")}>
        {t("community.seeAll")}
      </Link>
    </section>
  );
}
