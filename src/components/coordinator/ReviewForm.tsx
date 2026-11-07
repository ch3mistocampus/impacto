"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, Label, Section, inputCls, useAction } from "./ui";
import { MaterialIcon } from "./MaterialIcon";
import { containsPrivate, suggestAlias, type ReviewData, type ReviewNeed } from "./types";

export function ReviewForm({ data }: { data: ReviewData }) {
  const { t, locale } = useI18n();
  const { sessionToken, user } = useSession();
  const p = data.project;
  const beneficiary = data.private?.beneficiaryName ?? null;
  const address = data.private?.privateAddress ?? null;

  const [form, setForm] = useState(() => ({
    publicAlias: p.publicAlias?.trim() || suggestAlias(p.category, p.projectId, locale),
    titleEs: p.titleEs,
    titleEn: p.titleEn,
    summaryEs: p.summaryEs,
    summaryEn: p.summaryEn,
  }));
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const aliasHasName = containsPrivate(form.publicAlias, beneficiary);
  const aliasHasAddress = containsPrivate(form.publicAlias, address, 5);
  const leaks = {
    titleEs: containsPrivate(form.titleEs, beneficiary),
    titleEn: containsPrivate(form.titleEn, beneficiary),
    summaryEs: containsPrivate(form.summaryEs, beneficiary),
    summaryEn: containsPrivate(form.summaryEn, beneficiary),
  };
  const anyLeak = aliasHasName || Object.values(leaks).some(Boolean);
  const missing = Object.values(form).some((v) => !v.trim());

  const publish = useMutation(api.coordinator.approveAndPublish);
  const requestChanges = useMutation(api.coordinator.requestChanges);
  const { busy, run } = useAction();
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");

  const approvedNeeds = data.needs.filter((n) => n.status === "approved" && n.requestedQty !== null && !n.needsConfirmation);
  const canEdit = p.status === "in_review" || p.status === "draft";

  return (
    <div className="space-y-5">
      <Section title={t("coord.publicForm")}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="alias">{t("coord.alias")}</Label>
            <div className="flex gap-2">
              <input
                id="alias"
                value={form.publicAlias}
                onChange={(e) => set("publicAlias")(e.target.value)}
                aria-invalid={aliasHasName || undefined}
                aria-describedby="alias-hint"
                className={`${inputCls} font-display text-xl! font-normal ${aliasHasName ? "border-red! shadow-[inset_0_0_0_1px_var(--red)]" : ""}`}
              />
              <Button type="button" size="sm" onClick={() => set("publicAlias")(suggestAlias(p.category, p.projectId, locale))}>
                {t("coord.alias.suggest")}
              </Button>
            </div>
            <p id="alias-hint" className="mt-1.5 text-[13px] text-muted">
              {t("coord.alias.hint")}
            </p>
            {aliasHasName && <Warn>{t("coord.alias.warnName")}</Warn>}
            {!aliasHasName && aliasHasAddress && <Warn>{t("coord.alias.warnAddress")}</Warn>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="titleEs" label={t("coord.titleEs")} value={form.titleEs} onChange={set("titleEs")} leak={leaks.titleEs} lang="es" />
            <TextField id="titleEn" label={t("coord.titleEn")} value={form.titleEn} onChange={set("titleEn")} leak={leaks.titleEn} lang="en" />
            <TextField id="summaryEs" label={t("coord.summaryEs")} value={form.summaryEs} onChange={set("summaryEs")} leak={leaks.summaryEs} lang="es" multiline />
            <TextField id="summaryEn" label={t("coord.summaryEn")} value={form.summaryEn} onChange={set("summaryEn")} leak={leaks.summaryEn} lang="en" multiline />
          </div>
        </div>
      </Section>

      <NeedsEditor needs={data.needs} />

      {canEdit && (
        <div className="sticky bottom-3 z-20 rounded-[2px] border border-rule bg-surface/95 p-3 backdrop-blur sm:p-4">
          {approvedNeeds.length === 0 && <p className="mb-2 text-[13px] font-semibold text-gold-ink">{t("coord.need.noneApproved")}</p>}
          {changesOpen && (
            <div className="mb-3">
              <Label htmlFor="changes">{t("coord.requestChanges")}</Label>
              <textarea
                id="changes"
                rows={2}
                value={changesNote}
                onChange={(e) => setChangesNote(e.target.value)}
                placeholder={t("coord.requestChanges.placeholder")}
                className={inputCls}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              disabled={anyLeak || missing || !sessionToken}
              busy={busy === "publish"}
              onClick={() =>
                sessionToken &&
                run(
                  "publish",
                  () => publish({ sessionToken, projectId: p.projectId, ...form }),
                  `${t("coord.published.toast")}: ${form.publicAlias}`,
                  user ? `${t("coord.verifiedBy")} ${user.name}` : undefined,
                )
              }
            >
              {t("coord.approvePublish")}
            </Button>
            {p.status === "in_review" &&
              (changesOpen ? (
                <>
                  <Button
                    variant="danger"
                    busy={busy === "changes"}
                    onClick={async () => {
                      if (!sessionToken) return;
                      const ok = await run(
                        "changes",
                        () => requestChanges({ sessionToken, projectId: p.projectId, note: changesNote.trim() || undefined }),
                        t("coord.requestChanges.toast"),
                      );
                      if (ok) setChangesOpen(false);
                    }}
                  >
                    {t("coord.confirm")}
                  </Button>
                  <Button variant="quiet" onClick={() => setChangesOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setChangesOpen(true)}>
                  {t("coord.requestChanges")}
                </Button>
              ))}
            {user && (
              <span className="ml-auto text-[13px] text-muted">
                {t("coord.youWillSign")} <strong className="text-foreground">{user.name}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 rounded-[2px] border-l-2 border-red bg-red-soft px-2.5 py-1.5 text-[13px] font-semibold text-red">
      {children}
    </p>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  leak,
  lang,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  leak: boolean;
  lang: string;
  multiline?: boolean;
}) {
  const { t } = useI18n();
  const cls = `${inputCls} ${leak ? "border-red! shadow-[inset_0_0_0_1px_var(--red)]" : ""}`;
  return (
    <div className={multiline ? "sm:col-span-1" : ""}>
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <textarea id={id} lang={lang} rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={cls} aria-invalid={leak || undefined} />
      ) : (
        <input id={id} lang={lang} value={value} onChange={(e) => onChange(e.target.value)} className={cls} aria-invalid={leak || undefined} />
      )}
      {leak && <Warn>{t("coord.textWarnName")}</Warn>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NeedsEditor({ needs }: { needs: ReviewNeed[] }) {
  const { t } = useI18n();
  return (
    <Section title={t("coord.materials")}>
      {needs.length === 0 ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <ul className="-my-2 divide-y divide-border">
          {needs.map((n) => (
            <NeedRow key={n.needId} need={n} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function NeedRow({ need }: { need: ReviewNeed }) {
  const { t, pick } = useI18n();
  const { sessionToken } = useSession();
  const update = useMutation(api.coordinator.updateNeed);
  const { busy, run } = useAction();
  const [qty, setQty] = useState(need.requestedQty === null ? "" : String(need.requestedQty));
  const name = pick(need.nameEs, need.nameEn);
  const parsed = qty.trim() === "" ? null : Number(qty);
  const validQty = parsed === null || (Number.isInteger(parsed) && parsed > 0);
  const dirty = parsed !== need.requestedQty;
  const rejected = need.status === "rejected";

  const saveQty = () => {
    if (!sessionToken || !validQty) return;
    return run(
      "qty",
      () => update({ sessionToken, needId: need.needId, requestedQty: parsed }),
      `${t("coord.need.saved")}: ${parsed ?? "?"} ${name}`,
    );
  };
  const setStatus = (status: "approved" | "rejected" | "draft") =>
    sessionToken &&
    run(
      status,
      () => update({ sessionToken, needId: need.needId, status }),
      `${name}: ${t(`coord.need.${status}` as DictKey)}`,
    );

  return (
    <li className={`flex flex-col gap-3 py-3.5 xl:flex-row xl:items-center ${rejected ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MaterialIcon itemKey={need.itemKey} label={name} />
        <div className="min-w-0">
          <p className={`text-[15px] font-semibold ${rejected ? "line-through" : ""}`}>{name}</p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {need.aiSuggested && (
              <Chip tone="navy">
                <span aria-hidden className="font-display italic">IA</span>
                {t("coord.need.aiSuggested")}
              </Chip>
            )}
            {need.needsConfirmation && <Chip tone="gold">{t("ledger.needsConfirmation")}</Chip>}
            <Chip tone={need.status === "approved" ? "emerald" : "neutral"}>
              {t(`coord.need.${need.status}` as DictKey)}
            </Chip>
          </div>
        </div>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveQty();
        }}
      >
        <label className="sr-only" htmlFor={`qty-${need.needId}`}>
          {t("coord.qty")} — {name}
        </label>
        <input
          id={`qty-${need.needId}`}
          inputMode="numeric"
          value={qty}
          placeholder="?"
          onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
          className={`${inputCls} w-20! text-right font-display text-lg! tabular-nums ${need.needsConfirmation && !qty ? "border-gold! shadow-[inset_0_0_0_1px_var(--gold)]" : ""}`}
          disabled={rejected}
        />
        <span className="w-20 truncate text-sm text-muted" title={need.unit}>{need.unit}</span>
        {(dirty || (need.needsConfirmation && parsed !== null)) && (
          <Button type="submit" size="sm" variant="ghost" busy={busy === "qty"} disabled={!validQty || parsed === null}>
            {need.needsConfirmation ? t("coord.need.confirmQty") : t("common.save")}
          </Button>
        )}
      </form>

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={need.status === "approved" ? "leaf" : "ghost"}
          aria-pressed={need.status === "approved"}
          busy={busy === "approved" || busy === "draft"}
          onClick={() => setStatus(need.status === "approved" ? "draft" : "approved")}
        >
          {need.status === "approved" ? `✓ ${t("coord.need.approved")}` : t("coord.need.approve")}
        </Button>
        <Button
          size="sm"
          variant="danger"
          aria-pressed={rejected}
          busy={busy === "rejected"}
          onClick={() => setStatus(rejected ? "draft" : "rejected")}
        >
          {rejected ? t("coord.need.draft") : t("coord.need.reject")}
        </Button>
      </div>
    </li>
  );
}
