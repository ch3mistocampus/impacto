"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { ConvexError } from "convex/values";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";

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
            className={`coord-toast pointer-events-auto w-full max-w-sm rounded-lg border-l-4 bg-surface px-4 py-3 shadow-lg ring-1 ring-border ${
              t.kind === "ok" ? "border-leaf" : "border-brick"
            }`}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.detail && <p className="mt-0.5 text-xs text-muted">{t.detail}</p>}
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
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

type BtnVariant = "primary" | "leaf" | "ghost" | "danger" | "quiet";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-clay text-white hover:brightness-110",
  leaf: "bg-leaf text-white hover:brightness-110",
  danger: "bg-surface text-brick ring-1 ring-brick/40 hover:bg-brick-soft",
  ghost: "bg-surface text-foreground ring-1 ring-border hover:bg-background",
  quiet: "text-muted hover:text-foreground underline-offset-4 hover:underline",
};

export function Button({
  variant = "ghost",
  size = "md",
  busy,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; busy?: boolean }) {
  const sz = size === "sm" ? "px-3 py-1.5 text-sm" : size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm";
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${BTN[variant]} ${className}`}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">
      {children}
    </label>
  );
}

export const inputCls =
  "w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-sky";

type ChipTone = "neutral" | "amber" | "leaf" | "sky" | "brick" | "clay";
const CHIP: Record<ChipTone, string> = {
  neutral: "bg-background text-muted ring-1 ring-border",
  amber: "bg-amber-soft text-amber",
  leaf: "bg-leaf-soft text-leaf",
  sky: "bg-sky-soft text-sky",
  brick: "bg-brick-soft text-brick",
  clay: "bg-clay-soft text-clay",
};
export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[tone]}`}>
      {children}
    </span>
  );
}

/** The audit mark: who verified, and when. */
export function VerifiedBy({ name, at, text }: { name?: string | null; at?: number | null; text?: string }) {
  const { t, locale } = useI18n();
  if (!name && !text) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-sky">
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
        <path d="M8 0l2 2.2 2.9-.5.5 2.9L16 6l-1.3 2.6L16 11l-2.6 1.4-.5 2.9-2.9-.5L8 16l-2-2.2-2.9.5-.5-2.9L0 10l1.3-2.6L0 5l2.6-1.4.5-2.9 2.9.5z" />
        <path d="M6.8 10.6L4.6 8.4l1-1 1.2 1.2 3.6-3.6 1 1z" fill="var(--surface)" />
      </svg>
      <span>
        {text ?? (
          <>
            {t("coord.verifiedBy")} <strong className="font-semibold">{name}</strong>
          </>
        )}
        {at ? ` · ${formatDate(at, locale)}` : ""}
      </span>
    </span>
  );
}

export function formatDate(ms: number, locale: string) {
  return new Date(ms).toLocaleString(locale === "es" ? "es-PR" : "en-US", {
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
    <section className={`rounded-lg border border-border bg-surface ${className}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function categoryTone(c: string): ChipTone {
  return c === "roof_shelter" ? "clay" : c === "reconstruction" ? "brick" : "leaf";
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-border/50" />
      ))}
    </div>
  );
}
