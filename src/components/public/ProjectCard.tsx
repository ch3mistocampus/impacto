"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { CategoryMark, intlLocale } from "@/components/ui/tricolor";
import { MaterialImage } from "./MaterialImage";
import { ProjectStatusChip } from "./reportKit";
import { STAGE_TEXT, stageSwatch } from "./ledgerStyles";
import { CATEGORY_STYLE, type Category, type PublicStatus, type StageTotals } from "./types";

export type ProjectCardData = {
  projectId: string;
  publicAlias: string;
  category: Category;
  titleEs: string;
  titleEn: string;
  summaryEs: string;
  summaryEn: string;
  status: PublicStatus;
  region: string | null;
  coverPhotoUrl: string | null;
  needsCount: number;
  isDemo?: boolean;
  safetyPauseReasonPublic?: string | null;
  totals: StageTotals;
};

/** A ruled list item, like an entry in a printed public register. */
export function ProjectCard({ p, hrefBase = "/p" }: { p: ProjectCardData; hrefBase?: string }) {
  const { t, pick } = useI18n();
  const s = CATEGORY_STYLE[p.category];
  return (
    <Link
      href={`${hrefBase}/${p.projectId}`}
      className="group grid grid-cols-[3.75rem_1fr] sm:grid-cols-[4.5rem_1fr] gap-x-4 gap-y-3 border-b border-border py-5 last:border-b-0 hover:bg-paper/60 focus-visible:bg-paper/60 transition-colors"
    >
      <div className="aspect-square overflow-hidden border border-border bg-surface text-foreground">
        <MaterialImage
          src={p.coverPhotoUrl ?? s.image}
          alt=""
          fallbackSrc={s.image}
          className="size-full"
          sizes="(min-width: 640px) 72px, 60px"
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            <CategoryMark category={p.category} size={10} className="text-foreground" />
            {t(`category.${p.category}`)}
          </span>
          <ProjectStatusChip status={p.status} />
        </div>
        <h3 className="mt-1.5 font-display text-[1.45rem] font-normal leading-tight group-hover:underline underline-offset-[5px] decoration-1">
          {p.publicAlias}
        </h3>
        <p className="mt-0.5 text-[15px] text-muted leading-snug line-clamp-2">{pick(p.titleEs, p.titleEn)}</p>
        {p.region && (
          <p className="mt-1 text-[13px] text-muted">
            {t("project.region")}: <span className="text-foreground">{p.region}</span>
          </p>
        )}
      </div>
      <StageStrip totals={p.totals} className="col-span-2 sm:col-span-1 sm:col-start-2" />
    </Link>
  );
}

const OTHERS = ["requested", "pledged", "received", "delivered", "used"] as const;

/**
 * Six separate counters — never a single merged progress bar. Verified (impact) leads, in
 * esmeralda; the other five follow as a small ruled register.
 */
export function StageStrip({ totals, className = "" }: { totals: StageTotals; className?: string }) {
  const { t, locale } = useI18n();
  const nf = (n: number) => n.toLocaleString(intlLocale(locale));
  return (
    <dl className={`flex items-stretch gap-3 sm:gap-4 max-w-lg ${className}`}>
      <div className="flex shrink-0 flex-col-reverse justify-center border-r border-border pr-3 sm:pr-4">
        <dt className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-emerald">
          <span className="size-2.5" style={stageSwatch("verified")} aria-hidden />
          {t("stage.verified")}
        </dt>
        <dd className="font-display text-[1.9rem] font-normal leading-none tabular-nums text-emerald">
          {nf(totals.verified)}
        </dd>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] content-center gap-x-2.5 gap-y-1 text-[13px]">
        {OTHERS.map((k) => (
          <div key={k} className="flex min-w-0 items-center gap-1.5">
            <span className="size-2.5 shrink-0" style={stageSwatch(k)} aria-hidden />
            <dt className={`order-3 truncate ${k === "pledged" ? "text-gold-ink" : "text-muted"}`}>{t(`stage.${k}`)}</dt>
            <dd className={`order-2 font-display text-[15px] leading-none tabular-nums ${STAGE_TEXT[k]}`}>{nf(totals[k])}</dd>
          </div>
        ))}
      </div>
    </dl>
  );
}
