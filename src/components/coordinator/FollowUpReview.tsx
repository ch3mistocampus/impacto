"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, Section, Skeleton, formatDate, inputCls, useAction } from "./ui";
import { LockGlyph } from "./CoordinatorGate";

type Row = FunctionReturnType<typeof api.coordinator.listFollowUps>[number];
const CHECKS = ["faces", "house", "names", "location"] as const;

/** Field follow-ups (notes/photos from the field worker) awaiting coordinator review. */
export function FollowUpReviewPanel({ projectId }: { projectId: Id<"projects"> }) {
  const { t } = useI18n();
  const { sessionToken } = useSession();
  const list = useQuery(api.coordinator.listFollowUps, sessionToken ? { sessionToken, projectId } : "skip");
  return (
    <Section title={t("field.cfu.title")}>
      <p className="mb-4 flex max-w-prose items-start gap-2 text-sm text-muted">
        <LockGlyph className="mt-0.5 size-4" />
        {t("field.cfu.note")}
      </p>
      {list === undefined ? (
        <Skeleton rows={2} />
      ) : list.length === 0 ? (
        <p className="border-y border-border px-4 py-10 text-center font-display text-lg italic text-muted">{t("field.cfu.empty")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((f) => (
            <FollowUpCard key={f.followUpId} f={f} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function FollowUpCard({ f }: { f: Row }) {
  const { t, locale } = useI18n();
  const { sessionToken, user } = useSession();
  const review = useMutation(api.coordinator.reviewFollowUp);
  const { busy, run } = useAction();
  const [es, setEs] = useState(f.noteEs ?? "");
  const [en, setEn] = useState(f.noteEn ?? "");
  const [publishPhoto, setPublishPhoto] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = CHECKS.every((c) => checked[c]);
  const pending = f.status === "pending";
  const tone = f.status === "approved" ? "emerald" : f.status === "rejected" ? "neutral" : "gold";

  return (
    <li className="rounded-[2px] border border-border bg-surface">
      {f.photo?.privateUrl && (
        <div className="relative aspect-square border-b border-border bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.photo.privateUrl} alt="" className="h-full w-full object-cover" />
          {f.photo.visibility !== "publicApproved" && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-[2px] bg-navy px-2 py-0.5 text-xs font-semibold text-on-navy">
              <LockGlyph className="size-3" />
              {t("coord.evr.private")}
            </span>
          )}
        </div>
      )}
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={tone}>{t(`field.fu.status.${f.status}` as DictKey)}</Chip>
          <span className="text-xs text-muted">
            {t("field.cfu.by")} <span className="text-foreground">{f.createdByName ?? "—"}</span>, {formatDate(f.createdAt, locale)}
          </span>
        </div>
        {pending ? (
          <>
            <label className="block text-xs font-semibold">
              {t("field.cfu.publicEs")}
              <textarea rows={2} value={es} onChange={(e) => setEs(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
            </label>
            <label className="block text-xs font-semibold">
              {t("field.cfu.publicEn")}
              <textarea rows={2} value={en} onChange={(e) => setEn(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
            </label>
            {f.photo && (
              <fieldset className="rounded-[2px] border border-gold/50 bg-gold-soft/50 p-2.5">
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--emerald)]"
                    checked={publishPhoto}
                    onChange={(e) => setPublishPhoto(e.target.checked)}
                  />
                  {t("field.cfu.publishPhoto")}
                </label>
                {publishPhoto && (
                  <>
                    <legend className="sr-only">{t("coord.evr.checklist")}</legend>
                    <p className="mt-1 text-xs font-semibold text-gold-ink">{t("coord.evr.checklist")}</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {CHECKS.map((c) => (
                        <label key={c} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--emerald)]"
                            checked={!!checked[c]}
                            onChange={(ev) => setChecked((s) => ({ ...s, [c]: ev.target.checked }))}
                          />
                          {t(`coord.evr.check.${c}` as DictKey)}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="leaf"
                disabled={publishPhoto && !allChecked}
                busy={busy === "approve"}
                onClick={() =>
                  sessionToken &&
                  run(
                    "approve",
                    () =>
                      review({
                        sessionToken,
                        followUpId: f.followUpId,
                        approve: true,
                        publishPhoto,
                        privacyConfirmed: publishPhoto && allChecked,
                        noteEs: es,
                        noteEn: en,
                      }),
                    t("field.cfu.approved.toast"),
                    user ? `${t("coord.verifiedBy")} ${user.name}` : undefined,
                  )
                }
              >
                {t("field.cfu.approve")}
              </Button>
              <Button
                size="sm"
                variant="danger"
                busy={busy === "reject"}
                onClick={() =>
                  sessionToken &&
                  run("reject", () => review({ sessionToken, followUpId: f.followUpId, approve: false }), t("field.cfu.rejected.toast"))
                }
              >
                {t("field.cfu.reject")}
              </Button>
            </div>
          </>
        ) : (
          <>
            {(f.noteEs || f.noteEn) && (
              <p className="text-sm leading-relaxed">{locale === "en" ? f.noteEn || f.noteEs : f.noteEs || f.noteEn}</p>
            )}
            {f.reviewedByName && (
              <p className="text-xs text-muted">
                {t("coord.evr.reviewedBy")} <span className="text-foreground">{f.reviewedByName}</span>
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
