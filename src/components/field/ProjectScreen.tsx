"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n, type Locale } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { useSession } from "@/lib/session";
import { AnalyzingPanel } from "./AnalyzingPanel";
import { MaterialsEditor, type NeedRow } from "./MaterialsEditor";
import { PhotoPicker } from "./PhotoPicker";
import { PhotoAnalysis, type SuggestedMaterial } from "./PhotoAnalysis";
import { PrivateDetails, type PrivateState } from "./PrivateDetails";
import {
  AiBadge,
  CATEGORY_STYLE,
  Card,
  DEMO_TRANSCRIPT,
  LockIcon,
  Spinner,
  StatusChip,
  btnPrimary,
  btnSecondary,
  inputCls,
  uploadFile,
  type Category,
} from "./ui";

type Draft = NonNullable<FunctionReturnType<typeof api.field.getMyDraft>>;
type Urgency = "low" | "medium" | "high";
type MilestoneRow = { key: string; es: string; en: string };
const CATEGORIES: Category[] = ["roof_shelter", "reconstruction", "heal_sow"];
const URGENCIES: Urgency[] = ["low", "medium", "high"];

export function ProjectScreen({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { sessionToken } = useSession();
  const data = useQuery(
    api.field.getMyDraft,
    sessionToken ? { sessionToken, projectId: projectId as Id<"projects"> } : "skip",
  );
  const saveTranscript = useMutation(api.field.saveTranscript);
  const analyze = useAction(api.ai.transcribeAndExtract);
  const [analyzing, setAnalyzing] = useState(false);
  const [epoch, setEpoch] = useState(0);

  const runAnalysis = async (transcript?: string, language?: Locale) => {
    if (!sessionToken || !data?.report) return;
    setAnalyzing(true);
    try {
      if (transcript !== undefined)
        await saveTranscript({ sessionToken, reportId: data.report._id, transcript, language });
      await analyze({ sessionToken, reportId: data.report._id });
    } catch (e) {
      console.error(e);
    } finally {
      setEpoch((n) => n + 1);
      setAnalyzing(false);
    }
  };

  if (data === undefined)
    return (
      <div className="flex items-center gap-2 py-16 text-muted">
        <Spinner /> {t("common.loading")}
      </div>
    );
  if (data === null || !data.report)
    return (
      <Card className="mx-auto mt-10 max-w-md text-center">
        <p>{t("field.notFound")}</p>
        <Link href="/field" className={`${btnSecondary} mt-4`}>
          {t("field.success.back")}
        </Link>
      </Card>
    );
  if (analyzing || data.report.aiStatus === "pending")
    return <AnalyzingPanel withAudio={data.report.hasAudio && !data.report.transcriptOriginal} />;
  if (data.project.status !== "draft") return <SubmittedView data={data} />;
  if (!data.report.draftExtraction)
    return <TextFallback data={data} onAnalyze={(text, lang) => void runAnalysis(text, lang)} />;
  return <Editor key={epoch} data={data} onReanalyze={(text) => void runAnalysis(text)} />;
}

// ---------------------------------------------------------------------------

function TextFallback({ data, onAnalyze }: { data: Draft; onAnalyze: (text: string, lang: Locale) => void }) {
  const { t } = useI18n();
  const report = data.report!;
  const [text, setText] = useState(report.transcriptOriginal);
  const [lang, setLang] = useState<Locale>(report.language);
  const reason = report.aiError && ["no_api_key_audio", "transcription_failed", "transcription_timeout", "no_input"].includes(report.aiError)
    ? (`field.needsText.${report.aiError}` as DictKey)
    : null;
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-6">
      <Link href="/field" className="text-sm text-muted">
        ← {t("common.back")}
      </Link>
      <Card>
        <h1 className="font-display text-2xl font-semibold">{t("field.needsText.title")}</h1>
        {reason && <p className="mt-2 rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber">{t(reason)}</p>}
        {report.hasAudio && <p className="mt-2 text-xs text-muted">{t("field.hasAudio")}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`min-h-11 rounded-xl border font-semibold ${lang === l ? "border-clay bg-clay-soft text-clay" : "border-border"}`}
            >
              {l === "es" ? "Español" : "English"}
            </button>
          ))}
        </div>
        <textarea
          rows={6}
          value={text}
          lang={lang}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("field.text.placeholder")}
          className={`${inputCls} mt-3`}
        />
        <button
          type="button"
          className={`${btnSecondary} mt-3 w-full border-dashed text-sm`}
          onClick={() => {
            setLang("es");
            setText(DEMO_TRANSCRIPT.es);
          }}
        >
          {t("field.demoTranscript")}
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onAnalyze(text, lang)}
          className={`${btnPrimary} mt-3 w-full text-lg`}
        >
          {t("field.analyze")}
        </button>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SubmittedView({ data }: { data: Draft }) {
  const { t, pick } = useI18n();
  const submitted = data.project.status === "in_review";
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      {submitted ? (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf-soft text-leaf">
            <svg aria-hidden viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold">{t("field.success.title")}</h1>
          <p className="mt-2 text-muted">{t("field.success.body")}</p>
        </>
      ) : (
        <p className="text-muted">{t("field.readonly")}</p>
      )}
      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-background p-3">
        <StatusChip status={data.project.status} />
        <p className="font-semibold">{pick(data.project.titleEs, data.project.titleEn) || t("field.untitled")}</p>
        <p className="text-sm text-muted">
          {data.needs.length} {t("field.needsCount")}
        </p>
      </div>
      <Link href="/field" className={`${btnPrimary} mt-5 w-full`}>
        {t("field.success.back")}
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Editor({ data, onReanalyze }: { data: Draft; onReanalyze: (transcript?: string) => void }) {
  const { t, pick } = useI18n();
  const { sessionToken } = useSession();
  const report = data.report!;
  const ex = report.draftExtraction;
  const updateDraft = useMutation(api.field.updateDraft);
  const savePrivate = useMutation(api.field.savePrivateDetails);
  const submitForReview = useMutation(api.field.submitForReview);
  const genUrl = useMutation(api.field.generateUploadUrl);
  const attachPhoto = useMutation(api.field.attachPhoto);
  const removePhoto = useMutation(api.field.removePhoto);

  const [titleEs, setTitleEs] = useState(data.project.titleEs);
  const [titleEn, setTitleEn] = useState(data.project.titleEn);
  const [summaryEs, setSummaryEs] = useState(data.project.summaryEs);
  const [summaryEn, setSummaryEn] = useState(data.project.summaryEn);
  const [category, setCategory] = useState<Category>(data.project.category);
  const [urgency, setUrgency] = useState<Urgency>(data.project.urgency);
  const [rows, setRows] = useState<NeedRow[]>(() =>
    data.needs.map((n) => ({
      rowKey: n._id,
      needId: n._id,
      itemKey: n.itemKey,
      nameEs: n.nameEs,
      nameEn: n.nameEn,
      qty: n.requestedQty === null ? "" : String(n.requestedQty),
      unit: n.unit,
      aiSuggested: n.aiSuggested,
      quote: n.aiSuggested ? ex?.materials.find((m) => m.itemKey === n.itemKey)?.sourceQuote : undefined,
      approximate: n.aiSuggested ? ex?.materials.find((m) => m.itemKey === n.itemKey)?.approximate === true : false,
    })),
  );
  const [damageEs, setDamageEs] = useState(ex?.damageDescriptionEs ?? "");
  const [damageEn, setDamageEn] = useState(ex?.damageDescriptionEn ?? "");
  const [milestones, setMilestones] = useState<MilestoneRow[]>(() =>
    (ex?.proposedMilestones ?? []).map((m, i) => ({ key: `m${i}`, es: m.es, en: m.en })),
  );
  const [priv, setPriv] = useState<PrivateState>(
    data.private ?? { beneficiaryName: "", contact: "", privateAddress: "", privateNotes: "" },
  );
  const [showTranslation, setShowTranslation] = useState(false);
  const [editTranscript, setEditTranscript] = useState(false);
  const [transcript, setTranscript] = useState(report.transcriptOriginal);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const save = async (rowsToSave: NeedRow[] = rows) => {
    if (!sessionToken) return;
    await updateDraft({
      sessionToken,
      projectId: data.project._id,
      titleEs,
      titleEn,
      category,
      summaryEs,
      summaryEn,
      urgency,
      needs: rowsToSave.map((r) => {
        const q = Number(r.qty);
        return {
          needId: r.needId as Id<"materialNeeds"> | undefined,
          itemKey: r.itemKey,
          nameEs: r.nameEs,
          nameEn: r.nameEn,
          requestedQty: r.qty.trim() !== "" && Number.isFinite(q) && q > 0 ? q : undefined,
          unit: r.unit,
          aiSuggested: r.aiSuggested,
        };
      }),
      ...(ex
        ? {
            damageDescriptionEs: damageEs,
            damageDescriptionEn: damageEn,
            proposedMilestones: milestones.map(({ es, en }) => ({ es, en })),
          }
        : {}),
    });
    await savePrivate({ sessionToken, projectId: data.project._id, ...priv });
  };

  const onSave = async () => {
    setError(null);
    setStatus("saving");
    try {
      await save();
      setStatus("saved");
    } catch (e) {
      console.error(e);
      setError(t("field.error"));
      setStatus("idle");
    }
  };

  const onSubmit = async () => {
    if (!sessionToken) return;
    setError(null);
    setStatus("submitting");
    try {
      await save();
      await submitForReview({ sessionToken, projectId: data.project._id });
      // status flips to in_review reactively -> SubmittedView
    } catch (e) {
      if (e instanceof ConvexError && (e.data as { code?: string })?.code === "MISSING_FIELDS") {
        const fields = ((e.data as { fields?: string[] }).fields ?? []).map((f) => t(`field.req.${f}` as DictKey));
        setError(`${t("field.missingFields")} ${fields.join(", ")}`);
      } else {
        console.error(e);
        setError(t("field.error"));
      }
      setStatus("idle");
    }
  };

  const addPhotos = async (files: File[]) => {
    if (!sessionToken) return;
    setPhotoBusy(true);
    try {
      for (const f of files) {
        const sid = await uploadFile(await genUrl({ sessionToken }), f);
        await attachPhoto({ sessionToken, projectId: data.project._id, storageId: sid as Id<"_storage"> });
      }
    } catch (e) {
      console.error(e);
      setError(t("field.error"));
    } finally {
      setPhotoBusy(false);
    }
  };

  // Accepting an AI photo suggestion adds an AI-labelled row and saves right away, so the
  // accepted/discarded state stored on the server always matches the saved needs.
  const acceptPhotoMaterial = async (m: SuggestedMaterial) => {
    const row: NeedRow = {
      rowKey: `photo-${Date.now()}`,
      itemKey: m.itemKey,
      nameEs: m.nameEs,
      nameEn: m.nameEn,
      qty: m.quantity !== null ? String(m.quantity) : "",
      unit: m.unit,
      aiSuggested: true,
    };
    const next = [...rows, row];
    setRows(next);
    await save(next);
  };
  const acceptPhotoObservations = (es: string[], en: string[]) => {
    const join = (prev: string, add: string[]) => [prev.trim(), ...add].filter(Boolean).join(" ");
    setDamageEs((d) => join(d, es));
    setDamageEn((d) => join(d, en));
    markDirty();
  };

  const otherLang = report.language === "es" ? "en" : "es";
  const busy = status === "saving" || status === "submitting";
  const markDirty = () => status === "saved" && setStatus("idle");

  const quotes = rows.map((r) => r.quote).filter((q): q is string => !!q);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-6 lg:max-w-6xl" onChangeCapture={markDirty}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/field" className="text-sm text-muted">
          ← {t("common.back")}
        </Link>
        <StatusChip status={data.project.status} />
      </div>
      <div>
        <h1 className="font-display text-3xl font-semibold">{t("field.step3")}</h1>
        <p className="mt-1 text-muted">{t("field.review.intro")}</p>
      </div>

      {/* Source / provenance */}
      {ex && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            ex.source === "fallback" ? "bg-amber-soft text-amber" : "bg-sky-soft text-sky"
          }`}
        >
          {ex.source === "fallback" ? (
            <span className="inline-flex items-center rounded-full border border-current px-2.5 py-0.5 text-xs font-bold">
              {t("field.source.fallback")}
            </span>
          ) : (
            <span className="font-semibold">{t("field.source.ai")}</span>
          )}
          {ex.source === "fallback" &&
            ["ai_error", "ai_timeout", "openai_error", "no_api_key"].includes(ex.notice ?? "") && (
            <span>{t(`field.source.fallback.${ex.notice}` as DictKey)}</span>
          )}
          {ex.model && <span className="opacity-75">· {ex.model}</span>}
          {ex.redactions > 0 && (
            <span className="flex items-center gap-1">
              <LockIcon className="h-3.5 w-3.5" /> {ex.redactions} {t("field.redacted")}
            </span>
          )}
        </div>
      )}

      {/* Transcript (left, sticky on wide screens) | extracted fields (right). Stacked on mobile. */}
      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            {t("field.transcript")} <span className="text-sm font-normal uppercase text-muted">({report.language})</span>
          </h2>
          <button type="button" className="min-h-11 text-sm text-sky underline-offset-4 hover:underline" onClick={() => setEditTranscript((v) => !v)}>
            {t("field.editTranscript")}
          </button>
        </div>
        {editTranscript ? (
          <textarea
            rows={5}
            value={transcript}
            lang={report.language}
            onChange={(e) => setTranscript(e.target.value)}
            className={`${inputCls} mt-2`}
          />
        ) : (
          <blockquote lang={report.language} className="mt-2 whitespace-pre-wrap border-l-4 border-clay pl-3 text-lg leading-relaxed">
            <HighlightedText text={report.transcriptOriginal} quotes={quotes} />
          </blockquote>
        )}
        <button
          type="button"
          aria-expanded={showTranslation}
          className="mt-3 min-h-11 text-sm font-medium text-sky"
          onClick={() => setShowTranslation((v) => !v)}
        >
          {t(showTranslation ? "field.hideTranslation" : "field.showTranslation")} ({otherLang})
        </button>
        {showTranslation && (
          <p lang={otherLang} className="mt-1 rounded-xl bg-background px-3 py-2 text-muted">
            {report.transcriptTranslated || t("field.noTranslation")}
          </p>
        )}
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            className={`${btnSecondary} text-sm`}
            onClick={() => {
              if (!window.confirm(t("field.reanalyze.confirm"))) return;
              onReanalyze(transcript !== report.transcriptOriginal ? transcript : undefined);
            }}
          >
            ↻ {t("field.reanalyze")}
          </button>
        </div>
      </Card>
      </div>

      <div className="space-y-4">
      <h2 className="sr-only">{t("field.fields")}</h2>
      {/* AI-drafted fields */}
      <Card className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted">{t("field.category")}</span>
            <AiBadge />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  markDirty();
                }}
                className={`min-h-12 rounded-xl border-2 px-3 text-left font-semibold ${
                  category === c ? `${CATEGORY_STYLE[c].soft} ${CATEGORY_STYLE[c].text} border-current` : "border-border"
                }`}
              >
                {t(`category.${c}` as DictKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted">
              {t("field.urgency")} · <span className="italic">{t("field.urgency.suggested")}</span>
            </span>
            <AiBadge />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {URGENCIES.map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={urgency === u}
                onClick={() => {
                  setUrgency(u);
                  markDirty();
                }}
                className={`min-h-12 rounded-xl border-2 font-semibold ${
                  urgency === u
                    ? u === "high"
                      ? "border-brick bg-brick-soft text-brick"
                      : u === "medium"
                        ? "border-amber bg-amber-soft text-amber"
                        : "border-leaf bg-leaf-soft text-leaf"
                    : "border-border"
                }`}
              >
                {t(`field.urgency.${u}` as DictKey)}
              </button>
            ))}
          </div>
        </div>

        {(
          [
            ["field.titleEs", titleEs, setTitleEs, "es", false],
            ["field.titleEn", titleEn, setTitleEn, "en", false],
            ["field.summaryEs", summaryEs, setSummaryEs, "es", true],
            ["field.summaryEn", summaryEn, setSummaryEn, "en", true],
          ] as const
        ).map(([label, value, set, lang, multi]) => (
          <label key={label} className="block">
            <span className="mb-1 flex items-center justify-between gap-2 text-sm font-medium text-muted">
              {t(label)} <AiBadge />
            </span>
            {multi ? (
              <textarea rows={3} lang={lang} value={value} onChange={(e) => set(e.target.value)} className={inputCls} />
            ) : (
              <input lang={lang} value={value} onChange={(e) => set(e.target.value)} className={inputCls} />
            )}
          </label>
        ))}
      </Card>

      {ex && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t("field.damage")}</h2>
            <AiBadge />
          </div>
          {(
            [
              ["field.damageEs", damageEs, setDamageEs, "es"],
              ["field.damageEn", damageEn, setDamageEn, "en"],
            ] as const
          ).map(([label, value, set, lang]) => (
            <label key={label} className="block">
              <span className="mb-1 block text-sm font-medium text-muted">{t(label)}</span>
              <textarea rows={2} lang={lang} value={value} onChange={(e) => set(e.target.value)} className={inputCls} />
            </label>
          ))}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-display text-lg font-semibold">{t("field.materials")}</h2>
        <MaterialsEditor
          rows={rows}
          onChange={(r) => {
            setRows(r);
            markDirty();
          }}
        />
      </Card>

      {ex && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t("field.milestones")}</h2>
            <AiBadge />
          </div>
          <p className="text-sm text-muted">{t("field.milestones.hint")}</p>
          <ol className="mt-3 space-y-2">
            {milestones.map((m, i) => (
              <li key={m.key} className="flex items-start gap-2 rounded-xl border border-border bg-background p-2">
                <span className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clay-soft text-sm font-bold text-clay">
                  {i + 1}
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["es", "en"] as const).map((lang) => (
                    <input
                      key={lang}
                      lang={lang}
                      aria-label={`${t("field.milestones")} ${i + 1} (${lang})`}
                      value={m[lang]}
                      placeholder={lang.toUpperCase()}
                      onChange={(e) =>
                        setMilestones((ms) => ms.map((x) => (x.key === m.key ? { ...x, [lang]: e.target.value } : x)))
                      }
                      className={inputCls}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label={t("field.milestones.remove")}
                  onClick={() => {
                    setMilestones((ms) => ms.filter((x) => x.key !== m.key));
                    markDirty();
                  }}
                  className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-brick"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={`${btnSecondary} mt-3 w-full border-dashed`}
            onClick={() => {
              setMilestones((ms) => [...ms, { key: `new-${Date.now()}`, es: "", en: "" }]);
              markDirty();
            }}
          >
            + {t("field.milestones.add")}
          </button>
        </Card>
      )}

      {ex && ex.missingQuestions.length > 0 && (
        <Card className="border-amber bg-amber-soft/40">
          <h2 className="font-display text-lg font-semibold">{t("field.missing")}</h2>
          <p className="text-sm text-muted">{t("field.missing.hint")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {ex.missingQuestions.map((q, i) => (
              <li key={i}>{pick(q.es, q.en)}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-display text-lg font-semibold">{t("field.photos")}</h2>
        <PhotoPicker
          disabled={photoBusy}
          items={data.photos.map((p) => ({
            key: p._id,
            url: p.url,
            onRemove: () => sessionToken && void removePhoto({ sessionToken, photoId: p._id }),
          }))}
          onAdd={(files) => void addPhotos(files)}
        />
        {ex && (
          <PhotoAnalysis
            photos={data.photos}
            suggestions={ex.photoSuggestions ?? []}
            disabled={busy || photoBusy}
            onAcceptMaterial={acceptPhotoMaterial}
            onAcceptObservations={acceptPhotoObservations}
          />
        )}
        {photoBusy && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4" /> {t("field.saving")}
          </p>
        )}
      </Card>

      <PrivateDetails
        value={priv}
        onChange={(v) => {
          setPriv(v);
          markDirty();
        }}
      />

      {error && (
        <p role="alert" className="rounded-xl bg-brick-soft px-3 py-2 text-sm font-medium text-brick">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" disabled={busy} onClick={() => void onSave()} className={btnSecondary}>
          {status === "saving" ? <Spinner /> : null}
          {status === "saved" ? `✓ ${t("field.saved")}` : t("field.saveDraft")}
        </button>
        <button type="button" disabled={busy} onClick={() => void onSubmit()} className={btnPrimary}>
          {status === "submitting" ? <Spinner /> : null}
          {t("field.submit")}
        </button>
      </div>
      </div>
      </div>
    </div>
  );
}

/** Highlights each source quote (case-insensitive) inside the transcript. */
function HighlightedText({ text, quotes }: { text: string; quotes: string[] }) {
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const needle = q.trim().toLowerCase();
    if (needle.length < 3) continue;
    const at = lower.indexOf(needle);
    if (at >= 0) ranges.push([at, at + needle.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a < pos) continue; // overlapping — skip
    if (a > pos) parts.push(<Fragment key={`t${pos}`}>{text.slice(pos, a)}</Fragment>);
    parts.push(
      <mark key={`m${a}`} className="rounded bg-amber-soft px-0.5 text-inherit">
        {text.slice(a, b)}
      </mark>,
    );
    pos = b;
  }
  if (pos < text.length) parts.push(<Fragment key={`t${pos}`}>{text.slice(pos)}</Fragment>);
  return <>{parts}</>;
}
