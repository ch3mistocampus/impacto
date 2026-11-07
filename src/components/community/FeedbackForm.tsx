"use client";

import { useId, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { btn, inputCls, labelCls } from "@/components/ui/tricolor";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const KINDS = ["question", "concern", "thanks", "suggestion"] as const;
type Kind = (typeof KINDS)[number];
const MAX = 2000;

/**
 * Community feedback form. Language follows the UI locale. The server redacts phone numbers,
 * emails and street addresses before storing; contact (optional) is coordinator-only.
 */
export function FeedbackForm({ fixedProjectId }: { fixedProjectId?: Id<"projects"> }) {
  const { t, pick, locale } = useI18n();
  const { sessionToken } = useSession();
  const submit = useMutation(api.community.submitFeedback);
  const projects = useQuery(api.public.listPublishedProjects, fixedProjectId ? "skip" : {});
  const id = useId();

  const [kind, setKind] = useState<Kind>("question");
  const [projectId, setProjectId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ redacted: number } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const msg = message.trim();
    if (!msg) return setError(t("community.form.empty"));
    if (msg.length > MAX) return setError(t("community.form.tooLong"));
    setBusy(true);
    setError(null);
    try {
      const pid = (fixedProjectId ?? (projectId || undefined)) as Id<"projects"> | undefined;
      const res = await submit({
        kind,
        message: msg,
        language: locale,
        ...(pid ? { projectId: pid } : {}),
        ...(contact.trim() ? { contactPrivate: contact.trim() } : {}),
        ...(sessionToken ? { sessionToken } : {}),
      });
      setDone({ redacted: res.redactedCount });
      setMessage("");
      setContact("");
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string })?.code : null;
      setError(code === "MESSAGE_TOO_LONG" ? t("community.form.tooLong") : t("community.form.error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="border-l-2 border-emerald bg-emerald-soft px-4 py-4">
        <p className="font-display text-2xl">{t("community.form.thanksTitle")}</p>
        <p className="mt-1 text-[15px]">{t("community.form.thanksBody")}</p>
        {done.redacted > 0 && (
          <p className="mt-2 text-sm font-semibold text-gold-ink">
            {t("community.form.redacted").replace("{n}", String(done.redacted))}
          </p>
        )}
        <button type="button" onClick={() => setDone(null)} className={btn("secondary", "sm", "mt-4")}>
          {t("community.form.another")}
        </button>
      </div>
    );
  }

  const published = (projects ?? []).filter((p) => p.status === "published");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <p className="border-l-2 border-gold bg-gold-soft px-3 py-2.5 text-[15px] font-semibold text-gold-ink">
        {t("community.form.guidance")}
      </p>

      <fieldset>
        <legend className={labelCls}>{t("community.form.kind")}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[2px] px-3 text-[15px] ${
                kind === k
                  ? "bg-navy font-semibold text-on-navy"
                  : "bg-surface shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--rule)]"
              }`}
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {t(`community.kind.${k}` as DictKey)}
            </label>
          ))}
        </div>
      </fieldset>

      {!fixedProjectId && (
        <label className="block">
          <span className={labelCls}>{t("community.form.project")}</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">{t("community.form.projectNone")}</option>
            {published.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.publicAlias} · {pick(p.titleEs, p.titleEn)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className={labelCls}>{t("community.form.message")}</span>
        <textarea
          required
          rows={5}
          value={message}
          maxLength={MAX}
          onChange={(e) => setMessage(e.target.value)}
          aria-describedby={`${id}-msg-hint`}
          className={`${inputCls} min-h-32 py-3`}
        />
        <span id={`${id}-msg-hint`} className="mt-1 flex justify-between text-xs text-muted">
          <span>{t("community.form.messageHint")}</span>
          <span className="tabular-nums">
            {message.length}/{MAX}
          </span>
        </span>
      </label>

      <label className="block">
        <span className={labelCls}>{t("community.form.contact")}</span>
        <input
          value={contact}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => setContact(e.target.value)}
          aria-describedby={`${id}-contact-hint`}
          className={inputCls}
        />
        <span id={`${id}-contact-hint`} className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-navy">
          <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="7" width="10" height="7" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" />
          </svg>
          {t("community.form.contactPrivate")}
        </span>
      </label>

      <p className="text-sm text-muted">
        {t("community.form.language")} <strong className="text-foreground">{t(`community.lang.${locale}` as DictKey)}</strong>
      </p>

      {error && (
        <p role="alert" className="border-l-2 border-red bg-red-soft px-3 py-2 text-sm font-semibold text-red">
          {error}
        </p>
      )}

      <div>
        <button type="submit" disabled={busy} aria-busy={busy || undefined} className={btn("primary", "lg", "w-full sm:w-auto")}>
          {busy ? t("community.form.sending") : t("community.form.submit")}
        </button>
        <p className="mt-2 text-xs text-muted">{t("community.form.roadmap")}</p>
      </div>
    </form>
  );
}
