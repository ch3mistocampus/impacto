"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { useSession } from "@/lib/session";
import { CATEGORY_STYLE, Card, Spinner, StatusChip, btnPrimary } from "./ui";

export function FieldHome() {
  const { t, pick, locale } = useI18n();
  const { sessionToken } = useSession();
  const projects = useQuery(api.field.listMyProjects, sessionToken ? { sessionToken } : "skip");

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t("field.title")}</h1>
        <p className="mt-1 text-muted">{t("field.subtitle")}</p>
      </div>

      <Link href="/field/new" className={`${btnPrimary} w-full min-h-16 text-xl`}>
        <span aria-hidden className="text-2xl leading-none">+</span> {t("field.new")}
      </Link>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">{t("field.myProjects")}</h2>
        {projects === undefined ? (
          <div className="flex items-center gap-2 text-muted">
            <Spinner /> {t("common.loading")}
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center text-muted">{t("field.empty")}</Card>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => {
              const cat = CATEGORY_STYLE[p.category];
              return (
                <li key={p._id}>
                  <Link
                    href={`/field/${p._id}`}
                    className="flex min-h-16 items-stretch overflow-hidden rounded-2xl border border-border bg-surface hover:border-clay"
                  >
                    <span aria-hidden className={`w-2 shrink-0 ${cat.solid}`} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{pick(p.titleEs, p.titleEn) || t("field.untitled")}</span>
                        <StatusChip status={p.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <span className={cat.text}>{t(`category.${p.category}` as DictKey)}</span>
                        <span>
                          {p.needsCount} {t("field.needsCount")}
                        </span>
                        {p.needsToConfirm > 0 && (
                          <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber">
                            {p.needsToConfirm} {t("field.toConfirm")}
                          </span>
                        )}
                        <span>{new Date(p._creationTime).toLocaleDateString(locale === "es" ? "es-PR" : "en-US")}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
