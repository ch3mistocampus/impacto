"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { btn } from "@/components/ui/tricolor";
import { noticeCls } from "./ui";

const MAX_SECONDS = 180;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export type MicIssue = "denied" | "unsupported";

/**
 * Voice capture. If the mic is denied or MediaRecorder is unsupported, calls `onUnavailable`
 * so the parent can switch to typed input (and shows a friendly message itself as a fallback).
 */
export function AudioRecorder({
  onChange,
  onUnavailable,
}: {
  onChange: (blob: Blob | null) => void;
  onUnavailable?: (issue: MicIssue) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<MicIssue | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  const start = async () => {
    setError(null);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    onChange(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      onUnavailable?.("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: (rec.mimeType || mime || "audio/webm").split(";")[0] });
        setUrl(URL.createObjectURL(blob));
        setState("done");
        onChange(blob);
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      setState("recording");
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      const issue: MicIssue =
        name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError" || name === "NotReadableError"
          ? "denied"
          : "unsupported";
      setError(issue);
      setState("idle");
      onUnavailable?.(issue);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-3">
      {state === "recording" ? (
        <button
          type="button"
          onClick={stop}
          className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 border-rule bg-surface text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy"
          aria-label={t("field.rec.stop")}
        >
          <span aria-hidden className="absolute -inset-2 rounded-full border border-red/60 animate-ping motion-reduce:animate-none [animation-duration:2s]" />
          <span className="h-7 w-7 bg-red" aria-hidden />
          <span className="mt-2 text-sm font-semibold">{t("field.rec.stop")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-navy text-on-navy shadow-[0_0_0_6px_var(--surface),0_0_0_7px_var(--rule)] transition-colors hover:bg-navy-hover focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-navy"
          aria-label={state === "done" ? t("field.rec.again") : t("field.rec.start")}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" strokeLinecap="round" />
          </svg>
          <span className="mt-1 px-2 text-sm font-semibold leading-tight">{state === "done" ? t("field.rec.again") : t("field.rec.start")}</span>
        </button>
      )}

      <div className="min-h-10 text-center" aria-live="polite">
        {state === "recording" && (
          <p className="font-display text-3xl tabular-nums text-foreground">
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red align-middle" aria-hidden />
            {fmt(seconds)} <span className="sr-only">{t("field.rec.recording")}</span>
          </p>
        )}
        {state === "done" && (
          <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-emerald" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12l5 5L19 7" strokeLinecap="square" />
            </svg>
            {t("field.rec.ready")} · <span className="tabular-nums">{fmt(seconds)}</span>
          </p>
        )}
        {state === "idle" && <p className="max-w-xs text-[15px] leading-relaxed text-muted">{t("field.rec.hint")}</p>}
      </div>

      {url && state === "done" && (
        <div className="flex w-full flex-col items-center gap-2">
          <audio controls src={url} className="w-full max-w-sm" />
          <button
            type="button"
            className={btn("quiet", "md", "min-h-11 text-[15px]")}
            onClick={() => {
              URL.revokeObjectURL(url);
              setUrl(null);
              setState("idle");
              onChange(null);
            }}
          >
            {t("common.cancel")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className={noticeCls}>
          {t(error === "denied" ? "field.mic.denied" : "field.mic.unsupported")}
        </p>
      )}
    </div>
  );
}
