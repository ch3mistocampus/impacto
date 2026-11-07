"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Caption, CategoryTag, Chip, Section, formatDate, useAction } from "./ui";
import { LockGlyph } from "./CoordinatorGate";
import type { ReviewPhoto, ReviewReport } from "./types";

type Draft = {
  source?: "openai" | "fallback";
  title?: string;
  titleEs?: string;
  titleEn?: string;
  category?: string;
  summaryEs?: string;
  summaryEn?: string;
  urgency?: string;
  materials?: {
    itemKey: string;
    nameEs: string;
    nameEn?: string;
    quantity?: number | null;
    qty?: number | null; // seed shape
    uncertain?: boolean;
    unit: string;
    confidence?: "high" | "medium" | "low";
    sourceQuote?: string;
  }[];
  missingQuestions?: { es: string; en: string }[];
  redactions?: number;
};

export function EvidencePanel({ reports, photos }: { reports: ReviewReport[]; photos: ReviewPhoto[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <Section title={t("coord.evidence")}>
        {reports.length === 0 ? (
          <p className="text-sm text-muted">{t("coord.noReport")}</p>
        ) : (
          <div className="space-y-6">
            {reports.map((r) => (
              <ReportView key={r.reportId} r={r} />
            ))}
          </div>
        )}
      </Section>
      <PhotoReview photos={photos} />
    </div>
  );
}

function ReportView({ r }: { r: ReviewReport }) {
  const { t, pick, locale, u } = useI18n();
  const draft = (r.draftExtraction ?? null) as Draft | null;
  const questions: string[] =
    draft?.missingQuestions && draft.missingQuestions.length > 0
      ? draft.missingQuestions.map((q) => pick(q.es, q.en))
      : r.missingQuestions;

  return (
    <article className="space-y-4">
      <p className="text-[13px] text-muted">
        {formatDate(r.createdAt, locale)} · <span lang="en">{r.language.toUpperCase()}</span>
      </p>

      <figure>
        <figcaption className="mb-1.5 font-display text-[15px] italic text-muted">{t("coord.transcript")}</figcaption>
        <blockquote
          lang={r.language}
          className="border-l border-rule py-1 pl-4 pr-2 font-display text-lg italic leading-relaxed"
        >
          “{r.transcriptOriginal}”
        </blockquote>
        {r.audioUrl && <audio controls src={r.audioUrl} className="mt-2 w-full" />}
      </figure>

      <div>
        <Caption>{t("coord.translation")}</Caption>
        <p lang={r.language === "es" ? "en" : "es"} className="text-[15px] leading-relaxed">
          {r.transcriptTranslated ?? <span className="text-muted">{t("coord.noTranslation")}</span>}
        </p>
      </div>

      {draft && (
        <div className="rounded-[2px] border border-dashed border-rule/60 bg-paper p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="navy">
              {t("coord.aiDraft")}
            </Chip>
            <span className="text-[13px] text-muted">{t("coord.aiDraftNote")}</span>
          </div>
          {(draft.titleEs || draft.titleEn || draft.title) && (
            <p className="mt-3 font-display text-xl leading-snug">{pick(draft.titleEs ?? draft.title, draft.titleEn)}</p>
          )}
          {(draft.summaryEs || draft.summaryEn) && (
            <p className="mt-1 text-[15px] leading-relaxed">{pick(draft.summaryEs, draft.summaryEn)}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {draft.category && <CategoryTag category={draft.category} />}
            {draft.urgency && <Chip>{t(`coord.urgency.${draft.urgency}` as DictKey)}</Chip>}
          </div>
          {draft.materials && draft.materials.length > 0 && (
            <ul className="mt-3 border-t border-border pt-2 text-sm">
              {draft.materials.map((m, i) => {
                const q = m.quantity ?? m.qty ?? null;
                return (
                <li key={i} className="py-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="min-w-0 shrink text-[15px]">{pick(m.nameEs, m.nameEn)}</span>
                    {(q === null || m.uncertain) && <Chip tone="gold">{t("ledger.needsConfirmation")}</Chip>}
                    {m.confidence && m.confidence !== "high" && <Chip>{m.confidence}</Chip>}
                    <span aria-hidden className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-muted/60" />
                    <span className={`shrink-0 whitespace-nowrap ${q === null ? "text-gold-ink" : ""}`}>
                      <span className="font-display text-lg tabular-nums">{q ?? "?"}</span> <span className="text-muted">{u(m.unit)}</span>
                    </span>
                  </div>
                  {m.sourceQuote && <p className="mt-0.5 font-display text-[15px] italic text-muted">“{m.sourceQuote}”</p>}
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <div>
          <Caption>{t("coord.missingQuestions")}</Caption>
          <ul className="list-disc space-y-1 pl-5 text-[15px] marker:text-muted">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function PhotoReview({ photos }: { photos: ReviewPhoto[] }) {
  const { t, pick } = useI18n();
  const { sessionToken } = useSession();
  const approve = useMutation(api.coordinator.approvePhoto);
  const { busy, run } = useAction();

  return (
    <Section title={t("coord.photos")}>
      <p className="mb-4 flex gap-2 border-l-2 border-gold bg-gold-soft px-3 py-2 text-sm text-foreground">
        <LockGlyph className="mt-0.5 size-4" />
        {t("coord.photos.warning")}
      </p>
      {photos.length === 0 ? (
        <p className="text-sm text-muted">{t("coord.photos.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((ph) => {
            const isPublic = ph.visibility === "publicApproved" && ph.reviewStatus === "approved";
            return (
              <li key={ph.photoId} className="flex flex-col border border-border bg-surface">
                <div className="relative aspect-square border-b border-border bg-paper">
                  {ph.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ph.url} alt={pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined)} className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1.5 top-1.5">
                    <Chip tone={isPublic ? "emerald" : "navy"} className={isPublic ? "" : "bg-surface"}>
                      {!isPublic && <LockGlyph className="size-3" />}
                      {isPublic ? t("coord.photo.public") : t("coord.photo.private")}
                    </Chip>
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2 p-2">
                  {(ph.captionEs || ph.captionEn) && (
                    <p className="line-clamp-2 text-[13px] text-muted">
                      {pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined)}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={isPublic ? "danger" : "leaf"}
                    className="w-full"
                    aria-pressed={isPublic}
                    busy={busy === ph.photoId}
                    onClick={() =>
                      sessionToken &&
                      run(
                        ph.photoId,
                        () => approve({ sessionToken, photoId: ph.photoId, approve: !isPublic }),
                        isPublic ? t("coord.photo.revoked") : t("coord.photo.approved"),
                      )
                    }
                  >
                    {isPublic ? t("coord.photo.revoke") : t("coord.photo.approve")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
