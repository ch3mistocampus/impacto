"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, Section, Skeleton, formatDate, useAction } from "./ui";
import { LockGlyph } from "./CoordinatorGate";
import { EvidenceAttach, emptyEvidence, evidenceState, useCommitEvidence, type EvidenceDraft } from "./EvidenceAttach";
import type { EvidenceRow, ReviewData } from "./types";

const CHECKS = ["faces", "house", "names", "location"] as const;

export function EvidenceReviewPanel({ data }: { data: ReviewData }) {
  const { t } = useI18n();
  const { sessionToken } = useSession();
  const projectId = data.project.projectId;
  const list = useQuery(api.coordinator.listEvidence, sessionToken ? { sessionToken, projectId } : "skip");
  const needName = new Map(data.needs.map((n) => [n.needId as string, n] as const));

  return (
    <div className="space-y-5">
      <Section title={t("coord.evr.title")}>
        <p className="mb-4 flex max-w-prose items-start gap-2 text-sm text-muted">
          <LockGlyph className="mt-0.5 size-4" />
          {t("coord.evr.note")}
        </p>
        {list === undefined ? (
          <Skeleton rows={2} />
        ) : list.length === 0 ? (
          <p className="border-y border-border px-4 py-10 text-center font-display text-lg italic text-muted">{t("coord.evr.empty")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...list]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((e) => (
                <EvidenceCard key={e.evidenceId} e={e} needLabel={e.needId ? needName.get(e.needId) : undefined} />
              ))}
          </ul>
        )}
      </Section>
      <AddProjectEvidence projectId={projectId} />
    </div>
  );
}

function EvidenceCard({ e, needLabel }: { e: EvidenceRow; needLabel?: ReviewData["needs"][number] }) {
  const { t, pick, locale } = useI18n();
  const { sessionToken, user } = useSession();
  const review = useMutation(api.coordinator.reviewEvidence);
  const { busy, run } = useAction();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = CHECKS.every((c) => checked[c]);
  const url = e.privateUrl;
  const isPdf = e.contentType === "application/pdf";
  const note = pick(e.noteEs ?? undefined, e.noteEn ?? undefined);
  const status = e.reviewStatus;

  return (
    <li className="flex flex-col rounded-[2px] border border-border bg-surface">
      <div className={url ? "relative aspect-square border-b border-border bg-paper" : "relative border-b border-border bg-paper"}>
        {url && !isPdf ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={t(`coord.ev.type.${e.type}` as DictKey)} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full items-center p-4 text-sm text-muted ${url ? "justify-center text-center" : ""}`}>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-4">
                PDF · {t("coord.evr.open")} ↗
              </a>
            ) : (
              <span className="font-display text-lg italic leading-relaxed text-foreground">“{note || t("coord.evr.noFile")}”</span>
            )}
          </div>
        )}
        {/* Private originals are always labeled as such. */}
        {url && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-[2px] bg-navy px-2 py-0.5 text-xs font-semibold text-on-navy">
            <LockGlyph className="size-3" />
            {t("coord.evr.private")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="navy">{t(`coord.ev.type.${e.type}` as DictKey)}</Chip>
          <Chip tone={status === "approved" ? "emerald" : status === "rejected" ? "neutral" : "gold"}>
            {t(`coord.ev.${status}` as DictKey)}
          </Chip>
          {needLabel && <span className="text-[13px] text-muted">{pick(needLabel.nameEs, needLabel.nameEn)}</span>}
        </div>
        {note && url && <p className="text-[15px] leading-relaxed">{note}</p>}
        <p className="text-[13px] text-muted">
          {t("coord.evr.uploadedBy")} <span className="text-foreground">{e.uploadedByName ?? "—"}</span>, {formatDate(e.createdAt, locale)}
          {e.reviewedByName && (
            <>
              <br />
              {t("coord.evr.reviewedBy")} <span className="text-foreground">{e.reviewedByName}</span>
              {e.reviewedAt ? `, ${formatDate(e.reviewedAt, locale)}` : ""}
            </>
          )}
        </p>

        {status !== "approved" && (
          <fieldset className="rounded-[2px] border border-gold bg-gold-soft p-2.5">
            <legend className="px-1 text-[13px] font-semibold text-gold-ink">{t("coord.evr.checklist")}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {CHECKS.map((c) => (
                <label key={c} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--emerald)]"
                    checked={!!checked[c]}
                    onChange={(ev) => setChecked((s) => ({ ...s, [c]: ev.target.checked }))}
                  />
                  {t(`coord.evr.check.${c}` as DictKey)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {status !== "approved" && (
            <Button
              size="sm"
              variant="leaf"
              disabled={!allChecked}
              busy={busy === "approve"}
              onClick={() =>
                sessionToken &&
                run(
                  "approve",
                  // The checklist above is the coordinator's confirmation that the original is safe to show as-is.
                  () => review({ sessionToken, evidenceId: e.evidenceId, approve: true, usePrivateAsPublic: true }),
                  t("coord.evr.approved.toast"),
                  user ? `${t("coord.verifiedBy")} ${user.name}` : undefined,
                )
              }
            >
              {t("coord.evr.approve")}
            </Button>
          )}
          {status !== "rejected" && (
            <Button
              size="sm"
              variant="danger"
              busy={busy === "reject"}
              onClick={() =>
                sessionToken &&
                run("reject", () => review({ sessionToken, evidenceId: e.evidenceId, approve: false }), t("coord.evr.rejected.toast"))
              }
            >
              {t("coord.evr.reject")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function AddProjectEvidence({ projectId }: { projectId: Id<"projects"> }) {
  const { t } = useI18n();
  const commit = useCommitEvidence();
  const { busy, run } = useAction();
  const [ev, setEv] = useState<EvidenceDraft>(emptyEvidence("after_photo"));
  return (
    <Section title={t("coord.evr.add")}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (evidenceState(ev) !== "ready") return;
          const ok = await run("add", () => commit(ev, { projectId }), t("coord.evr.added.toast"));
          if (ok) setEv(emptyEvidence("after_photo"));
        }}
      >
        <EvidenceAttach id="proj-ev" value={ev} onChange={setEv} allTypes allowNone={false} />
        <Button type="submit" variant="primary" busy={busy === "add"} disabled={evidenceState(ev) !== "ready"}>
          {t("coord.evr.add")}
        </Button>
      </form>
    </Section>
  );
}
