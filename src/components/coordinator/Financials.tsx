"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { intlLocale } from "@/components/ui/tricolor";
import { Button, Chip, Label, Section, Skeleton, formatDate, inputCls, useAction } from "./ui";
import { uploadEvidenceFile, EVIDENCE_ACCEPT } from "./upload";
import type { FinancialsData } from "./types";

const CURRENCIES = ["USD", "COP"] as const;
const CONTRIB_STATUS = ["committed", "received", "allocated"] as const;
const EXPENSE_CATS = ["materials", "labor", "transport", "tools", "other"] as const;

export function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Non-ISO free-text currency: show as recorded.
    return `${amount.toLocaleString(intlLocale(locale))} ${currency}`;
  }
}

/** Project-scoped (projectId) or organization-wide (no projectId). */
export function FinancialsPanel({ projectId }: { projectId?: Id<"projects"> }) {
  const { t } = useI18n();
  const { sessionToken } = useSession();
  const data = useQuery(api.coordinator.financials, sessionToken ? { sessionToken, projectId } : "skip");

  return (
    <div className="space-y-5">
      <Section title={projectId ? t("coord.fin.title") : t("coord.fin.overall")}>
        <p className="mb-4 max-w-prose text-sm text-muted">{t("coord.fin.note")}</p>
        {data === undefined ? <Skeleton rows={1} /> : <Totals data={data} />}
      </Section>
      <div className={projectId ? "grid gap-5 lg:grid-cols-2" : "grid gap-5"}>
        <ContributionForm projectId={projectId} />
        {projectId && <ExpenseForm projectId={projectId} />}
      </div>
      {data !== undefined && <Records data={data} showProject={!projectId} />}
    </div>
  );
}

