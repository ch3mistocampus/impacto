"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { useSession } from "@/lib/session";
import { prepareImageForUpload } from "@/lib/image";
import { Chip, DoubleRule, FlagBand, btn, intlLocale, type ChipTone } from "@/components/ui/tricolor";
import { LedgerBar } from "@/components/public/LedgerBar";
import { Timeline, type TimelineItem } from "@/components/public/Timeline";
import { EvidenceList } from "@/components/public/EvidenceList";
import { MaterialImage } from "@/components/public/MaterialImage";
import { ProjectTodos } from "./Todos";
import {
  AiBadge,
  Card,
  CategoryLabel,
  LockIcon,
  Spinner,
  StatusChip,
  btnPrimary,
  btnSecondary,
  inputCls,
  noticeCls,
  sectionTitle,
  segCls,
  uploadFile,
} from "./ui";

export type FieldProject = NonNullable<FunctionReturnType<typeof api.field.getMyProject>>;

type Step = "reported" | "in_review" | "published" | "materials" | "verified" | "completed";
const STEPS: Step[] = ["reported", "in_review", "published", "materials", "verified", "completed"];

/** Index of the current step (everything before it is done). */
function currentStep(d: FieldProject): number {
  const s = d.project.status;
  if (s === "draft") return 0;
  if (s === "in_review") return 1;
  if (s === "rejected") return 1;
  if (s === "completed") return 5;
  const anyVerified = d.needs.some((n) => n.ledger.verified > 0);
  const anyArriving = d.needs.some((n) => n.ledger.received > 0 || n.ledger.pledgedTotal > 0);
  if (anyVerified) return 4;
  if (anyArriving) return 3;
  return 2;
}

function useFmt() {
  const { locale } = useI18n();
  const f = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" });
  return (ms: number) => f.format(ms);
}

