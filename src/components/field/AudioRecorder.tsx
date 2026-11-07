"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { btnSecondary } from "./ui";

const MAX_SECONDS = 180;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function AudioRecorder({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  const start = async () => {
    setError(false);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    onChange(null);
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
    } catch {
      setError(true);
      setState("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {state === "recording" ? (
        <button
          type="button"
          onClick={stop}
          className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-brick text-white shadow-lg ring-8 ring-brick-soft animate-pulse"
          aria-label={t("field.rec.stop")}
        >
          <span className="h-8 w-8 rounded-md bg-white" aria-hidden />
          <span className="mt-2 text-sm font-semibold">{t("field.rec.stop")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-clay text-white shadow-lg ring-8 ring-clay-soft"
          aria-label={state === "done" ? t("field.rec.again") : t("field.rec.start")}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
            <path d="M12 15a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v7a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12h-2z" />
          </svg>
          <span className="mt-1 text-sm font-semibold">{state === "done" ? t("field.rec.again") : t("field.rec.start")}</span>
        </button>
      )}

      <div className="text-center" aria-live="polite">
        {state === "recording" && (
          <p className="font-mono text-2xl tabular-nums text-brick">
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-brick align-middle" aria-hidden />
            {fmt(seconds)} <span className="sr-only">{t("field.rec.recording")}</span>
          </p>
        )}
        {state === "done" && <p className="text-sm font-semibold text-leaf">{t("field.rec.ready")} · {fmt(seconds)}</p>}
        {state === "idle" && <p className="max-w-xs text-sm text-muted">{t("field.rec.hint")}</p>}
      </div>

      {url && state === "done" && (
        <div className="flex w-full flex-col items-center gap-2">
          <audio controls src={url} className="w-full max-w-sm" />
          <button
            type="button"
            className={`${btnSecondary} text-sm`}
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
      {error && <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber">{t("field.rec.denied")}</p>}
    </div>
  );
}
