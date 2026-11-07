"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { MaterialImage } from "./MaterialImage";
import { StatTile } from "./StatTile";
import { ProjectCard } from "./ProjectCard";
import { StageLegend } from "./LedgerBar";
import { DemoStamp } from "./PublicMeta";
import { CATEGORIES, CATEGORY_STYLE, STAGES, type Category } from "./types";

export function Landing() {
  const { t, tn } = useI18n();
  const dash = useQuery(api.public.transparencyDashboard, {});
  const [filter, setFilter] = useState<Category | undefined>(undefined);
  const projects = useQuery(api.public.listPublishedProjects, filter ? { category: filter } : {});

  return (
    <div className="pt-8 sm:pt-12">
      {/* Hero */}
      <section className="grid gap-8 md:grid-cols-[1.25fr_1fr] md:items-center">
        <div>
          <h1 className="font-display text-[2.4rem] leading-[1.05] sm:text-6xl font-semibold tracking-tight text-balance">
            {t("landing.heroTitle")}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted max-w-[34rem]">{t("landing.mission")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/donate"
              className="inline-flex items-center justify-center rounded-full bg-clay text-white px-6 py-3.5 text-base font-semibold shadow-[0_2px_0_var(--brick)] active:translate-y-px"
            >
              {t("landing.ctaDonate")}
            </Link>
            <Link
              href="/transparency"
              className="inline-flex items-center justify-center rounded-full border-2 border-foreground/80 px-6 py-3 text-base font-semibold"
            >
              {t("landing.ctaTransparency")}
            </Link>
          </div>
          <p className="mt-5 inline-flex items-start gap-2 text-sm text-amber bg-amber-soft rounded-lg px-3 py-2">
            <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-amber" />
            {t("landing.demoNotice")}
          </p>
        </div>
        <div className="relative aspect-[4/3] md:aspect-square rounded-[2rem] overflow-hidden bg-clay-soft">
          <MaterialImage src="/brand/hero.png" alt="" emoji="🏡" className="size-full object-cover" />
        </div>
      </section>

      {/* Three buckets */}
      <section className="mt-16 sm:mt-20" aria-labelledby="buckets-title">
        <div className="md:flex md:items-end md:justify-between gap-8">
          <div className="max-w-xl">
            <h2 id="buckets-title" className="font-display text-3xl sm:text-4xl font-semibold">
              {t("landing.bucketsTitle")}
            </h2>
            <p className="mt-2 text-muted">{t("landing.bucketsLead")}</p>
            <DemoStamp asOf={dash?.asOf ?? null} className="mt-3" />
          </div>
          <Legend />
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {CATEGORIES.map((c) => {
            const row = dash?.categories.find((r) => r.category === c);
            const s = CATEGORY_STYLE[c];
            return (
              <article key={c} className={`rounded-3xl border-t-[6px] ${s.border} bg-surface border-x border-b border-x-border border-b-border overflow-hidden`}>
                <div className={`${s.soft} aspect-[16/9] grid place-items-center`}>
                  <MaterialImage src={s.image} alt="" emoji={s.emoji} className="h-full w-full object-cover" />
                </div>
                <div className="p-5">
                  <h3 className={`font-display text-2xl font-semibold ${s.text}`}>{t(`category.${c}`)}</h3>
                  <p className="text-sm text-muted mt-1">{t(`landing.desc.${c}` as DictKey)}</p>
                  <p className="mt-3 text-sm">
                    <strong className="font-display text-lg tabular-nums">{row?.projects.length ?? "–"}</strong>{" "}
                    <span className="text-muted">{tn("landing.projectsPublished", row?.projects.length ?? 0)}</span>
                  </p>
                  <div className="mt-3 border-t border-border pt-2" aria-live="polite">
                    {row ? (
                      STAGES.map((k) => (
                        <StatTile key={k} tone={k} label={t(`stage.${k}`)} value={row.totals[k]} />
                      ))
                    ) : (
                      <p className="py-6 text-sm text-muted">{t("common.loading")}</p>
                    )}
                  </div>
                  <p className="mt-3 rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">
                    <span className="font-display text-lg tabular-nums mr-1.5">{row?.totals.verified ?? "–"}</span>
                    {tn("landing.verifiedImpact", row?.totals.verified ?? 0)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    <Link
                      href={`/donate?category=${c}`}
                      className={`inline-flex font-semibold ${s.text} underline underline-offset-4 decoration-2`}
                    >
                      {t("landing.ctaDonate")}
                    </Link>
                    <Link
                      href={`/transparency#${c}`}
                      className="inline-flex font-semibold text-foreground underline underline-offset-4 decoration-2"
                    >
                      {t("landing.bucketTransparency")}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Privacy */}
      <section className="mt-16 rounded-3xl border-2 border-dashed border-foreground/25 px-6 py-7 sm:px-10 sm:py-9 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <svg viewBox="0 0 48 48" className="size-14 text-sky" aria-hidden fill="none">
          <circle cx="24" cy="20" r="9" stroke="currentColor" strokeWidth="3" />
          <path d="M24 29c-6 8-6 8-6 8M24 29c6 8 6 8 6 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M8 8l32 32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold">{t("landing.privacyTitle")}</h2>
          <p className="mt-2 text-muted max-w-2xl">{t("landing.privacyBody")}</p>
        </div>
      </section>

      {/* Projects */}
      <section id="proyectos" className="mt-16 scroll-mt-24" aria-labelledby="projects-title">
        <h2 id="projects-title" className="font-display text-3xl sm:text-4xl font-semibold">
          {t("landing.projectsTitle")}
        </h2>
        <CategoryChips value={filter} onChange={setFilter} allLabel={t("landing.allCategories")} />
        <div className="mt-2">
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

function Legend() {
  const { t } = useI18n();
  return (
    <details className="mt-4 md:mt-0 md:max-w-sm text-sm group">
      <summary className="cursor-pointer font-semibold underline underline-offset-4 decoration-dotted">
        {t("landing.howTitle")}
      </summary>
      <StageLegend className="mt-3" />
    </details>
  );
}

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
    <div role="group" aria-label={label} className="mt-4 -mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
      {opts.map((c) => {
        const active = value === c;
        const s = c ? CATEGORY_STYLE[c] : null;
        return (
          <button
            key={c ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border-2 transition-colors ${
              active
                ? s
                  ? `${s.bg} ${s.border} text-white`
                  : "bg-foreground border-foreground text-background"
                : "border-border bg-surface text-foreground"
            }`}
          >
            {c ? t(`category.${c}`) : allLabel}
          </button>
        );
      })}
    </div>
  );
}
