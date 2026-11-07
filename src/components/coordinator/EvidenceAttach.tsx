"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { dict, type DictKey } from "@/lib/dict";
import { Label, inputCls } from "./ui";
import { EVIDENCE_ACCEPT, EVIDENCE_TYPES, uploadEvidenceFile, type EvidenceType } from "./upload";

export type EvidenceDraft = {
  type: EvidenceType | "";
  file: File | null;
  noteEs: string;
  noteEn: string;
};

/** Clearly-labeled synthetic staff note for the demo (proof of delivery / verification). */
export function syntheticEvidence(kind: "delivered" | "verified"): EvidenceDraft {
  const k = kind === "delivered" ? "coord.ev.syntheticEs" : "coord.ev.syntheticVerifyEs";
  // Both languages regardless of UI locale.
  return { type: "staff_note", file: null, noteEs: dict[k].es, noteEn: dict[k].en };
}

export const emptyEvidence = (type: EvidenceType | "" = ""): EvidenceDraft => ({ type, file: null, noteEs: "", noteEn: "" });

/** A draft is attachable if a type is chosen and there's a file or a note. */
export function evidenceState(d: EvidenceDraft): "none" | "ready" | "incomplete" {
  if (!d.type) return "none";
  return d.file || d.noteEs.trim() || d.noteEn.trim() ? "ready" : "incomplete";
}

/** Returns a function that uploads (if any) and creates the evidence row; resolves to its id, or undefined if no evidence. */
export function useCommitEvidence() {
  const { sessionToken } = useSession();
  const genUrl = useMutation(api.coordinator.generateEvidenceUploadUrl);
  const add = useMutation(api.coordinator.addEvidence);
  return useCallback(
    async (
      d: EvidenceDraft,
      target: { projectId: Id<"projects">; needId?: Id<"materialNeeds"> },
    ): Promise<Id<"evidence"> | undefined> => {
      if (!sessionToken || evidenceState(d) !== "ready" || !d.type) return undefined;
      const storageId = d.file ? await uploadEvidenceFile(d.file, () => genUrl({ sessionToken })) : undefined;
      return await add({
        sessionToken,
        projectId: target.projectId,
        needId: target.needId,
        type: d.type,
        storageId,
        noteEs: d.noteEs.trim() || undefined,
        noteEn: d.noteEn.trim() || undefined,
      });
    },
    [sessionToken, genUrl, add],
  );
}

export function EvidenceAttach({
  id,
  value,
  onChange,
  syntheticPreset,
  allTypes,
  allowNone = true,
}: {
  id: string;
  value: EvidenceDraft;
  onChange: (d: EvidenceDraft) => void;
  /** Shows a one-click "synthetic handover (demo)" preset. */
  syntheticPreset?: "delivered" | "verified";
  /** Include before/after photo types (project-level evidence). */
  allTypes?: boolean;
  allowNone?: boolean;
}) {
  const { t } = useI18n();
  const set = (patch: Partial<EvidenceDraft>) => onChange({ ...value, ...patch });
  const state = evidenceState(value);

  return (
    <fieldset className="rounded-md border border-border bg-surface/70 p-3">
      <legend className="px-1 text-xs font-medium text-muted">{t("coord.ev.attach")}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("coord.ev.type")}>
        {[...(allowNone ? (["" ] as const) : []), ...(allTypes ? EVIDENCE_TYPES : EVIDENCE_TYPES.slice(0, 4))].map((k) => {
          const on = value.type === k;
          return (
            <button
              key={k || "none"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ type: k })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                on ? "bg-foreground text-background ring-foreground" : "bg-surface text-muted ring-border hover:text-foreground"
              }`}
            >
              {k ? t(`coord.ev.type.${k}` as DictKey) : t("coord.ev.none")}
            </button>
          );
        })}
        {syntheticPreset && (
          <button
            type="button"
            onClick={() => onChange({ ...syntheticEvidence(syntheticPreset), file: value.file })}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-sky ring-1 ring-sky/40 hover:bg-sky-soft"
          >
            {t(syntheticPreset === "delivered" ? "coord.ev.synthetic" : "coord.ev.syntheticVerify")}
          </button>
        )}
      </div>

      {value.type && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {value.type !== "staff_note" && (
            <div className="sm:col-span-2">
              <Label htmlFor={`${id}-file`}>{t("coord.ev.file")}</Label>
              <input
                id={`${id}-file`}
                type="file"
                accept={EVIDENCE_ACCEPT}
                onChange={(e) => set({ file: e.target.files?.[0] ?? null })}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground file:ring-1 file:ring-border"
              />
              <p className="mt-1 text-xs text-muted">{t("coord.ev.fileHint")}</p>
            </div>
          )}
          <div>
            <Label htmlFor={`${id}-es`}>{t("coord.ev.noteEs")}</Label>
            <input id={`${id}-es`} lang="es" value={value.noteEs} onChange={(e) => set({ noteEs: e.target.value })} className={inputCls} />
          </div>
          <div>
            <Label htmlFor={`${id}-en`}>{t("coord.ev.noteEn")}</Label>
            <input id={`${id}-en`} lang="en" value={value.noteEn} onChange={(e) => set({ noteEn: e.target.value })} className={inputCls} />
          </div>
          {state === "incomplete" && <p className="text-xs text-amber sm:col-span-2">{t("coord.ev.needNoteOrFile")}</p>}
        </div>
      )}
    </fieldset>
  );
}
