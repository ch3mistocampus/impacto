/**
 * Tricolor UI kit — the shared primitives every lane uses. See globals.css for the tokens.
 *
 * Rules of the system
 * - White paper, navy ink. Bodoni (font-display) for headlines and large figures; Karla for text.
 * - Flag colours only as <FlagBand/> (2:1:1). Never as large fills.
 * - Colour encodes LEDGER STAGE only. Programs are told apart by <CategoryMark/> shape.
 * - Corners are square (rounded-none / rounded-[2px]); hairline borders; double rules for emphasis.
 * - Sentence case everywhere. No all-caps labels, no tracked-out eyebrows, no "→" on buttons.
 * - Numbers: font-display + tabular-nums for figures in tables; large figures in Bodoni.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Category = "roof_shelter" | "reconstruction" | "heal_sow";
export type Stage = "requested" | "pledged" | "received" | "delivered" | "used" | "verified";

/* ------------------------------------------------------------------ */
/* Flag band and rules                                                 */
/* ------------------------------------------------------------------ */

/** The Colombian flag in its 2:1:1 proportion, as a hairline band. Top of a page, card or report. */
export function FlagBand({ className = "", thickness = 4 }: { className?: string; thickness?: number }) {
  return (
    <div
      aria-hidden
      className={`w-full ${className}`}
      style={{
        height: thickness,
        background: "linear-gradient(90deg, var(--gold) 0 50%, var(--flag-blue) 50% 75%, var(--red) 75%)",
      }}
    />
  );
}

/** Certificate-style double rule. */
export function DoubleRule({ className = "" }: { className?: string }) {
  return <hr aria-hidden className={`h-[5px] border-0 border-y border-rule ${className}`} />;
}

/** Italic Bodoni caption that sits above a headline (instead of an all-caps eyebrow). */
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-display italic text-lg text-muted ${className}`}>{children}</p>;
}

/** Round seal with a gold inner ring. Used for "verified by Espejo de Agua" moments. */
export function Seal({
  children,
  size = 72,
  className = "",
  title,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-grid place-items-center rounded-full border border-rule text-center font-display italic leading-tight text-foreground ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size / 6),
        boxShadow: "inset 0 0 0 4px var(--surface), inset 0 0 0 5px var(--gold)",
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Programs: told apart by shape, never by colour                      */
/* ------------------------------------------------------------------ */

/** Techo y abrigo = triangle (a roof), Reconstrucción = square (a block), Sanar y sembrar = circle (a seed). */
export function CategoryMark({
  category,
  size = 12,
  className = "",
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" width={size} height={size} className={`shrink-0 ${className}`} fill="currentColor">
      {category === "roof_shelter" ? (
        <path d="M6 1 11.5 11H.5z" />
      ) : category === "reconstruction" ? (
        <rect x="1" y="1" width="10" height="10" />
      ) : (
        <circle cx="6" cy="6" r="5" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Ledger stage styling (the single source of truth)                   */
/* ------------------------------------------------------------------ */

/** Pledged is hatched gold: a promise, visibly not material yet. */
export const PLEDGED_HATCH = "repeating-linear-gradient(-45deg, var(--gold) 0 2px, var(--gold-soft) 2px 6px)";

/** CSS background for a stage fill (bars, swatches, tiles). */
export function stageFill(stage: Stage): string {
  switch (stage) {
    case "requested":
      return "transparent";
    case "pledged":
      return PLEDGED_HATCH;
    case "received":
      return "var(--stage-received)";
    case "delivered":
      return "var(--stage-delivered)";
    case "used":
      return "var(--stage-used)";
    case "verified":
      return "var(--stage-verified)";
  }
}

/** Text colour class for a stage figure. */
export const STAGE_TEXT: Record<Stage, string> = {
  requested: "text-foreground",
  pledged: "text-gold-ink",
  received: "text-foreground",
  delivered: "text-foreground",
  used: "text-foreground",
  verified: "text-emerald",
};

/** Small square swatch for legends. Requested = outline; pledged = hatched. */
export function StageSwatch({ stage, size = 10, className = "" }: { stage: Stage; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: stageFill(stage),
        boxShadow:
          stage === "requested"
            ? "inset 0 0 0 1px var(--foreground)"
            : stage === "pledged"
              ? "inset 0 0 0 1px var(--gold)"
              : undefined,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type BtnVariant = "primary" | "secondary" | "quiet" | "danger" | "verify";
export type BtnSize = "sm" | "md" | "lg";

const BTN_BASE =
  "press inline-flex items-center justify-center gap-2 rounded-[2px] font-sans font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "bg-navy text-on-navy hover:bg-navy-hover",
  secondary: "bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--rule)] hover:bg-paper",
  quiet: "text-foreground underline decoration-1 underline-offset-[5px] hover:decoration-2",
  danger: "bg-surface text-red shadow-[inset_0_0_0_1px_var(--red)] hover:bg-red-soft",
  verify: "bg-emerald text-on-emerald hover:brightness-110",
};
const BTN_SIZE: Record<BtnSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-14 px-7 text-base",
};

/** Class string for a button-styled element (works on <Link> and <a> too). */
export function btn(variant: BtnVariant = "primary", size: BtnSize = "md", extra = "") {
  const pad = variant === "quiet" ? "" : BTN_SIZE[size];
  return `${BTN_BASE} ${BTN_VARIANT[variant]} ${pad} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  busy,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={btn(variant, size, className)}
    >
      {busy && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Chips / status                                                      */
/* ------------------------------------------------------------------ */

export type ChipTone = "neutral" | "navy" | "gold" | "emerald" | "red";
const CHIP: Record<ChipTone, string> = {
  neutral: "text-muted shadow-[inset_0_0_0_1px_var(--border)]",
  navy: "text-foreground shadow-[inset_0_0_0_1px_var(--rule)]",
  gold: "bg-gold-soft text-gold-ink shadow-[inset_0_0_0_1px_var(--gold)]",
  emerald: "bg-emerald-soft text-emerald shadow-[inset_0_0_0_1px_var(--emerald)]",
  red: "bg-red-soft text-red shadow-[inset_0_0_0_1px_var(--red)]",
};

/** Small outlined label. Square corners, sentence case. */
export function Chip({ tone = "neutral", children, className = "" }: { tone?: ChipTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-xs font-semibold ${CHIP[tone]} ${className}`}>
      {children}
    </span>
  );
}

/**
 * The ONE mapping from DB project status to chip tone. Labels stay in each lane's dict.
 * A safety pause is a legitimate, calm state (navy), never red.
 */
export type ProjectStatus = "draft" | "in_review" | "published" | "paused" | "completed" | "rejected";
export const STATUS_TONE: Record<ProjectStatus, ChipTone> = {
  draft: "neutral",
  in_review: "gold",
  published: "navy",
  paused: "navy",
  completed: "emerald",
  rejected: "neutral",
};

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export const inputCls =
  "w-full min-w-0 rounded-[2px] border border-border bg-surface px-3 py-2.5 text-base text-foreground placeholder:text-muted/80 focus:border-rule focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-navy";
export const labelCls = "mb-1.5 block text-sm font-semibold text-foreground";

/* ------------------------------------------------------------------ */
/* Locale                                                              */
/* ------------------------------------------------------------------ */

/** Espejo de Agua is in Quindío, Colombia: format dates and numbers as es-CO. */
export function intlLocale(locale: string) {
  return locale === "es" ? "es-CO" : "en-US";
}
