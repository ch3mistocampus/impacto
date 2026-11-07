"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { CategoryMark, DoubleRule, Kicker, btn, intlLocale } from "@/components/ui/tricolor";
import { StatTile } from "./StatTile";
import { ProjectCard } from "./ProjectCard";
import { MaterialImage } from "./MaterialImage";
import { OrganizationPhotos } from "./OrganizationPhotos";
import { StageLegend } from "./LedgerBar";
import { DemoStamp } from "./PublicMeta";
import { CATEGORIES, CATEGORY_STYLE, STAGES, type Category } from "./types";

export function Landing() {
  const { t, tn, locale } = useI18n();
  const dash = useQuery(api.public.transparencyDashboard, {});
  const [filter, setFilter] = useState<Category | undefined>(undefined);
  const projects = useQuery(api.public.listPublishedProjects, filter ? { category: filter } : {});
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const num = (n: number | undefined) => (n === undefined ? "–" : nf.format(n));

  const sum = (k: "verified" | "pledged") => dash?.categories.reduce((a, c) => a + c.totals[k], 0);
  const verified = sum("verified");
  const pledged = sum("pledged");
  const reports = dash?.transparency.weeklyReportsPublished;

  return (
    <div className="pt-10 sm:pt-16">
      {/* Hero: a centred, certificate-like title page */}
      <section className="mx-auto max-w-3xl text-center" aria-labelledby="hero-title">
        <Kicker>{t("landing.kicker")}</Kicker>
        <h1
          id="hero-title"
          className="mx-auto mt-3 max-w-[14ch] font-display text-[2.75rem] font-normal leading-[1.06] tracking-[-0.01em] text-balance sm:text-[5rem]"
        >
          {t("landing.heroShort")}
        </h1>
        <p className="mx-auto mt-6 max-w-[36rem] text-[17px] leading-relaxed text-muted sm:text-lg">
          {t("landing.mission")}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/donate" className={btn("primary", "lg")}>
            {t("landing.ctaDonate")}
          </Link>
          <Link href="/transparency" className={btn("secondary", "lg")}>
            {t("landing.ctaTransparency")}
          </Link>
        </div>

        {/* Three figures, verified impact first */}
        <h2 className="sr-only">{t("landing.figuresLabel")}</h2>
        <dl
          className="mt-12 grid grid-cols-3 divide-x divide-border border-y border-border sm:mt-14"
          aria-live="polite"
        >
          <Figure value={num(verified)} label={tn("landing.fig.verified", verified ?? 0)} tone="text-emerald" />
          <Figure value={num(pledged)} label={tn("landing.fig.pledged", pledged ?? 0)} tone="text-gold-ink" />
          <Figure value={num(reports)} label={tn("tr.counter.weeklyReportsPublished", reports ?? 0)} />
        </dl>
        <DemoStamp asOf={dash?.asOf ?? null} className="mt-4 justify-center" />
      </section>

      <OrganizationPhotos />

      {/* Three programs */}
      <section className="mt-20 sm:mt-28" aria-labelledby="buckets-title">
        <div className="mx-auto max-w-2xl text-center">
          <Kicker>{t("landing.programsKicker")}</Kicker>
          <h2 id="buckets-title" className="mt-2 font-display text-[2rem] font-normal leading-tight sm:text-[2.75rem]">
            {t("landing.bucketsTitle")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{t("landing.bucketsLead")}</p>
          <Legend />
        </div>

        <DoubleRule className="mt-10" />
        <div className="grid md:grid-cols-3 md:divide-x md:divide-border">
          {CATEGORIES.map((c) => {
            const row = dash?.categories.find((r) => r.category === c);
            return (
              <article
                key={c}
                aria-labelledby={`prog-${c}`}
                className="flex flex-col border-b border-border py-8 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0"
              >
                <MaterialImage
                  src={CATEGORY_STYLE[c].image}
                  alt=""
                  className="mb-6 h-44 w-full rounded-[2px]"
                  sizes="(min-width: 768px) 320px, 640px"
                />
                <div className="flex items-center gap-2.5">
                  <CategoryMark category={c} size={14} />
                  <span className="text-[13px] text-muted">
                    {row ? nf.format(row.projects.length) : "–"} {tn("landing.projectsPublished", row?.projects.length ?? 0)}
                  </span>
                </div>
                <h3 id={`prog-${c}`} className="mt-3 font-display text-[1.85rem] font-normal leading-tight">
                  {t(`category.${c}`)}
                </h3>
                <p className="mt-1.5 text-[15px] leading-snug text-muted">{t(`landing.desc.${c}` as DictKey)}</p>

                <p className="mt-6 flex items-baseline gap-3">
                  <span className="font-display text-[3.25rem] font-normal leading-none tabular-nums text-emerald">
                    {num(row?.totals.verified)}
                  </span>
                  <span className="text-[15px] font-semibold text-emerald">{t("landing.programVerified")}</span>
                </p>

                <div className="mt-5 border-t border-border pt-2" aria-live="polite">
                  <p className="sr-only">{t("landing.programLedger")}</p>
                  {row ? (
                    STAGES.filter((k) => k !== "verified").map((k) => (
                      <StatTile key={k} tone={k} label={t(`stage.${k}`)} value={row.totals[k]} />
                    ))
                  ) : (
                    <p className="py-6 text-[15px] text-muted">{t("common.loading")}</p>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-6">
                  <Link href={`/donate?category=${c}`} className={btn("quiet", "md", "min-h-11")}>
                    {t("landing.ctaDonate")}
                  </Link>
                  <Link href={`/transparency#${c}`} className={btn("quiet", "md", "min-h-11 text-muted")}>
                    {t("landing.bucketTransparency")}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        <DoubleRule />
      </section>

      {/* Privacy */}
      <section
        className="mx-auto mt-20 grid max-w-4xl gap-6 sm:mt-28 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-10"
        aria-labelledby="privacy-title"
      >
        <svg viewBox="0 0 48 48" className="size-14 text-foreground sm:mt-2 sm:size-16" aria-hidden fill="none">
          <circle cx="24" cy="24" r="22.5" stroke="currentColor" strokeWidth="1" />
          <path
            d="M24 36s-8-8.2-8-14a8 8 0 0 1 16 0c0 5.8-8 14-8 14z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="22" r="2.6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 12l24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div>
          <Kicker>{t("landing.privacyKicker")}</Kicker>
          <h2 id="privacy-title" className="mt-1 font-display text-[1.85rem] font-normal leading-tight sm:text-[2.25rem]">
            {t("landing.privacyTitle")}
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">{t("landing.privacyBody")}</p>
        </div>
      </section>

      {/* Projects */}
      <section id="proyectos" className="mt-20 scroll-mt-24 sm:mt-28" aria-labelledby="projects-title">
        <div className="flex flex-col gap-4 border-b border-rule pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Kicker>{t("landing.projectsKicker")}</Kicker>
            <h2 id="projects-title" className="mt-1 font-display text-[2rem] font-normal leading-tight sm:text-[2.75rem]">
              {t("landing.projectsTitle")}
            </h2>
          </div>
          <CategoryChips
            value={filter}
            onChange={setFilter}
            allLabel={t("landing.allCategories")}
            label={t("landing.filterLabel")}
          />
        </div>
        <div className="mt-1">
          {projects === undefined ? (
            <p className="py-8 text-muted">{t("common.loading")}</p>
          ) : projects.length === 0 ? (
            <p className="py-8 text-muted">{t("landing.projectsEmpty")}</p>
          ) : (
            projects.map((p) => <ProjectCard key={p.projectId} p={p} />)
          )}
        </div>
      </section>
    </div>
  );
}

function Figure({ value, label, tone = "text-foreground" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex flex-col-reverse items-center justify-end px-2 py-6 sm:px-6 sm:py-8">
      <dt className="mt-2.5 text-[13px] leading-snug text-muted sm:text-[15px]">{label}</dt>
      <dd className={`font-display text-[2.4rem] font-normal leading-none tabular-nums sm:text-[3.5rem] ${tone}`}>
        {value}
      </dd>
    </div>
  );
}

function Legend() {
  const { t } = useI18n();
  return (
    <details className="group mx-auto mt-4 max-w-xl text-left text-[15px]">
      <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-semibold underline decoration-dotted decoration-1 underline-offset-[5px] [&::-webkit-details-marker]:hidden">
        {t("landing.howTitle")}
        <svg viewBox="0 0 10 6" className="size-2.5 transition-transform group-open:rotate-180" aria-hidden fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </summary>
      <StageLegend className="mt-3 border-y border-border py-4" />
    </details>
  );
}

/** Program filter: square outlined chips with the shape mark; selected = navy fill. */
export function CategoryChips({
  value,
  onChange,
  allLabel,
  label,
}: {
  value: Category | undefined;
  onChange: (c: Category | undefined) => void;
  allLabel: string;
  label?: string;
}) {
  const { t } = useI18n();
  const opts: (Category | undefined)[] = [undefined, ...CATEGORIES];
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 md:pb-0">
      {opts.map((c) => {
        const active = value === c;
        return (
          <button
            key={c ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[2px] px-4 text-[15px] font-semibold transition-colors ${
              active
                ? "bg-navy text-on-navy"
                : "bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--rule)]"
            }`}
          >
            {c && <CategoryMark category={c} size={10} />}
            {c ? t(`category.${c}`) : allLabel}
          </button>
        );
      })}
    </div>
  );
}
