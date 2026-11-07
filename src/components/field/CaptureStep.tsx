"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n, type Locale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { AudioRecorder, type MicIssue } from "./AudioRecorder";
import { PhotoPicker } from "./PhotoPicker";
import { AnalyzingPanel } from "./AnalyzingPanel";
import { Card, DEMO_TRANSCRIPT, btnPrimary, btnSecondary, inputCls, uploadFile } from "./ui";

type LocalPhoto = { key: string; file: File; url: string };

export function CaptureStep() {
  const { t, locale } = useI18n();
  const { sessionToken } = useSession();
  const router = useRouter();
  const createDraft = useMutation(api.field.createDraft);
  const genUrl = useMutation(api.field.generateUploadUrl);
  const attachAudio = useMutation(api.field.attachAudio);
  const attachPhoto = useMutation(api.field.attachPhoto);
  const analyze = useAction(api.ai.transcribeAndExtract);

  const [language, setLanguage] = useState<Locale>(locale);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micIssue, setMicIssue] = useState<MicIssue | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Mic denied/unsupported → switch to typing and focus the text box.
  useEffect(() => {
    if (micIssue && mode === "text") textRef.current?.focus();
  }, [micIssue, mode]);

  const hasInput = (mode === "voice" && !!audio) || (mode === "text" && text.trim().length > 0);

  const applyDemo = () => {
    setMode("text");
    setLanguage("es");
    setText(DEMO_TRANSCRIPT.es);
  };

  const submit = async () => {
    if (!sessionToken || !hasInput) return;
    setBusy(true);
    setError(null);
    let projectId: Id<"projects"> | null = null;
    try {
      const created = await createDraft({
        sessionToken,
        language,
        transcript: mode === "text" ? text.trim() : undefined,
      });
      projectId = created.projectId;
      if (mode === "voice" && audio) {
        const sid = await uploadFile(await genUrl({ sessionToken }), audio);
        await attachAudio({ sessionToken, reportId: created.reportId, storageId: sid as Id<"_storage"> });
      }
      for (const p of photos) {
        const sid = await uploadFile(await genUrl({ sessionToken }), p.file);
        await attachPhoto({ sessionToken, projectId: created.projectId, storageId: sid as Id<"_storage"> });
      }
      try {
        await analyze({ sessionToken, reportId: created.reportId });
      } catch (e) {
        console.error(e); // review page shows the AI status and text fallback
      }
      router.push(`/field/${created.projectId}`);
    } catch (e) {
      console.error(e);
      if (projectId) router.push(`/field/${projectId}`);
      else {
        setError(t("field.error"));
        setBusy(false);
      }
    }
  };

  if (busy) return <AnalyzingPanel />;

  return (
    <div className="mx-auto max-w-xl space-y-4 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/field" className="text-sm text-muted underline-offset-4 hover:underline">
          ← {t("common.back")}
        </Link>
      </div>
      <h1 className="font-display text-3xl font-semibold">{t("field.new")}</h1>

      <Card>
        <h2 className="font-display text-xl font-semibold">{t("field.step1")}</h2>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-muted">{t("field.language")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={language === l}
                onClick={() => setLanguage(l)}
                className={`min-h-12 rounded-xl border text-base font-semibold ${
                  language === l ? "border-clay bg-clay-soft text-clay" : "border-border bg-surface"
                }`}
              >
                {l === "es" ? "Español" : "English"}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-background p-1" role="tablist">
          {(["voice", "text"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 rounded-lg text-sm font-semibold ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {t(m === "voice" ? "field.mode.voice" : "field.mode.text")}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {mode === "voice" ? (
            <AudioRecorder
              onChange={setAudio}
              onUnavailable={(issue) => {
                setMicIssue(issue);
                setMode("text");
              }}
            />
          ) : (
            <>
              {micIssue && (
                <p role="alert" className="mb-2 rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber">
                  {t(micIssue === "denied" ? "field.mic.denied" : "field.mic.unsupported")}
                </p>
              )}
              <textarea
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                lang={language}
                placeholder={t("field.text.placeholder")}
                className={inputCls}
              />
            </>
          )}
        </div>

        <button type="button" onClick={applyDemo} className={`${btnSecondary} mt-3 w-full border-dashed text-sm`}>
          {t("field.demoTranscript")}
        </button>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-lg font-semibold">{t("field.photos")}</h2>
        <PhotoPicker
          items={photos.map((p) => ({
            key: p.key,
            url: p.url,
            onRemove: () => {
              URL.revokeObjectURL(p.url);
              setPhotos((ps) => ps.filter((x) => x.key !== p.key));
            },
          }))}
          onAdd={(files) =>
            setPhotos((ps) => [
              ...ps,
              ...files.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, url: URL.createObjectURL(f) })),
            ])
          }
        />
      </Card>

      {error && <p className="rounded-xl bg-brick-soft px-3 py-2 text-sm text-brick">{error}</p>}

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" disabled={!hasInput || !sessionToken} onClick={() => void submit()} className={`${btnPrimary} w-full text-lg`}>
          {t("field.analyze")}
        </button>
        {!hasInput && <p className="mt-1 text-center text-xs text-muted">{t("field.needInput")}</p>}
      </div>
    </div>
  );
}
