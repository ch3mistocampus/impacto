"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ConvexError } from "convex/values";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import {
  CategoryMark,
  STATUS_TONE,
  btn,
  inputCls as kitInputCls,
  intlLocale,
  labelCls,
  type BtnVariant as KitVariant,
  type Category,
  type ChipTone as KitTone,
  type ProjectStatus,
} from "@/components/ui/tricolor";

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type Toast = { id: number; kind: "ok" | "error"; title: string; detail?: string };
type ToastCtx = { push: (t: Omit<Toast, "id">) => void };
const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.kind === "error" ? 7000 : 4200);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`coord-toast pointer-events-auto w-full max-w-sm rounded-[2px] border border-l-[3px] border-border bg-surface px-4 py-3 shadow-[0_10px_30px_-18px_rgba(11,42,91,0.45)] ${
              t.kind === "ok" ? "border-l-emerald" : "border-l-red"
            }`}
          >
            <p className={`text-[15px] font-semibold ${t.kind === "ok" ? "text-foreground" : "text-red"}`}>{t.title}</p>
            {t.detail && <p className="mt-0.5 text-[13px] text-muted">{t.detail}</p>}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes coord-toast-in { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }
        .coord-toast { animation: coord-toast-in 180ms ease-out }
        @media (prefers-reduced-motion: reduce) { .coord-toast { animation: none } }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return c.push;
}

function errorCode(e: unknown): string | null {
  if (e instanceof ConvexError) {
    const d = e.data as unknown;
    if (typeof d === "string") return d;
    if (d && typeof d === "object") return String((d as Record<string, unknown>).code ?? "");
  }
  return null;
}

function errorText(e: unknown, t: (k: DictKey) => string): string {
  const code = errorCode(e);
  if (code) {
    const key = `coord.err.${code}` as DictKey;
    const msg = t(key);
    if (msg !== key) {
      const avail = e instanceof ConvexError ? (e.data as { available?: number })?.available : undefined;
      return avail !== undefined ? `${msg} (${avail})` : msg;
    }
    return code;
  }
  if (e instanceof Error) return e.message.replace(/^[\s\S]*Uncaught (ConvexError|Error): /, "").split("\n")[0];
  return String(e);
}

/** Wraps a mutation call: busy state + success / error toast. */
export function useAction() {
  const push = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, okTitle: string, okDetail?: string) => {
      setBusy(key);
      try {
        await fn();
        push({ kind: "ok", title: okTitle, detail: okDetail });
        return true;
      } catch (e) {
        push({ kind: "error", title: t("coord.error"), detail: errorText(e, t) });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [push, t],
  );
  return { busy, run };
}

/* ------------------------------------------------------------------ */
/* Primitives (Tricolor kit, with the desk's legacy variant names)     */
/* ------------------------------------------------------------------ */

/** Legacy desk names map onto the kit: leaf → verify (esmeralda), ghost → secondary. */
type BtnVariant = "primary" | "leaf" | "ghost" | "danger" | "quiet" | "secondary" | "verify";
const VARIANT: Record<BtnVariant, KitVariant> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "secondary",
  leaf: "verify",
  verify: "verify",
  danger: "danger",
  quiet: "quiet",
};

/** Kit button class, with the verify fill's text following the theme (dark mode lightens the fill). */
export function deskBtn(variant: BtnVariant = "ghost", size: "sm" | "md" | "lg" = "md", extra = "") {
  const v = VARIANT[variant];
  const cls = btn(v, size, extra);
  return v === "verify" ? cls.replace("text-white", "text-on-navy") : cls;
}

