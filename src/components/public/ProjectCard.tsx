"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { CategoryBadge } from "./CategoryBadge";
import { MaterialImage } from "./MaterialImage";
import { PendingBadge } from "./VerifiedBadge";
import { CATEGORY_STYLE, type Category } from "./types";

export type ProjectCardData = {
  projectId: string;
  publicAlias: string;
  category: Category;
  titleEs: string;
  titleEn: string;
  summaryEs: string;
  summaryEn: string;
  status: "published" | "paused" | "completed";
  region: string | null;
  coverPhotoUrl: string | null;
  needsCount: number;
  totals: { requested: number; pledged: number; received: number; used: number };
};

export function ProjectCard({ p }: { p: ProjectCardData }) {
  const { t, pick } = useI18n();
  const s = CATEGORY_STYLE[p.category];
  const usedPct = p.totals.requested > 0 ? Math.min(100, (p.totals.used / p.totals.requested) * 100) : 0;
  return (
    <Link
      href={`/p/${p.projectId}`}
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
          {p.status === "paused" && <PendingBadge label={t("project.paused")} />}
          {p.status === "completed" && (
            <span className="text-xs font-semibold text-leaf">{t("project.completed")}</span>
          )}
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
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="h-1.5 flex-1 max-w-40 rounded-full bg-border overflow-hidden" aria-hidden>
            <span className="block h-full bg-sky" style={{ width: `${usedPct}%` }} />
          </span>
          <span className="text-muted tabular-nums">
            {t("ledger.used")}: {p.totals.used.toLocaleString()} / {p.totals.requested.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