/** Read-only progress page for a project the worker reported (any non-draft status). */
export function ProgressView({ data, openTodoId }: { data: FieldProject; openTodoId?: string | null }) {
  const { t, pick } = useI18n();
  const fmt = useFmt();
  const p = data.project;
  const title = pick(p.titleEs, p.titleEn) || t("field.untitled");
  const canFollowUp = p.status === "published" || p.status === "paused" || p.status === "completed";

  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-6 pb-16 lg:max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/field"
          className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          <span aria-hidden>‹</span> {t("common.back")}
        </Link>
        <StatusChip status={p.status} />
      </div>

      {/* Header */}
      <header className="border border-border bg-surface">
        <FlagBand />
        <div className="space-y-3 p-4 sm:p-6">
          <h1 className="font-display text-[30px] font-normal leading-tight sm:text-[36px]">{title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px]">
            <CategoryLabel category={p.category} />
            {p.isPublic && (
              <span>
                <span className="text-muted">{t("field.pv.publicName")}:</span> <strong className="font-semibold">{p.publicAlias}</strong>
              </span>
            )}
            {p.region && (
              <span>
                <span className="text-muted">{t("field.pv.region")}:</span> {p.region}
              </span>
            )}
          </div>
          <DoubleRule />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <Meta label={t("field.pv.reportedOn")} value={fmt(p.createdAt)} />
            {p.approvedAt && <Meta label={t("field.pv.approvedOn")} value={fmt(p.approvedAt)} />}
            {p.publishedAt && <Meta label={t("field.pv.publishedOn")} value={fmt(p.publishedAt)} />}
            {p.approvedByName && <Meta label={t("field.pv.approvedBy")} value={p.approvedByName} />}
          </dl>
          {p.isPublic && (
            <Link href={`/transparency/projects/${p._id}`} className={`${btnSecondary} w-full sm:w-auto`}>
              {t("field.pv.viewPublic")} <span aria-hidden>↗</span>
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-5">
          {(data.todos.length > 0 || p.status === "published") && <ProjectTodos todos={data.todos} initialOpenId={openTodoId} />}
          <Stepper data={data} />
          <Materials data={data} />
          <Card>
            <h2 className={sectionTitle}>{t("field.pv.timeline")}</h2>
            <p className="mt-1 mb-5 text-sm text-muted">{t("field.pv.timeline.hint")}</p>
            <Timeline
              items={data.timeline.map(
                (m): TimelineItem => ({
                  id: m.milestoneId,
                  type: m.type,
                  status: m.status,
                  occurredAt: m.occurredAt,
                  descriptionEs: m.descriptionEs,
                  descriptionEn: m.descriptionEn,
                  photoUrl: m.photoUrl,
                  proof: m.proof?.url
                    ? {
                        url: m.proof.url,
                        label: t(`field.proof.type.${m.proof.type}` as DictKey),
                        review: m.proof.reviewStatus,
                      }
                    : null,
                }),
              )}
            />
          </Card>
          {data.evidence.length > 0 && (
            <Card>
              <h2 className={`mb-4 ${sectionTitle}`}>{t("field.pv.evidence")}</h2>
              <EvidenceList items={data.evidence} />
            </Card>
          )}
        </div>
        <div className="space-y-5">
          {canFollowUp ? <FollowUps data={data} /> : null}
          <YourReport data={data} />
          <PrivateReadOnly priv={data.private} />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ data }: { data: FieldProject }) {
  const { t } = useI18n();
  const cur = currentStep(data);
  const s = data.project.status;
  const done = s === "completed";
  return (
    <Card>
      <h2 className={sectionTitle}>{t("field.pv.what")}</h2>
      <ol className="mt-4">
        {STEPS.map((step, i) => {
          const state = done || i < cur ? "done" : i === cur ? "current" : "todo";
          const last = i === STEPS.length - 1;
          return (
            <li key={step} className="relative grid grid-cols-[1.75rem_1fr] gap-x-3 pb-4 last:pb-0" aria-current={state === "current" ? "step" : undefined}>
              {!last && (
                <span
                  aria-hidden
                  className={`absolute left-[13px] top-7 bottom-0 w-px ${state === "done" ? "bg-emerald" : "bg-border"}`}
                />
              )}
              <span
                aria-hidden
                className={`relative z-10 grid size-7 place-items-center rounded-full text-xs font-semibold ${
                  state === "done"
                    ? "bg-emerald text-on-navy"
                    : state === "current"
                      ? "bg-navy text-on-navy ring-4 ring-navy/15"
                      : "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--border)]"
                }`}
              >
                {state === "done" ? (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="square" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <div className="flex min-h-7 flex-wrap items-center gap-2">
                <span className={`text-[16px] ${state === "todo" ? "text-muted" : "font-semibold"}`}>
                  {t(`field.pv.step.${step}` as DictKey)}
                </span>
                {state === "current" && !done && s !== "rejected" && <Chip tone="navy">{t("field.pv.now")}</Chip>}
                {state === "current" && s === "rejected" && <StatusChip status="rejected" />}
              </div>
            </li>
          );
        })}
      </ol>

      {s === "in_review" && <p className={`mt-4 ${noticeCls}`}>{t("field.pv.inReview.body")}</p>}
      {s === "paused" && (
        <div className="mt-4 border-l-2 border-rule bg-paper px-4 py-3">
          <p className="font-semibold">{t("field.pv.paused.title")}</p>
          {data.project.safetyPauseReasonPublic && <p className="mt-1 text-[15px]">{data.project.safetyPauseReasonPublic}</p>}
          <p className="mt-1 text-sm text-muted">{t("field.pv.paused.body")}</p>
        </div>
      )}
      {s === "rejected" && <p className="mt-4 border-l-2 border-rule bg-paper px-4 py-3 text-[15px]">{t("field.pv.rejected.body")}</p>}
      {s === "completed" && (
        <p className="mt-4 border-l-2 border-emerald bg-emerald-soft px-4 py-3 text-[15px] text-emerald">{t("field.pv.completed.body")}</p>
      )}

      {data.feedback.coordinatorNotes.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">{t("field.pv.coordNotes")}</h3>
          <ul className="mt-1.5 space-y-1.5">
            {data.feedback.coordinatorNotes.map((n, i) => (
              <li key={i} className="border-l-2 border-gold bg-gold-soft px-3 py-2 text-[15px] text-gold-ink">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.project.isPublic && (
        <p className="mt-4 text-sm text-muted tabular-nums">
          <strong className="font-display text-lg font-normal text-foreground">{data.pledges.active}</strong> {t("field.pv.pledges")}
          {data.pledges.fulfilled > 0 && (
            <>
              {" · "}
              <strong className="font-display text-lg font-normal text-foreground">{data.pledges.fulfilled}</strong>{" "}
              {t("field.pv.pledgesFulfilled")}
            </>
          )}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Materials({ data }: { data: FieldProject }) {
  const { t, pick } = useI18n();
  const qty = (q: number | null, unit: string) => (q === null ? t("field.pv.noQty") : `${q} ${unit}`);
  return (
    <Card>
      <h2 className={sectionTitle}>{t("field.pv.materials")}</h2>
      <p className="mt-1 text-sm text-muted">{t("field.pv.materials.hint")}</p>
      <ul className="mt-4 divide-y divide-border">
        {data.needs.map((n) => {
          const name = pick(n.nameEs, n.nameEn);
          const published = n.status === "approved" || n.status === "fulfilled";
          return (
            <li key={n._id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <MaterialImage itemKey={n.itemKey} alt="" className="size-11 shrink-0 border border-border" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[17px] font-semibold">{name}</span>
                    {n.editedByCoordinator ? (
                      <Chip tone="gold">{t("field.pv.editedByCoord")}</Chip>
                    ) : n.diff === "edited" ? (
                      <Chip tone="neutral">{t("field.pv.changedFromDraft")}</Chip>
                    ) : n.diff === "added" ? (
                      <Chip tone="neutral">{t("field.pv.addedInReview")}</Chip>
                    ) : null}
                    {n.status === "rejected" && <Chip tone="neutral">{t("field.pv.needRejected")}</Chip>}
                    {n.status === "draft" && data.project.isPublic && <Chip tone="neutral">{t("field.pv.needNotPublished")}</Chip>}
                  </div>
                  {n.draft && n.diff === "edited" && (
                    <p className="mt-1 text-sm text-muted">
                      {t("field.pv.draftWas")} <span className="line-through decoration-1">{pick(n.draft.nameEs, n.draft.nameEn)} · {qty(n.draft.quantity, n.draft.unit)}</span>
                      {" → "}
                      <span className="text-foreground">{qty(n.requestedQty, n.unit)}</span>
                    </p>
                  )}
                </div>
              </div>
              {published && n.status !== "rejected" && (
                <div className="mt-3">
                  <LedgerBar ledger={n.ledger} unit={n.unit} compact showAvailable={false} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {data.removedFromDraft.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-semibold text-muted">{t("field.pv.removedFromDraft")}</h3>
          <ul className="mt-1 text-sm text-muted">
            {data.removedFromDraft.map((m, i) => (
              <li key={i} className="line-through decoration-1">
                {pick(m.nameEs, m.nameEn)} · {qty(m.quantity, m.unit)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

const PHOTO_TONE: Record<string, ChipTone> = { pending: "gold", public: "emerald", private: "neutral" };

function photoState(ph: FieldProject["photos"][number]): "pending" | "public" | "private" {
  if (ph.visibility === "publicApproved" && ph.reviewStatus === "approved") return "public";
  if (ph.reviewStatus === "pending") return "pending";
  return "private";
}

function YourReport({ data }: { data: FieldProject }) {
  const { t, pick } = useI18n();
  const [translated, setTranslated] = useState(false);
  const r = data.report;
  const d = r?.draft;
  const text = r ? (translated && r.transcriptTranslated ? r.transcriptTranslated : r.transcriptOriginal) : "";
  return (
    <Card className="space-y-5">
      <h2 className={sectionTitle}>{t("field.pv.yourReport")}</h2>
      {r && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {t("field.transcript")}{" "}
              <span className="font-normal text-muted">
                ({(translated ? (r.language === "es" ? "en" : "es") : r.language) === "es" ? "Español" : "English"})
              </span>
            </h3>
            {r.transcriptTranslated && (
              <button
                type="button"
                aria-pressed={translated}
                className={btn("quiet", "md", "min-h-11 text-[15px]")}
                onClick={() => setTranslated((v) => !v)}
              >
                {translated ? t("field.pv.showOriginal") : t("field.pv.showTranslation")}
              </button>
            )}
          </div>
          <blockquote className="mt-2 border-l-2 border-rule bg-paper px-4 py-3 font-display text-[16px] italic leading-relaxed">
            {text ? `“${text}”` : t("field.pv.noTranscript")}
          </blockquote>
        </section>
      )}
      {d && (
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{d.source === "fallback" ? t("field.pv.aiFallback") : t("field.pv.aiDraft")}</h3>
            {d.source !== "fallback" && <AiBadge />}
          </div>
          <p className="mt-2 font-semibold">{pick(d.titleEs, d.titleEn)}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">{pick(d.summaryEs, d.summaryEn)}</p>
          {d.materials.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-[15px]">
              {d.materials.map((m, i) => (
                <li key={i}>
                  {pick(m.nameEs, m.nameEn)} · {m.quantity ?? "?"} {m.unit}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section>
        <h3 className="text-sm font-semibold">{t("field.pv.photos")}</h3>
        {data.photos.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t("field.pv.photos.none")}</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.photos.map((ph) => {
              const st = photoState(ph);
              return (
                <li key={ph._id} className="border border-border bg-paper">
                  <div className="relative aspect-square overflow-hidden">
                    {ph.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ph.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                    {st !== "public" && (
                      <span className="absolute left-1 top-1 bg-[#0b2a5b]/80 p-1 text-white">
                        <LockIcon className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 p-1.5">
                    <Chip tone={PHOTO_TONE[st]} className="text-[11px]">
                      {t(`field.pv.photo.${st}` as DictKey)}
                    </Chip>
                    {ph.isCover && <Chip className="text-[11px]">{t("field.pv.photo.cover")}</Chip>}
                    {ph.fromFollowUp && <Chip className="text-[11px]">{t("field.pv.photo.followUp")}</Chip>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function PrivateReadOnly({ priv }: { priv: FieldProject["private"] }) {
  const { t } = useI18n();
  const rows: { label: DictKey; value: string }[] = priv
    ? [
        { label: "field.private.name", value: priv.beneficiaryName },
        { label: "field.private.contact", value: priv.contact },
        { label: "field.private.address", value: priv.privateAddress },
        { label: "field.private.notes", value: priv.privateNotes },
      ].filter((r) => r.value) as { label: DictKey; value: string }[]
    : [];
  return (
    <section aria-labelledby="pv-private" className="rounded-[2px] border border-rule bg-paper p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-rule bg-surface">
            <LockIcon className="h-5 w-5" />
          </span>
          <h2 id="pv-private" className="font-display text-xl font-normal leading-tight">
            {t("field.private.title")}
          </h2>
        </div>
        <Chip tone="navy" className="mt-2.5 shrink-0">
          <LockIcon className="h-3 w-3" />
          {t("field.private.badge")}
        </Chip>
      </div>
      <p className="mt-3 text-sm text-muted">{t("field.pv.private.readonly")}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[15px] italic text-muted">{t("field.pv.private.none")}</p>
      ) : (
        <dl className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-sm font-semibold">{t(r.label)}</dt>
              <dd className="whitespace-pre-wrap text-[15px]">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

const FU_TONE: Record<string, ChipTone> = { pending: "gold", approved: "emerald", rejected: "neutral" };

function FollowUps({ data }: { data: FieldProject }) {
  const { t, pick, locale } = useI18n();
  const fmt = useFmt();
  const { sessionToken } = useSession();
  const genUrl = useMutation(api.field.generateUploadUrl);
  const addFollowUp = useMutation(api.field.addFollowUp);
  const [lang, setLang] = useState<"es" | "en">(locale);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState<"photo" | "send" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    setBusy("photo");
    setMsg(null);
    try {
      const blob = await prepareImageForUpload(f); // EXIF/GPS stripped, compressed
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      console.error(e);
      setMsg({ kind: "error", text: t("field.photos.failed") });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async () => {
    if (!sessionToken) return;
    if (!note.trim() && !photo) {
      setMsg({ kind: "error", text: t("field.fu.empty") });
      return;
    }
    setBusy("send");
    setMsg(null);
    try {
      const photoStorageId = photo
        ? ((await uploadFile(await genUrl({ sessionToken }), photo.blob)) as Id<"_storage">)
        : undefined;
      await addFollowUp({
        sessionToken,
        projectId: data.project._id,
        ...(lang === "es" ? { noteEs: note } : { noteEn: note }),
        photoStorageId,
      });
      setNote("");
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto(null);
      setMsg({ kind: "ok", text: t("field.fu.sent") });
    } catch (e) {
      const code = e instanceof ConvexError ? (e.data as { code?: string })?.code : undefined;
      if (code !== "EMPTY_FOLLOW_UP") console.error(e);
      setMsg({ kind: "error", text: code === "EMPTY_FOLLOW_UP" ? t("field.fu.empty") : t("field.error") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className={sectionTitle}>{t("field.fu.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("field.fu.intro")}</p>
      </div>
      <div className="grid grid-cols-2 border border-rule [&>*+*]:border-l [&>*+*]:border-rule">
        {(["es", "en"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={segCls(lang === l)}>
            {l === "es" ? "Español" : "English"}
          </button>
        ))}
      </div>
      <label className="block text-sm font-semibold">
        {t("field.fu.note")}
        <textarea
          rows={4}
          lang={lang}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("field.fu.placeholder")}
          className={`${inputCls} mt-1.5 font-normal`}
        />
      </label>
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          id="fu-photo"
          onChange={(e) => void pickPhoto(e.target.files?.[0])}
        />
        {photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="size-20 border border-border object-cover" />
            <button
              type="button"
              className={btn("quiet", "md", "min-h-11 text-[15px]")}
              onClick={() => {
                URL.revokeObjectURL(photo.url);
                setPhoto(null);
              }}
            >
              {t("field.fu.photoRemove")}
            </button>
          </div>
        ) : (
          <label htmlFor="fu-photo" className={`${btnSecondary} w-full cursor-pointer`}>
            {busy === "photo" ? <Spinner /> : null}
            {busy === "photo" ? t("field.photos.processing") : t("field.fu.photo")}
          </label>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-muted">
          <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("field.photos.metaStripped")}
        </p>
      </div>
      <button type="button" className={`${btnPrimary} w-full`} disabled={busy !== null} onClick={() => void send()}>
        {busy === "send" ? <Spinner /> : null}
        {busy === "send" ? t("field.fu.sending") : t("field.fu.send")}
      </button>
      {msg && (
        <p role="status" className={msg.kind === "ok" ? "border-l-2 border-emerald bg-emerald-soft px-4 py-3 text-[15px] text-emerald" : noticeCls}>
          {msg.text}
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold">{t("field.fu.list")}</h3>
        {data.followUps.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t("field.fu.none")}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {data.followUps.map((f) => (
              <FollowUpItem key={f._id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <time className="text-[13px] text-muted tabular-nums">{fmt(f.createdAt)}</time>
                  <Chip tone={FU_TONE[f.status]}>{t(`field.fu.status.${f.status}` as DictKey)}</Chip>
                </div>
                {(f.noteEs || f.noteEn) && <p className="mt-1.5 text-[15px] leading-relaxed">{pick(f.noteEs ?? undefined, f.noteEn ?? undefined)}</p>}
                {f.photo?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.photo.url} alt="" className="mt-2 aspect-[4/3] w-full max-w-xs border border-border object-cover" />
                )}
              </FollowUpItem>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function FollowUpItem({ children }: { children: ReactNode }) {
  return <li className="border border-border bg-paper p-3">{children}</li>;
}
