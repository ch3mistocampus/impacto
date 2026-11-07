"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PhotoSuggestion } from "../../../convex/field";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { useSession } from "@/lib/session";
import { Chip, btn } from "@/components/ui/tricolor";
import { AiBadge, Spinner, btnSecondary, noticeCls } from "./ui";

type Photo = { _id: Id<"photos">; url: string | null };
export type SuggestedMaterial = PhotoSuggestion["materials"][number];

/**
 * Opt-in, per-photo AI analysis. NEVER automatic: each photo needs its own ticked confirmation
 * ("no people / faces / house numbers / names") and a button press. Suggestions are shown as
 * AI-labelled rows the worker accepts (merged into the review) or discards.
 */
export function PhotoAnalysis({
  photos,
  suggestions,
  disabled,
  onAcceptMaterial,
  onAcceptObservations,
}: {
  photos: Photo[];
  suggestions: PhotoSuggestion[];
  disabled?: boolean;
  onAcceptMaterial: (m: SuggestedMaterial) => Promise<void>;
  onAcceptObservations: (es: string[], en: string[]) => void;
}) {
  const { t } = useI18n();
  if (photos.length === 0) return null;
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="font-display text-lg font-normal">{t("field.photoAi.title")}</h3>
      <p role="note" className={`mt-2 ${noticeCls}`}>
        {t("field.photoAi.warning")}
      </p>
      <ul className="mt-3 space-y-3">
        {photos.map((p) => (
          <PhotoRow
            key={p._id}
            photo={p}
            suggestion={suggestions.find((s) => s.photoId === p._id)}
            disabled={disabled}
            onAcceptMaterial={onAcceptMaterial}
            onAcceptObservations={onAcceptObservations}
          />
        ))}
      </ul>
    </div>
  );
}

function PhotoRow({
  photo,
  suggestion,
  disabled,
  onAcceptMaterial,
  onAcceptObservations,
}: {
  photo: Photo;
  suggestion?: PhotoSuggestion;
  disabled?: boolean;
  onAcceptMaterial: (m: SuggestedMaterial) => Promise<void>;
  onAcceptObservations: (es: string[], en: string[]) => void;
}) {
  const { t, pick } = useI18n();
  const { sessionToken } = useSession();
  const analyze = useAction(api.ai.analyzePhoto);
  const resolve = useMutation(api.field.resolvePhotoSuggestion);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<number | "obs" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!sessionToken || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await analyze({ sessionToken, photoId: photo._id, confirmedNoPeople: confirmed });
      if (r.status === "error") setError(r.reason ?? "failed");
      setConfirmed(false); // re-confirm for every new analysis
    } catch (e) {
      console.error(e);
      setError("failed");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (target: number | "obs", status: "accepted" | "discarded") => {
    if (!sessionToken || !suggestion) return;
    setRowBusy(target);
    try {
      if (status === "accepted") {
        if (target === "obs") onAcceptObservations(suggestion.observationsEs, suggestion.observationsEn);
        else await onAcceptMaterial(suggestion.materials[target]);
      }
      await resolve({
        sessionToken,
        photoId: photo._id,
        status,
        ...(target === "obs" ? { observations: true } : { materialIndex: target }),
      });
    } catch (e) {
      console.error(e);
      setError("failed");
    } finally {
      setRowBusy(null);
    }
  };

  const errKey = error
    ? (`field.photoAi.error.${["timeout", "no_api_key", "not_confirmed", "photo_missing"].includes(error) ? error : "failed"}` as DictKey)
    : null;

  return (
    <li className="border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="h-20 w-20 shrink-0 object-cover" />
        ) : (
          <div className="h-20 w-20 shrink-0 bg-paper" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <label className="flex min-h-11 cursor-pointer items-start gap-2 text-[15px]">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || disabled}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-navy"
            />
            <span>{t("field.photoAi.confirm")}</span>
          </label>
          <button
            type="button"
            disabled={!confirmed || busy || disabled || !sessionToken}
            onClick={() => void run()}
            className={`${btnSecondary} w-full sm:w-auto`}
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {t(busy ? "field.photoAi.analyzing" : suggestion ? "field.photoAi.again" : "field.photoAi.button")}
          </button>
          {errKey && (
            <p role="alert" className="border-l-2 border-red bg-red-soft px-3 py-2 text-sm font-medium text-red">
              {t(errKey)}
            </p>
          )}
        </div>
      </div>

      {suggestion && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
            <AiBadge /> {t("field.photoAi.suggested")} <span className="font-normal text-muted">· {suggestion.model}</span>
          </p>
          {suggestion.privacyConcern && (
            <p role="alert" className="border-l-2 border-red bg-red-soft px-3 py-2 text-sm font-medium text-red">
              {t("field.photoAi.privacyConcern")}
            </p>
          )}

          {suggestion.observationsEs.length + suggestion.observationsEn.length > 0 && (
            <div className="border-l-2 border-rule bg-paper px-3 py-2">
              <p className="text-sm font-semibold text-muted">{t("field.photoAi.observations")}</p>
              <ul className="mt-1 list-disc pl-5 text-[15px]">
                {(pick(suggestion.observationsEs.join("\n"), suggestion.observationsEn.join("\n")) || "")
                  .split("\n")
                  .filter(Boolean)
                  .map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
              </ul>
              <Decision
                status={suggestion.observationsStatus}
                busy={rowBusy === "obs"}
                acceptLabel={t("field.photoAi.addToDamage")}
                onDecide={(s) => void decide("obs", s)}
              />
            </div>
          )}

          {suggestion.materials.length === 0 ? (
            <p className="text-sm text-muted">{t("field.photoAi.none")}</p>
          ) : (
            suggestion.materials.map((m, i) => (
              <div key={i} className="border-l-2 border-rule bg-paper px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{pick(m.nameEs, m.nameEn)}</span>
                  <span className="text-sm text-muted">
                    · {m.quantity !== null ? `${m.quantity} ${m.unit}` : t("ledger.needsConfirmation")}
                  </span>
                  <Chip tone="neutral">{t(`field.photoAi.confidence.${m.confidence}` as DictKey)}</Chip>
                </div>
                {pick(m.reasonEs, m.reasonEn) && <p className="mt-0.5 text-sm italic text-muted">{pick(m.reasonEs, m.reasonEn)}</p>}
                <Decision
                  status={m.status}
                  busy={rowBusy === i}
                  acceptLabel={t("field.photoAi.accept")}
                  onDecide={(s) => void decide(i, s)}
                />
              </div>
            ))
          )}
        </div>
      )}
    </li>
  );
}

function Decision({
  status,
  busy,
  acceptLabel,
  onDecide,
}: {
  status: "pending" | "accepted" | "discarded";
  busy: boolean;
  acceptLabel: string;
  onDecide: (s: "accepted" | "discarded") => void;
}) {
  const { t } = useI18n();
  if (status !== "pending")
    return (
      <p className={`mt-1 text-sm font-semibold ${status === "accepted" ? "text-foreground" : "text-muted line-through"}`}>
        {t(status === "accepted" ? "field.photoAi.accepted" : "field.photoAi.discarded")}
      </p>
    );
  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => onDecide("accepted")}
        className={btn("primary", "md", "min-h-12 flex-1")}
      >
        {busy ? <Spinner className="mx-auto h-4 w-4" /> : `✓ ${acceptLabel}`}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDecide("discarded")}
        className={btn("secondary", "md", "min-h-12 flex-1")}
      >
        ✕ {t("field.photoAi.discard")}
      </button>
    </div>
  );
}
