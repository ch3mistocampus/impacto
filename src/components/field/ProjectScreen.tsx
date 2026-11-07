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
import { CategoryMark, Chip, DoubleRule, FlagBand, btn } from "@/components/ui/tricolor";
import {
  AiBadge,
  Card,
  CategoryLabel,
  DEMO_TRANSCRIPT,
  LockIcon,
  Sparkle,
  Spinner,
  StatusChip,
  btnPrimary,
  btnSecondary,
  fieldLabel,
  inputCls,
  noticeCls,
  sectionTitle,
  segCls,
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
        <p className="font-display text-xl">{t("field.notFound")}</p>
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
      <BackLink />
      <Card>
        <h1 className="font-display text-[28px] font-normal leading-tight">{t("field.needsText.title")}</h1>
        {reason && <p className={`mt-3 ${noticeCls}`}>{t(reason)}</p>}
        {report.hasAudio && <p className="mt-2 text-sm text-muted">{t("field.hasAudio")}</p>}
        <div className="mt-5 grid grid-cols-2 border border-rule [&>*+*]:border-l [&>*+*]:border-rule">
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={segCls(lang === l)}
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
        <div className="mt-2 text-center">
          <button
            type="button"
            className={btn("quiet", "md", "min-h-11 text-[15px] text-muted")}
            onClick={() => {
              setLang("es");
              setText(DEMO_TRANSCRIPT.es);
            }}
          >
            {t("field.demoTranscript")}
          </button>
        </div>
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
    <section className="mx-auto mt-10 max-w-md border border-border bg-surface text-center">
      <FlagBand />
      <div className="px-6 pb-8 pt-8">
        {submitted ? (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald text-emerald">
              <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="square" />
              </svg>
            </span>
            <h1 className="mt-5 font-display text-[30px] font-normal leading-tight">{t("field.success.title")}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{t("field.success.body")}</p>
          </>
        ) : (
          <p className="font-display text-xl italic text-muted">{t("field.readonly")}</p>
        )}
        <DoubleRule className="mt-6" />
        <div className="flex flex-col items-center gap-2 py-5">
          <p className="font-display text-xl leading-snug">{pick(data.project.titleEs, data.project.titleEn) || t("field.untitled")}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted">
            <CategoryLabel category={data.project.category} />
            <span className="tabular-nums">
              {data.needs.length} {t("field.needsCount")}
            </span>
            <StatusChip status={data.project.status} />
          </div>
        </div>
        <DoubleRule />
        <Link href="/field" className={`${btnPrimary} mt-6 w-full`}>
          {t("field.success.back")}
        </Link>
      </div>
    </section>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link href="/field" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-muted underline-offset-4 hover:text-foreground hover:underline">
      <span aria-hidden>‹</span> {t("common.back")}
    </Link>
  );
}

// ---------------------------------------------------------------------------

