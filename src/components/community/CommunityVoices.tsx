"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { CategoryBadge } from "@/components/public/CategoryBadge";
import { useDateFmt } from "@/components/public/PublicMeta";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Approved community Q&A (public allowlist from community.listApproved — never contact details).
 * With `projectId`, only that project's approved messages.
 */
export function CommunityVoices({
  projectId,
  limit = 20,
  showProject = true,
}: {
  projectId?: Id<"projects">;
  limit?: number;
  showProject?: boolean;
}) {
  const { t, pick } = useI18n();
  const fmt = useDateFmt();
  const rows = useQuery(api.community.listApproved, projectId ? { projectId, limit } : { limit });

  if (rows === undefined) return <p className="py-4 text-muted">{t("common.loading")}</p>;
  if (rows.length === 0) return <p className="border-y border-border py-4 text-muted">{t("community.qaNone")}</p>;

  return (
    <ul className="divide-y divide-border border-y border-rule">
      {rows.map((r) => {
        const answer = pick(r.responseEs ?? undefined, r.responseEn ?? undefined);
        return (
          <li key={r.feedbackId} className="py-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <span className="font-semibold uppercase tracking-wide text-navy">
                {t(`community.kind.${r.kind}` as DictKey)}
              </span>
              {showProject &&
                (r.project ? (
                  <Link
                    href={`/transparency/projects/${r.project.projectId}`}
                    className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                  >
                    <CategoryBadge category={r.project.category} />
                    <span className="text-muted">{r.project.publicAlias}</span>
                  </Link>
                ) : (
                  <span className="text-muted">{t("community.general")}</span>
                ))}
              <span className="text-muted">{fmt.date(r.createdAt)}</span>
            </div>
            <blockquote lang={r.language} className="mt-2 font-display text-xl leading-snug">
              “{r.message}”
            </blockquote>
            <p className="mt-1 text-xs text-muted">
              {t("community.writtenIn")} {t(`community.lang.${r.language}` as DictKey)}
            </p>
            {answer && (
              <div className="mt-3 border-l-2 border-emerald pl-3">
                <p className="text-xs font-semibold text-emerald">{t("community.answer")}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed">{answer}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