function Totals({ data }: { data: FinancialsData }) {
  const { t, locale } = useI18n();
  if (data.totals.length === 0) return <p className="text-sm text-muted">{t("coord.fin.empty")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-y border-rule text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[13px] text-muted">
            <th className="py-2 pr-3 font-semibold">{t("coord.fin.currency")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("coord.fin.received")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("coord.fin.allocated")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("coord.fin.spent")}</th>
            <th className="py-2 text-right font-semibold text-gold-ink">{t("coord.fin.committed")}</th>
          </tr>
        </thead>
        <tbody className="font-display text-lg tabular-nums">
          {data.totals.map((r) => (
            <tr key={r.currency} className="border-b border-border last:border-0">
              <th scope="row" className="py-3 pr-3 text-left text-xl font-normal">
                {r.currency}
              </th>
              <td className="py-3 pr-3 text-right">{formatMoney(r.received, r.currency, locale)}</td>
              <td className="py-3 pr-3 text-right">{formatMoney(r.allocated, r.currency, locale)}</td>
              <td className="py-3 pr-3 text-right">{formatMoney(r.spent, r.currency, locale)}</td>
              <td className="py-3 text-right text-gold-ink">{formatMoney(r.committed, r.currency, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CurrencyPicker({ id, value, onChange }: { id: string; value: string; onChange: (c: string) => void }) {
  const { t } = useI18n();
  const isPreset = (CURRENCIES as readonly string[]).includes(value);
  const [other, setOther] = useState(!isPreset);
  return (
    <div>
      <Label htmlFor={id}>{t("coord.fin.currency")}</Label>
      <div className="flex gap-2">
        <select
          id={id}
          value={other ? "__other" : value}
          onChange={(e) => {
            if (e.target.value === "__other") {
              setOther(true);
              onChange("");
            } else {
              setOther(false);
              onChange(e.target.value);
            }
          }}
          className={`${inputCls} w-28!`}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__other">{t("coord.fin.currency.other")}</option>
        </select>
        {other && (
          <input
            aria-label={t("coord.fin.currency.code")}
            placeholder={t("coord.fin.currency.code")}
            value={value}
            maxLength={3}
            onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            className={`${inputCls} w-32!`}
          />
        )}
      </div>
    </div>
  );
}

function parseAmount(s: string) {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ContributionForm({ projectId }: { projectId?: Id<"projects"> }) {
  const { t } = useI18n();
  const { sessionToken, user } = useSession();
  const record = useMutation(api.coordinator.recordContribution);
  const { busy, run } = useAction();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<(typeof CONTRIB_STATUS)[number]>("received");
  const [donorName, setDonorName] = useState("");
  const [ref, setRef] = useState("");
  const n = parseAmount(amount);
  const valid = n !== null && /^[A-Z]{3}$/.test(currency);
  const id = `contrib-${projectId ?? "org"}`;

  return (
    <Section title={t("coord.fin.contribution")}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!sessionToken || !valid || n === null) return;
          const ok = await run(
            "c",
            () =>
              record({
                sessionToken,
                projectId,
                amount: n,
                currency: currency.trim(),
                status,
                donorName: donorName.trim() || undefined,
                externalReference: ref.trim() || undefined,
              }),
            t("coord.fin.contribution.toast"),
            user ? `${t("coord.verifiedBy")} ${user.name}` : undefined,
          );
          if (ok) {
            setAmount("");
            setDonorName("");
            setRef("");
          }
        }}
      >
        <div className="flex flex-wrap gap-3">
          <div>
            <Label htmlFor={`${id}-amt`}>{t("coord.fin.amount")}</Label>
            <input
              id={`${id}-amt`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              className={`${inputCls} w-36! text-right font-display text-lg! tabular-nums`}
            />
          </div>
          <CurrencyPicker id={`${id}-cur`} value={currency} onChange={setCurrency} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-foreground">{t("coord.fin.status")}</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("coord.fin.status")}>
            {/* Server rule: "allocated" requires a project. */}
            {CONTRIB_STATUS.filter((s) => projectId || s !== "allocated").map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                className={`min-h-9 rounded-[2px] px-3 text-[13px] font-semibold transition-colors ${
                  status === s
                    ? "bg-navy text-on-navy"
                    : "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--border)] hover:text-foreground hover:shadow-[inset_0_0_0_1px_var(--rule)]"
                }`}
              >
                {t(`coord.fin.status.${s}` as DictKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${id}-donor`}>{t("coord.fin.donorName")}</Label>
            <input id={`${id}-donor`} value={donorName} onChange={(e) => setDonorName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <Label htmlFor={`${id}-ref`}>{t("coord.fin.reference")}</Label>
            <input id={`${id}-ref`} value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} />
          </div>
        </div>
        <Button type="submit" variant="primary" busy={busy === "c"} disabled={!valid}>
          {t("coord.fin.contribution")}
        </Button>
      </form>
    </Section>
  );
}

function ExpenseForm({ projectId }: { projectId: Id<"projects"> }) {
  const { t } = useI18n();
  const { sessionToken, user } = useSession();
  const record = useMutation(api.coordinator.recordExpense);
  const genUrl = useMutation(api.coordinator.generateEvidenceUploadUrl);
  const { busy, run } = useAction();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState<(typeof EXPENSE_CATS)[number]>("materials");
  const [region, setRegion] = useState("");
  const [localLabor, setLocalLabor] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const n = parseAmount(amount);
  const valid = n !== null && /^[A-Z]{3}$/.test(currency);
  const id = `exp-${projectId}`;

  return (
    <Section title={t("coord.fin.expense")}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!sessionToken || !valid || n === null) return;
          const ok = await run(
            "x",
            async () => {
              const receiptStorageId = file ? await uploadEvidenceFile(file, () => genUrl({ sessionToken })) : undefined;
              await record({
                sessionToken,
                projectId,
                amount: n,
                currency: currency.trim(),
                category,
                supplierRegion: region.trim() || undefined,
                localLabor,
                receiptStorageId,
              });
            },
            t("coord.fin.expense.toast"),
            user ? `${t("coord.verifiedBy")} ${user.name}` : undefined,
          );
          if (ok) {
            setAmount("");
            setRegion("");
            setLocalLabor(false);
            setFile(null);
            setFileKey((k) => k + 1);
          }
        }}
      >
        <div className="flex flex-wrap gap-3">
          <div>
            <Label htmlFor={`${id}-amt`}>{t("coord.fin.amount")}</Label>
            <input
              id={`${id}-amt`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              className={`${inputCls} w-36! text-right font-display text-lg! tabular-nums`}
            />
          </div>
          <CurrencyPicker id={`${id}-cur`} value={currency} onChange={setCurrency} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${id}-cat`}>{t("coord.fin.category")}</Label>
            <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={inputCls}>
              {EXPENSE_CATS.map((c) => (
                <option key={c} value={c}>
                  {t(`coord.fin.cat.${c}` as DictKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-region`}>{t("coord.fin.supplierRegion")}</Label>
            <input id={`${id}-region`} value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--navy)]" checked={localLabor} onChange={(e) => setLocalLabor(e.target.checked)} />
          {t("coord.fin.localLabor")}
        </label>
        <div>
          <Label htmlFor={`${id}-file`}>{t("coord.fin.receipt")}</Label>
          <input
            key={fileKey}
            id={`${id}-file`}
            type="file"
            accept={EVIDENCE_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:min-h-9 file:rounded-[2px] file:border file:border-rule file:bg-surface file:px-3 file:text-sm file:font-semibold file:text-foreground"
          />
          <p className="mt-1 text-[13px] text-muted">{t("coord.ev.fileHint")}</p>
        </div>
        <Button type="submit" variant="primary" busy={busy === "x"} disabled={!valid}>
          {t("coord.fin.expense")}
        </Button>
      </form>
    </Section>
  );
}

function Records({ data, showProject }: { data: FinancialsData; showProject: boolean }) {
  const { t, locale } = useI18n();
  const { sessionToken, user } = useSession();
  const approve = useMutation(api.coordinator.approveExpense);
  const { busy, run } = useAction();
  const contribs = [...data.contributions].sort((a, b) => b.createdAt - a.createdAt);
  const expenses = [...data.expenses].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title={t("coord.fin.contributions")}>
        {contribs.length === 0 ? (
          <p className="text-sm text-muted">{t("coord.fin.empty")}</p>
        ) : (
          <ul className="-my-2 divide-y divide-border">
            {contribs.map((c) => (
              <li key={c.contributionId} className="py-2.5 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 truncate text-[15px] font-semibold">{c.donorName || "—"}</span>
                  <Chip tone={c.status === "committed" ? "gold" : "navy"}>{t(`coord.fin.status.${c.status}` as DictKey)}</Chip>
                  <span aria-hidden className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-muted/60" />
                  <span className={`shrink-0 font-display text-lg tabular-nums ${c.status === "committed" ? "text-gold-ink" : ""}`}>
                    {formatMoney(c.amount, c.currency, locale)}
                  </span>
                </div>
                <span className="block text-[13px] text-muted">
                  {c.externalReference && <>#{c.externalReference} — </>}
                  {showProject && <>{c.publicAlias ?? t("coord.fin.unassigned")} — </>}
                  {c.recordedByName ?? "—"}, {formatDate(c.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("coord.fin.expenses")}>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted">{t("coord.fin.empty")}</p>
        ) : (
          <ul className="-my-2 divide-y divide-border">
            {expenses.map((x) => (
              <li key={x.expenseId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
                <div className="flex w-full items-baseline gap-2">
                  <span className="min-w-0 truncate text-[15px] font-semibold">
                    {EXPENSE_CATS.includes(x.category as never) ? t(`coord.fin.cat.${x.category}` as DictKey) : x.category}
                  </span>
                  <span aria-hidden className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-muted/60" />
                  <span className="shrink-0 font-display text-lg tabular-nums">{formatMoney(x.amount, x.currency, locale)}</span>
                </div>
                <Chip tone={x.reviewStatus === "approved" ? "emerald" : x.reviewStatus === "rejected" ? "neutral" : "gold"}>
                  {t(
                    x.reviewStatus === "approved"
                      ? "coord.fin.approvedState"
                      : x.reviewStatus === "rejected"
                        ? "coord.fin.rejectedState"
                        : "coord.fin.pending",
                  )}
                </Chip>
                {x.localLabor && <Chip tone="navy">{t("coord.fin.localLabor")}</Chip>}
                {x.receiptUrl ? (
                  <a href={x.receiptUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-foreground underline decoration-1 underline-offset-4">
                    {t("coord.fin.receiptOk")} ↗
                  </a>
                ) : (
                  <span className="text-[13px] text-muted">{t("coord.fin.noReceipt")}</span>
                )}
                <span className="w-full text-[13px] text-muted">
                  {showProject && x.publicAlias && <>{x.publicAlias} — </>}
                  {x.supplierRegion && <>{x.supplierRegion} — </>}
                  {x.approvedByName && (
                    <>
                      {t("coord.verifiedBy")} {x.approvedByName} —{" "}
                    </>
                  )}
                  {formatDate(x.createdAt, locale)}
                </span>
                {x.reviewStatus === "pending" && (
                  <div className="flex w-full gap-2">
                    <Button
                      size="sm"
                      variant="leaf"
                      busy={busy === `a-${x.expenseId}`}
                      onClick={() =>
                        sessionToken &&
                        run(
                          `a-${x.expenseId}`,
                          () => approve({ sessionToken, expenseId: x.expenseId, approve: true }),
                          t("coord.fin.approved.toast"),
                          user ? `${t("coord.verifiedBy")} ${user.name}` : undefined,
                        )
                      }
                    >
                      {t("coord.fin.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      busy={busy === `r-${x.expenseId}`}
                      onClick={() =>
                        sessionToken &&
                        run(`r-${x.expenseId}`, () => approve({ sessionToken, expenseId: x.expenseId, approve: false }), t("coord.fin.rejected.toast"))
                      }
                    >
                      {t("coord.fin.reject")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
