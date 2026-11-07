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
import { toSpeechWav } from "./audioWav";
import { btn } from "@/components/ui/tricolor";
import { Card, DEMO_TRANSCRIPT, LockIcon, btnPrimary, fieldLabel, inputCls, noticeCls, sectionTitle, segCls, uploadFile } from "./ui";

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
  // Per-report consent: audio is only uploaded (and sent to the AI service) when this is on.
  const [audioToAi, setAudioToAi] = useState(true);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Mic denied/unsupported → switch to typing and focus the text box.
  useEffect(() => {
    if ((micIssue || !audioToAi) && mode === "text") textRef.current?.focus();
  }, [micIssue, audioToAi, mode]);

  const sendsAudio = mode === "voice" && audioToAi && !!audio;
  const hasInput = sendsAudio || (mode === "text" && text.trim().length > 0);

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
      if (sendsAudio && audio) {
        // webm (Chrome) / mp4 (Safari) -> 16 kHz mono WAV, the format every audio model accepts.
        const sid = await uploadFile(await genUrl({ sessionToken }), await toSpeechWav(audio));
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

  if (busy) return <AnalyzingPanel withAudio={sendsAudio} />;

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-6">
      <Link href="/field" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-muted underline-offset-4 hover:text-foreground hover:underline">
        <span aria-hidden>‹</span> {t("common.back")}
      </Link>
      <h1 className="font-display text-[34px] font-normal leading-tight">{t("field.new")}</h1>

      <Card>
        <h2 className={sectionTitle}>{t("field.step1")}</h2>

        <fieldset className="mt-5">
          <legend className={`mb-2 ${fieldLabel}`}>{t("field.language")}</legend>
          <div className="grid grid-cols-2 border border-rule [&>*+*]:border-l [&>*+*]:border-rule">
            {(["es", "en"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={language === l} onClick={() => setLanguage(l)} className={segCls(language === l)}>
                {l === "es" ? "Español" : "English"}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid grid-cols-2 border-b border-border" role="tablist">
          {(["voice", "text"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`-mb-px min-h-12 border-b-2 text-base font-semibold transition-colors ${
                mode === m ? "border-rule text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t(m === "voice" ? "field.mode.voice" : "field.mode.text")}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {mode === "voice" && (
            <div className="mb-4 border-l-2 border-rule bg-paper px-4 py-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold">
                <input
                  type="checkbox"
                  checked={audioToAi}
                  onChange={(e) => {
                    setAudioToAi(e.target.checked);
                    if (!e.target.checked) setMode("text");
                  }}
                  className="h-5 w-5 shrink-0 accent-navy"
                />
                {t("field.audioAi.toggle")}
              </label>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                {t("field.audioAi.notice")}
              </p>
            </div>
          )}
          {mode === "voice" ? (
            audioToAi ? (
              <AudioRecorder
                onChange={setAudio}
                onUnavailable={(issue) => {
                  setMicIssue(issue);
                  setMode("text");
                }}
              />
            ) : (
              <p className={noticeCls}>{t("field.audioAi.offVoice")}</p>
            )
          ) : (
            <>
              {!audioToAi && (
                <p className={`${noticeCls} mb-3 flex items-start justify-between gap-3`}>
                  <span>{t("field.audioAi.off")}</span>
                  <button
                    type="button"
                    className="min-h-11 shrink-0 font-semibold underline underline-offset-4"
                    onClick={() => {
                      setAudioToAi(true);
                      setMode("voice");
                    }}
                  >
                    {t("field.audioAi.toggle")}
                  </button>
                </p>
              )}
              {micIssue && (
                <p role="alert" className={`${noticeCls} mb-3`}>
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
                className={`${inputCls} leading-relaxed`}
              />
            </>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4 text-center">
          <button type="button" onClick={applyDemo} className={btn("quiet", "md", "min-h-11 text-[15px] text-muted")}>
            {t("field.demoTranscript")}
          </button>
        </div>
      </Card>

      <Card>
        <h2 className={`mb-4 ${sectionTitle}`}>{t("field.photos")}</h2>
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

      {error && (
        <p role="alert" className="border-l-2 border-red bg-red-soft px-4 py-3 text-[15px] text-red">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-rule bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button type="button" disabled={!hasInput || !sessionToken} onClick={() => void submit()} className={`${btnPrimary} w-full text-lg`}>
          {t("field.analyze")}
        </button>
        {!hasInput && <p className="mt-1.5 text-center text-sm text-muted">{t("field.needInput")}</p>}
      </div>
    </div>
  );
}