export function Editor({ data, onReanalyze }: { data: Draft; onReanalyze: (transcript?: string) => void }) {
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
        <BackLink />
        <StatusChip status={data.project.status} />
      </div>
      <div>
        <h1 className="font-display text-[34px] font-normal leading-tight">{t("field.step3")}</h1>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">{t("field.review.intro")}</p>
      </div>

      {/* Source / provenance */}
      {ex && (
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 px-4 py-3 text-sm ${
            ex.source === "fallback" ? "border-gold bg-gold-soft text-gold-ink" : "border-rule bg-paper text-foreground"
          }`}
        >
          {ex.source === "fallback" ? (
            <Chip tone="gold">{t("field.source.fallback")}</Chip>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Sparkle /> {t("field.source.ai")}
            </span>
          )}
          {ex.source === "fallback" &&
            ["ai_error", "ai_timeout", "openai_error", "no_api_key"].includes(ex.notice ?? "") && (
            <span>{t(`field.source.fallback.${ex.notice}` as DictKey)}</span>
          )}
          {ex.model && <span className="text-muted">· {ex.model}</span>}
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
      <section className="rounded-[2px] border border-border bg-paper p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={sectionTitle}>
            {t("field.transcript")} <span className="font-sans text-sm text-muted">({report.language === "es" ? "Español" : "English"})</span>
          </h2>
          <button type="button" aria-pressed={editTranscript} className={btn("quiet", "md", "min-h-11 text-[15px]")} onClick={() => setEditTranscript((v) => !v)}>
            {t("field.editTranscript")}
          </button>
        </div>
        {editTranscript ? (
          <textarea
            rows={5}
            value={transcript}
            lang={report.language}
            onChange={(e) => setTranscript(e.target.value)}
            className={`${inputCls} mt-3 leading-relaxed`}
          />
        ) : (
          <blockquote lang={report.language} className="mt-4 whitespace-pre-wrap border-l-2 border-rule pl-4 font-display text-[19px] italic leading-relaxed text-foreground">
            <HighlightedText text={report.transcriptOriginal} quotes={quotes} />
          </blockquote>
        )}
        <button
          type="button"
          aria-expanded={showTranslation}
          className={btn("quiet", "md", "mt-3 min-h-11 text-[15px]")}
          onClick={() => setShowTranslation((v) => !v)}
        >
          {t(showTranslation ? "field.hideTranslation" : "field.showTranslation")} ({otherLang})
        </button>
        {showTranslation && (
          <p lang={otherLang} className="mt-2 border-l border-border pl-4 text-[15px] leading-relaxed text-muted">
            {report.transcriptTranslated || t("field.noTranslation")}
          </p>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            className={btn("secondary", "md", "min-h-12")}
            onClick={() => {
              if (!window.confirm(t("field.reanalyze.confirm"))) return;
              onReanalyze(transcript !== report.transcriptOriginal ? transcript : undefined);
            }}
          >
            <span aria-hidden>↻</span> {t("field.reanalyze")}
          </button>
        </div>
      </section>
      </div>

      <div className="space-y-4">
      <h2 className="sr-only">{t("field.fields")}</h2>
      {/* AI-drafted fields */}
      <Card className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={fieldLabel}>{t("field.category")}</span>
            <AiBadge />
          </div>
          <div className="grid grid-cols-1 border border-rule sm:grid-cols-3 [&>*+*]:border-t [&>*+*]:border-rule sm:[&>*+*]:border-l sm:[&>*+*]:border-t-0">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  markDirty();
                }}
                className={`flex items-center gap-2 text-left ${segCls(category === c)}`}
              >
                <CategoryMark category={c} size={11} />
                {t(`category.${c}` as DictKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={fieldLabel}>
              {t("field.urgency")} <span className="font-normal text-muted">· <span className="italic">{t("field.urgency.suggested")}</span></span>
            </span>
            <AiBadge />
          </div>
          <div className="grid grid-cols-3 border border-rule [&>*+*]:border-l [&>*+*]:border-rule">
            {URGENCIES.map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={urgency === u}
                onClick={() => {
                  setUrgency(u);
                  markDirty();
                }}
                className={segCls(urgency === u)}
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
            <span className={`mb-1.5 flex items-center justify-between gap-2 ${fieldLabel}`}>
              {t(label)} <AiBadge />
            </span>
            {multi ? (
              <textarea rows={3} lang={lang} value={value} onChange={(e) => set(e.target.value)} className={`${inputCls} leading-relaxed`} />
            ) : (
              <input lang={lang} value={value} onChange={(e) => set(e.target.value)} className={inputCls} />
            )}
          </label>
        ))}
      </Card>

      {ex && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={sectionTitle}>{t("field.damage")}</h2>
            <AiBadge />
          </div>
          {(
            [
              ["field.damageEs", damageEs, setDamageEs, "es"],
              ["field.damageEn", damageEn, setDamageEn, "en"],
            ] as const
          ).map(([label, value, set, lang]) => (
            <label key={label} className="block">
              <span className={`mb-1.5 block ${fieldLabel}`}>{t(label)}</span>
              <textarea rows={2} lang={lang} value={value} onChange={(e) => set(e.target.value)} className={inputCls} />
            </label>
          ))}
        </Card>
      )}

      <Card>
        <h2 className={`mb-4 ${sectionTitle}`}>{t("field.materials")}</h2>
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
            <h2 className={sectionTitle}>{t("field.milestones")}</h2>
            <AiBadge />
          </div>
          <p className="mt-1 text-[15px] text-muted">{t("field.milestones.hint")}</p>
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {milestones.map((m, i) => (
              <li key={m.key} className="flex items-start gap-2 py-3">
                <span className="mt-2.5 w-7 shrink-0 text-center font-display text-2xl leading-none text-foreground tabular-nums">
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
                  className="flex h-12 w-11 shrink-0 items-center justify-center text-2xl leading-none text-muted hover:text-red"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={`${btnSecondary} mt-4 w-full`}
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
        <Card className="border-l-2 border-l-gold">
          <h2 className={sectionTitle}>{t("field.missing")}</h2>
          <p className="mt-1 text-[15px] text-muted">{t("field.missing.hint")}</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] marker:text-gold-ink">
            {ex.missingQuestions.map((q, i) => (
              <li key={i}>{pick(q.es, q.en)}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className={`mb-4 ${sectionTitle}`}>{t("field.photos")}</h2>
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
        <p role="alert" className="border-l-2 border-red bg-red-soft px-4 py-3 text-[15px] font-medium text-red">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-rule bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:mx-0 lg:px-0">
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
      <mark key={`m${a}`} className="bg-gold-soft px-0.5 not-italic text-inherit underline decoration-gold decoration-2 underline-offset-4">
        {text.slice(a, b)}
      </mark>,
    );
    pos = b;
  }
  if (pos < text.length) parts.push(<Fragment key={`t${pos}`}>{text.slice(pos)}</Fragment>);
  return <>{parts}</>;
}
