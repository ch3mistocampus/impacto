"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { CategoryBadge } from "./CategoryBadge";
import { MaterialImage } from "./MaterialImage";
import { DemoTag, StatusBadge } from "./PublicMeta";
import { STAGE_TEXT, stageSwatch } from "./ledgerStyles";
import { CATEGORY_STYLE, STAGES, type Category, type PublicStatus, type StageTotals } from "./types";

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

export function ProjectCard({ p, hrefBase = "/p" }: { p: ProjectCardData; hrefBase?: string }) {
  const { t, pick } = useI18n();
  const s = CATEGORY_STYLE[p.category];
  return (
    <Link
      href={`${hrefBase}/${p.projectId}`}
      className="group grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] gap-4 py-4 border-b border-border last:border-b-0"
    >
      <div className={`aspect-square rounded-xl overflow-hidden ${s.soft}`}>
        <MaterialImage
          src={p.coverPhotoUrl ?? s.image}
          alt=""
          emoji={s.emoji}
          className={`size-full ${p.coverPhotoUrl ? "object-cover" : ""}`}
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={p.category} />
          <StatusBadge status={p.status} />
          {p.isDemo !== false && <DemoTag />}
        </div>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug group-hover:underline underline-offset-4 decoration-2">
          {p.publicAlias}
        </h3>
        <p className="text-sm text-muted line-clamp-2">{pick(p.titleEs, p.titleEn)}</p>
        {p.region && (
          <p className="text-xs text-muted mt-1">
            {t("project.region")}: {p.region}
          </p>
        )}
        <StageStrip totals={p.totals} className="mt-2" />
      </div>
    </Link>
  );
}

/** Six tiny separate counters — never a single merged progress bar. */
export function StageStrip({ totals, className = "" }: { totals: StageTotals; className?: string }) {
  const { t } = useI18n();
  return (
    <dl className={`grid grid-cols-3 gap-x-3 gap-y-1 text-xs max-w-md ${className}`}>
      {STAGES.map((k) => (
        <div key={k} className="flex items-center gap-1.5 min-w-0">
          <span className="size-2.5 shrink-0 rounded-[2px]" style={stageSwatch(k)} aria-hidden />
          <dt className="sr-only">{t(`stage.${k}`)}</dt>
          <dd className={`font-semibold tabular-nums ${STAGE_TEXT[k]}`}>{totals[k].toLocaleString()}</dd>
          <span className="text-muted truncate" aria-hidden>
            {t(`stage.${k}`)}
          </span>
        </div>
      ))}
    </dl>
  );
}
