"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import {
  Chip,
  CategoryMark,
  DoubleRule,
  FlagBand,
  STATUS_TONE,
  btn,
  inputCls as kitInputCls,
  type Category,
  type ProjectStatus,
} from "@/components/ui/tricolor";

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
  "water_tank",
  "tools",
  "facilitator",
  "venue",
  "meals",
  "transport",
  "sports_kit",
  "art_supplies",
] as const;

export type { ProjectStatus, Category } from "@/components/ui/tricolor";

/** Programs are told apart by shape (CategoryMark), never colour. Kept for older imports. */
export const CATEGORY_STYLE: Record<Category, { soft: string; solid: string; text: string }> = {
  roof_shelter: { soft: "bg-paper", solid: "bg-foreground", text: "text-foreground" },
  reconstruction: { soft: "bg-paper", solid: "bg-foreground", text: "text-foreground" },
  heal_sow: { soft: "bg-paper", solid: "bg-foreground", text: "text-foreground" },
};

/** Program label with its shape mark, in ink colour. */
export function CategoryLabel({ category, className = "" }: { category: Category; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1.5 text-foreground ${className}`}>
      <CategoryMark category={category} size={11} />
      {t(`category.${category}` as DictKey)}
    </span>
  );
}

export function StatusChip({ status }: { status: ProjectStatus }) {
  const { t } = useI18n();
  return <Chip tone={STATUS_TONE[status]} className="shrink-0 whitespace-nowrap">{t(`field.status.${status}` as DictKey)}</Chip>;
}

export function Sparkle({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="currentColor">
      <path d="M8 0l1.8 4.6L14.4 6.4 9.8 8.2 8 12.8 6.2 8.2 1.6 6.4 6.2 4.6z" />
    </svg>
  );
}

/** Outlined navy chip: this value was drafted by AI. */
export function AiBadge() {
  const { t } = useI18n();
  return (
    <Chip tone="navy" className="shrink-0 whitespace-nowrap font-semibold">
      <Sparkle />
      {t("badge.aiDraft")}
    </Chip>
  );
}

/** Gold chip: the worker must confirm this value. */
export function ConfirmChip() {
  const { t } = useI18n();
  return (
    <Chip tone="gold" className="shrink-0 whitespace-nowrap">
      {t("ledger.needsConfirmation")}
    </Chip>
  );
}

export function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75}>
      <rect x="4.5" y="10" width="15" height="11" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" strokeLinecap="square" />
    </svg>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`${className} animate-spin motion-reduce:animate-none`} fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2.5} />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" />
    </svg>
  );
}

/** Hairline sheet with square corners. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[2px] border border-border bg-surface p-4 sm:p-6 ${className}`}>{children}</section>;
}

/** Section heading inside a card: Bodoni, regular weight. */
export const sectionTitle = "font-display text-xl font-normal leading-tight text-foreground";
/** Small form label. */
export const fieldLabel = "text-sm font-semibold text-foreground";

/** Calm gold notice (pending / needs attention). Not an error. */
export const noticeCls = "border-l-2 border-gold bg-gold-soft px-4 py-3 text-[15px] text-gold-ink";

/** Field inputs: kit input, ≥16px text, ≥48px tall for outdoor use. */
export const inputCls = `${kitInputCls} min-h-12 font-normal`;
export const btnPrimary = btn("primary", "lg", "min-h-12");
export const btnSecondary = btn("secondary", "lg", "min-h-12");
/** Square segmented option (aria-pressed). */
export function segCls(active: boolean) {
  return `min-h-12 px-3 text-base font-semibold transition-colors ${
    active ? "bg-navy text-on-navy" : "bg-surface text-foreground hover:bg-paper"
  }`;
}

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
      <section className="mx-auto mt-10 max-w-md border border-border bg-surface text-center">
        <FlagBand />
        <div className="px-6 pb-8 pt-7">
          <LockIcon className="mx-auto h-7 w-7 text-foreground" />
          <h1 className="mt-4 font-display text-[28px] font-normal leading-tight">{t("field.gate.title")}</h1>
          <DoubleRule className="mx-auto mt-4 w-16" />
          <p className="mt-4 text-[15px] text-muted">{t("field.gate.body")}</p>
          <button className={`${btnPrimary} mt-6 w-full`} onClick={() => void signInAs("field_worker")}>
            {t("field.gate.button")}
          </button>
        </div>
      </section>
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
