"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, Section, formatDate, useAction } from "./ui";
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
  const { t, pick, locale } = useI18n();
  const draft = (r.draftExtraction ?? null) as Draft | null;
  const questions: string[] =
    draft?.missingQuestions && draft.missingQuestions.length > 0
      ? draft.missingQuestions.map((q) => pick(q.es, q.en))
      : r.missingQuestions;

  return (
    <article className="space-y-4">
      <p className="text-xs text-muted">
        {formatDate(r.createdAt, locale)} · {r.language.toUpperCase()}
      </p>

      <figure>
        <figcaption className="mb-1.5 text-xs font-medium text-muted">{t("coord.transcript")}</figcaption>
        <blockquote
          lang={r.language}
          className="border-l-4 border-clay bg-clay-soft/40 py-3 pl-4 pr-3 font-display text-[17px] italic leading-relaxed"
        >
          “{r.transcriptOriginal}”
        </blockquote>
        {r.audioUrl && <audio controls src={r.audioUrl} className="mt-2 w-full" />}
      </figure>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">{t("coord.translation")}</p>
        <p lang={r.language === "es" ? "en" : "es"} className="text-[15px] leading-relaxed text-foreground/85">
          {r.transcriptTranslated ?? <span className="text-muted">{t("coord.noTranslation")}</span>}
        </p>
      </div>

      {draft && (
        <div className="rounded-md border border-dashed border-amber/60 bg-amber-soft/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="amber">{t("coord.aiDraft")}</Chip>
            <span className="text-xs text-muted">{t("coord.aiDraftNote")}</span>
          </div>
          {(draft.titleEs || draft.titleEn || draft.title) && (
            <p className="mt-2 font-semibold">{pick(draft.titleEs ?? draft.title, draft.titleEn)}</p>
          )}
          {(draft.summaryEs || draft.summaryEn) && (
            <p className="mt-1 text-sm leading-relaxed">{pick(draft.summaryEs, draft.summaryEn)}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.category && <Chip>{t(`category.${draft.category}` as DictKey)}</Chip>}
            {draft.urgency && <Chip>{t(`coord.urgency.${draft.urgency}` as DictKey)}</Chip>}
          </div>
          {draft.materials && draft.materials.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {draft.materials.map((m, i) => {
                const q = m.quantity ?? m.qty ?? null;
                return (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium tabular-nums">
                    {q ?? "?"} {m.unit}
                  </span>
                  <span>{pick(m.nameEs, m.nameEn)}</span>
                  {(q === null || m.uncertain) && <Chip tone="amber">{t("ledger.needsConfirmation")}</Chip>}
                  {m.confidence && m.confidence !== "high" && <Chip>{m.confidence}</Chip>}
                  {m.sourceQuote && <span className="w-full text-xs italic text-muted">“{m.sourceQuote}”</span>}
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">{t("coord.missingQuestions")}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
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
      <p className="mb-3 flex gap-2 rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">
        <span aria-hidden>⚠</span>
        {t("coord.photos.warning")}
      </p>
      {photos.length === 0 ? (
        <p className="text-sm text-muted">{t("coord.photos.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((ph) => {
            const isPublic = ph.visibility === "publicApproved" && ph.reviewStatus === "approved";
            return (
              <li key={ph.photoId} className="overflow-hidden rounded-md border border-border bg-background">
                <div className="relative aspect-[4/3] bg-border/40">
                  {ph.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ph.url} alt={pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined)} className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1.5 top-1.5">
                    <Chip tone={isPublic ? "leaf" : "brick"}>
                      {isPublic ? t("coord.photo.public") : t("coord.photo.private")}
                    </Chip>
                  </span>
                </div>
                <div className="p-2">
                  {(ph.captionEs || ph.captionEn) && (
                    <p className="mb-1.5 line-clamp-2 text-xs text-muted">
                      {pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined)}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={isPublic ? "danger" : "ghost"}
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