export function Button({
  variant = "ghost",
  size = "md",
  busy,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={deskBtn(variant, size, className)}
    >
      {busy && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={labelCls}>
      {children}
    </label>
  );
}

export const inputCls = kitInputCls;

/** Legacy tone names are accepted and mapped: amber→gold, leaf→emerald, sky/clay→navy, brick→red. */
type ChipTone = KitTone | "amber" | "leaf" | "sky" | "brick" | "clay";
const TONE: Record<ChipTone, KitTone> = {
  neutral: "neutral",
  navy: "navy",
  gold: "gold",
  emerald: "emerald",
  red: "red",
  amber: "gold",
  leaf: "emerald",
  sky: "navy",
  brick: "red",
  clay: "navy",
};
const CHIP: Record<KitTone, string> = {
  neutral: "text-muted shadow-[inset_0_0_0_1px_var(--border)]",
  navy: "text-foreground shadow-[inset_0_0_0_1px_var(--rule)]",
  gold: "bg-gold-soft text-gold-ink shadow-[inset_0_0_0_1px_var(--gold)]",
  emerald: "bg-emerald-soft text-emerald shadow-[inset_0_0_0_1px_var(--emerald)]",
  red: "bg-red-soft text-red shadow-[inset_0_0_0_1px_var(--red)]",
};
export function Chip({ tone = "neutral", children, className = "" }: { tone?: ChipTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] px-2 py-0.5 text-xs font-semibold ${CHIP[TONE[tone]]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Program label: shape + name, in ink. Programs are never colour-coded. */
export function CategoryTag({ category, className = "" }: { category: string; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] text-foreground ${className}`}>
      <CategoryMark category={category as Category} size={10} />
      {t(`category.${category}` as DictKey)}
    </span>
  );
}

/** Esmeralda rosette: the audit mark. */
export function VerifyMark({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`${className} shrink-0 text-emerald`}>
      <path
        fill="currentColor"
        d="M8 0l2 2.2 2.9-.5.5 2.9L16 6l-1.3 2.6L16 11l-2.6 1.4-.5 2.9-2.9-.5L8 16l-2-2.2-2.9.5-.5-2.9L0 10l1.3-2.6L0 5l2.6-1.4.5-2.9 2.9.5z"
      />
      <path d="M6.8 10.6L4.6 8.4l1-1 1.2 1.2 3.6-3.6 1 1z" fill="var(--surface)" />
    </svg>
  );
}

/** The audit mark: who verified, and when. */
export function VerifiedBy({ name, at, text }: { name?: string | null; at?: number | null; text?: string }) {
  const { t, locale } = useI18n();
  if (!name && !text) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
      <VerifyMark />
      <span>
        {text ?? (
          <>
            {t("coord.verifiedBy")} <strong className="font-semibold">{name}</strong>
          </>
        )}
        {at ? <span className="text-muted"> · {formatDate(at, locale)}</span> : ""}
      </span>
    </span>
  );
}

export function formatDate(ms: number, locale: string) {
  return new Date(ms).toLocaleString(intlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Section({
  title,
  aside,
  children,
  className = "",
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[2px] border border-border bg-surface ${className}`}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="font-display text-[22px] font-normal leading-tight">{title}</h2>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Programs are told apart by shape (CategoryTag), never by colour. Kept for call-site compatibility. */
export function categoryTone(c: string): ChipTone {
  void c;
  return "neutral";
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border border-y border-border" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <div className="h-3 w-24 animate-pulse bg-paper" />
          <div className="h-4 flex-1 animate-pulse bg-paper" />
        </div>
      ))}
    </div>
  );
}

/** UI label tone for a DB project status (labels live in coord.status.*). Paused is calm navy, never alarming. */
export function statusTone(s: string): ChipTone {
  return STATUS_TONE[s as ProjectStatus] ?? "neutral";
}

/** Quiet "Demo data" stamp for screens showing the synthetic scenario. */
export function DemoLabel({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span title={t("coord.demoData.note")} className={`inline-flex items-center gap-1.5 font-display text-sm italic text-muted ${className}`}>
      <span aria-hidden className="inline-block size-1.5 rotate-45 border border-current" />
      {t("coord.demoData")}
    </span>
  );
}

/** The standing rule, shown wherever AI output is on screen. */
export function AiNever({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={`border-l border-rule py-0.5 pl-3 text-[13px] leading-relaxed text-muted ${className}`}>
      {t("coord.aiNever")}
    </p>
  );
}

/** Ledger row: label …… figure (dotted leader). */
export function Leader({
  label,
  value,
  className = "",
  valueClass = "",
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 py-1 ${className}`}>
      <dt className="shrink-0 text-sm">{label}</dt>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-muted/60" />
      <dd className={`font-display text-lg tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}

/** Ruled tab row (navy underline on the active tab). Arrow keys move between tabs. */
export function TabRow<K extends string>({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
  panelPrefix,
  render,
}: {
  tabs: readonly K[];
  active: K;
  onChange: (k: K) => void;
  label: string;
  idPrefix: string;
  panelPrefix: string;
  render: (k: K, active: boolean) => ReactNode;
}) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabs.indexOf(active);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next);
    document.getElementById(`${idPrefix}${next}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {tabs.map((k) => {
        const on = active === k;
        return (
          <button
            key={k}
            id={`${idPrefix}${k}`}
            role="tab"
            aria-selected={on}
            aria-controls={`${panelPrefix}${k}`}
            tabIndex={on ? 0 : -1}
            onKeyDown={onKey}
            onClick={() => onChange(k)}
            className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[15px] transition-colors sm:px-4 ${
              on ? "border-navy font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {render(k, on)}
          </button>
        );
      })}
    </div>
  );
}

/** Small outlined numeral for a tab count. */
export function CountBadge({ n, active }: { n: number; active?: boolean }) {
  return (
    <span
      className={`inline-grid min-w-6 place-items-center rounded-[2px] px-1 font-display text-[13px] leading-5 tabular-nums ${
        active ? "text-foreground shadow-[inset_0_0_0_1px_var(--rule)]" : "text-muted shadow-[inset_0_0_0_1px_var(--border)]"
      }`}
    >
      {n}
    </span>
  );
}

/** Small italic Bodoni caption above figures and transcripts. */
export function Caption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-1.5 font-display text-[15px] italic text-muted ${className}`}>{children}</p>;
}
