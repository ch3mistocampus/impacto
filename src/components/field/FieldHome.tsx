"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { DoubleRule, intlLocale } from "@/components/ui/tricolor";
import { CategoryLabel, Spinner, StatusChip, btnPrimary } from "./ui";
import { HomeTodos } from "./Todos";

export function FieldHome() {
  const { t, pick, locale } = useI18n();
  const { sessionToken } = useSession();
  const projects = useQuery(api.field.listMyProjects, sessionToken ? { sessionToken } : "skip");
  const fmtDate = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-8">
      <header>
        <h1 className="font-display text-[34px] font-normal leading-[1.1] sm:text-[40px]">{t("field.title")}</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">{t("field.subtitle")}</p>
      </header>

      <Link href="/field/new" className={`${btnPrimary} min-h-16 w-full text-lg`}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 5v14M5 12h14" strokeLinecap="square" />
        </svg>
        {t("field.new")}
      </Link>

      <HomeTodos />

      <section aria-labelledby="my-projects">
        <h2 id="my-projects" className="font-display text-2xl font-normal">
          {t("field.myProjects")}
        </h2>
        <DoubleRule className="mt-3" />
        {projects === undefined ? (
          <div className="flex items-center gap-2 py-6 text-muted">
            <Spinner /> {t("common.loading")}
          </div>
        ) : projects.length === 0 ? (
          <p className="py-8 text-center font-display text-lg italic text-muted">{t("field.empty")}</p>
        ) : (
          <ul className="divide-y divide-border border-b border-border">
            {projects.map((p) => (
              <li key={p._id}>
                <Link
                  href={`/field/${p._id}`}
                  className="group flex min-h-16 items-start gap-3 py-4 hover:bg-paper focus-visible:bg-paper sm:px-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[17px] font-semibold leading-snug underline-offset-4 group-hover:underline">
                        {pick(p.titleEs, p.titleEn) || t("field.untitled")}
                      </span>
                      <StatusChip status={p.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <CategoryLabel category={p.category} />
                      <span className="tabular-nums">
                        {p.needsCount} {t("field.needsCount")}
                      </span>
                      {p.needsToConfirm > 0 && (
                        <span className="font-semibold text-gold-ink tabular-nums">
                          {p.needsToConfirm} {t("field.toConfirm")}
                        </span>
                      )}
                      <span className="tabular-nums">{fmtDate.format(new Date(p._creationTime))}</span>
                    </div>
                    <ProgressHint p={p} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type Row = FunctionReturnType<typeof api.field.listMyProjects>[number];

/** One-line progress hint per project (changes requested, review, verified materials, pledges). */
function ProgressHint({ p }: { p: Row }) {
  const { t, tn } = useI18n();
  const parts: { text: string; tone: string }[] = [];
  if (p.openTodos > 0) parts.push({ text: tn("field.todo.n", p.openTodos), tone: "text-gold-ink font-semibold" });
  if (p.status === "draft" && p.changesRequested) parts.push({ text: t("field.hint.changes"), tone: "text-gold-ink font-semibold" });
  if (p.status === "in_review") parts.push({ text: t("field.hint.inReview"), tone: "text-gold-ink" });
  if (p.needsPublished > 0) {
    parts.push({
      text: `${p.needsVerified}/${p.needsPublished} ${t("field.hint.verified")}`,
      tone: p.needsVerified > 0 ? "text-emerald font-semibold" : "text-foreground",
    });
    if (p.needsReceiving > 0 && p.needsVerified < p.needsPublished)
      parts.push({ text: `${p.needsReceiving} ${t("field.hint.receiving")}`, tone: "text-foreground" });
  }
  if (p.activePledges > 0) parts.push({ text: tn("field.hint.pledges", p.activePledges), tone: "text-gold-ink" });
  if (p.pendingFollowUps > 0) parts.push({ text: tn("field.hint.followUps", p.pendingFollowUps), tone: "text-muted" });
  if (parts.length === 0) return null;
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums">
      {parts.map((x, i) => (
        <span key={i} className={x.tone}>
          {i > 0 && <span aria-hidden className="mr-3 text-border">·</span>}
          {x.text}
        </span>
      ))}
    </p>
  );
}
