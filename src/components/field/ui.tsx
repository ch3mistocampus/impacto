"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";

// Keep in sync with DEMO_TRANSCRIPT_ES/EN in convex/ai.ts
export const DEMO_TRANSCRIPT = {
  es: "Estamos ayudando a una familia cuya casa sufrió daños. Necesitamos aproximadamente 200 ladrillos, 15 bolsas de cemento y materiales para reparar el techo.",
  en: "We are helping a family whose house was damaged. We need about 200 bricks, 15 bags of cement and materials to fix the roof.",
} as const;

export const ITEM_KEYS = [
  "bricks",
  "cement_bag",
  "zinc_sheet",
  "wood_beam",
  "nails",
  "tarp",
  "paint",
  "rebar",
  "seeds",
  "soil",
  "water_tank",
  "tools",
] as const;

export type ProjectStatus = "draft" | "in_review" | "published" | "paused" | "completed" | "rejected";
export type Category = "roof_shelter" | "reconstruction" | "heal_sow";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  draft: "bg-amber-soft text-amber",
  in_review: "bg-sky-soft text-sky",
  published: "bg-leaf-soft text-leaf",
  paused: "bg-clay-soft text-clay",
  completed: "bg-leaf-soft text-leaf",
  rejected: "bg-brick-soft text-brick",
};

export const CATEGORY_STYLE: Record<Category, { soft: string; solid: string; text: string }> = {
  roof_shelter: { soft: "bg-clay-soft", solid: "bg-clay", text: "text-clay" },
  reconstruction: { soft: "bg-brick-soft", solid: "bg-brick", text: "text-brick" },
  heal_sow: { soft: "bg-leaf-soft", solid: "bg-leaf", text: "text-leaf" },
};

export function StatusChip({ status }: { status: ProjectStatus }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {t(`field.status.${status}` as DictKey)}
    </span>
  );
}

export function AiBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-2 py-0.5 text-[11px] font-semibold text-sky">
      <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
        <path d="M8 0l1.8 4.6L14.4 6.4 9.8 8.2 8 12.8 6.2 8.2 1.6 6.4 6.2 4.6z" />
      </svg>
      {t("badge.aiDraft")}
    </span>
  );
}

export function ConfirmChip() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber">
      {t("ledger.needsConfirmation")}
    </span>
  );
}

export function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`${className} animate-spin`} fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={4} />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}

export const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:border-sky";
export const btnPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-clay px-5 py-3 text-base font-semibold text-white disabled:opacity-50";
export const btnSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-base font-medium disabled:opacity-50";

/** Renders children only for a signed-in field worker; otherwise a sign-in prompt. */
export function FieldGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, signInAs } = useSession();
  if (user === undefined)
    return (
      <div className="flex items-center gap-2 py-16 text-muted">
        <Spinner /> {t("common.loading")}
      </div>
    );
  if (!user || user.role !== "field_worker")
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clay-soft text-clay">
          <LockIcon />
        </div>
        <h1 className="font-display text-2xl font-semibold">{t("field.gate.title")}</h1>
        <p className="mt-2 text-muted">{t("field.gate.body")}</p>
        <button className={`${btnPrimary} mt-5 w-full`} onClick={() => void signInAs("field_worker")}>
          {t("field.gate.button")}
        </button>
      </Card>
    );
  return <>{children}</>;
}

export async function uploadFile(uploadUrl: string, file: Blob): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}`);
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}
