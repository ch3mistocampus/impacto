"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { CategoryBadge } from "./CategoryBadge";
import { LedgerBar } from "./LedgerBar";
import { MaterialImage } from "./MaterialImage";
import { Timeline, toTimelineItems } from "./Timeline";
import { VerifiedBadge } from "./VerifiedBadge";
import { CATEGORY_STYLE } from "./types";

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t, pick } = useI18n();
  const data = useQuery(api.public.getProject, { projectId });

  if (data === undefined) return <p className="py-16 text-muted">{t("common.loading")}</p>;
  if (data === null) {
    return (
      <div className="py-16">
        <p className="font-display text-2xl font-semibold">{t("project.notFound")}</p>
        <Link href="/" className="mt-4 inline-block font-semibold underline underline-offset-4">
          {t("project.backHome")}
        </Link>
      </div>
    );
  }

  const { project: p, needs, timeline, photos } = data;
  const s = CATEGORY_STYLE[p.category];
  const canPledge = p.status === "published" && needs.some((n) => n.ledger.availableToPledge > 0);

  return (
    <div className="pt-6 sm:pt-10">
      <Link href="/#proyectos" className="text-sm text-muted underline underline-offset-4">
        {t("common.back")}
      </Link>

      <header className="mt-4 grid gap-6 md:grid-cols-[1fr_18rem] md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={p.category} />
            {p.status === "completed" && (
              <span className="rounded-full bg-leaf-soft text-leaf px-2.5 py-1 text-xs font-semibold">
                {t("project.completed")}
              </span>
            )}
          </div>
          <h1 className={`mt-3 font-display text-4xl sm:text-5xl font-semibold leading-[1.05] ${s.text}`}>
            {p.publicAlias}
          </h1>
          <p className="mt-2 font-display text-xl sm:text-2xl">{pick(p.titleEs, p.titleEn)}</p>
          {p.region && (
            <p className="mt-2 text-sm text-muted">
              {t("project.region")}: <span className="text-foreground font-semibold">{p.region}</span>
            </p>
          )}
        </div>
        <div className={`hidden md:block aspect-square rounded-3xl overflow-hidden ${s.soft}`}>
          <MaterialImage
            src={p.coverPhotoUrl ?? s.image}
            alt=""
            emoji={s.emoji}
            className={`size-full ${p.coverPhotoUrl ? "object-cover" : ""}`}
          />
        </div>
      </header>

      {p.status === "paused" && (
        <div role="status" className="mt-6 rounded-2xl border-2 border-amber bg-amber-soft px-5 py-4">
          <p className="font-display text-xl font-semibold text-amber">{t("project.paused")}</p>
          <p className="mt-1 text-sm">{p.safetyPauseReasonPublic || t("project.pausedDefault")}</p>
        </div>
      )}

      <p className="mt-6 text-lg leading-relaxed max-w-[38rem]">{pick(p.summaryEs, p.summaryEn)}</p>
      <p className="mt-3 text-sm text-muted max-w-[38rem]">{t("project.privacyNote")}</p>

      {canPledge && (
        <Link
          href={`/donate?category=${p.category}`}
          className="mt-6 inline-flex rounded-full bg-clay text-white px-6 py-3.5 font-semibold shadow-[0_2px_0_var(--brick)]"
        >
          {t("project.pledgeCta")}
        </Link>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
        <section aria-labelledby="materials-title">
          <h2 id="materials-title" className="font-display text-2xl sm:text-3xl font-semibold">
            {t("project.materials")}
          </h2>
          <ul className="mt-4 space-y-4">
            {needs.map((n) => (
              <li key={n.needId} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`size-14 shrink-0 rounded-xl ${s.soft} grid place-items-center`}>
                    <MaterialImage itemKey={n.itemKey} alt="" className="size-12" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl font-semibold leading-tight">{pick(n.nameEs, n.nameEn)}</h3>
                    <p className="text-xs text-muted">{n.unit}</p>
                  </div>
                  {n.verified && <VerifiedBadge compact />}
                </div>
                <LedgerBar ledger={n.ledger} unit={n.unit} showAvailable={p.status === "published"} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="font-display text-2xl sm:text-3xl font-semibold">
            {t("project.timeline")}
          </h2>
          <div className="mt-5">
            <Timeline items={toTimelineItems(timeline)} />
          </div>
        </section>
      </div>

      <section className="mt-12" aria-labelledby="photos-title">
        <h2 id="photos-title" className="font-display text-2xl sm:text-3xl font-semibold">
          {t("project.photos")}
        </h2>
        {photos.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("project.noPhotos")}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((ph) => {
              const cap = pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined);
              return (
                <li key={ph.photoId}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ph.url}
                      alt={cap || p.publicAlias}
                      className="aspect-[4/3] w-full rounded-xl object-cover border border-border"
                    />
                    {cap && <figcaption className="mt-1 text-xs text-muted">{cap}</figcaption>}
                  </figure>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
