"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { STAGE_TEXT, StageSwatch, stageFill } from "@/components/ui/tricolor";
import { Button, Chip, Label, Section, VerifyMark, formatDate, inputCls, useAction } from "./ui";
import { MaterialIcon } from "./MaterialIcon";
import { EvidenceAttach, emptyEvidence, evidenceState, syntheticEvidence, useCommitEvidence, type EvidenceDraft } from "./EvidenceAttach";
import type { ReviewData, ReviewNeed, ReviewPledge } from "./types";

type Stage = "requested" | "pledged" | "received" | "delivered" | "used" | "verified";
type Step = "received" | "delivered" | "used" | "verified";
const STAGES: Stage[] = ["requested", "pledged", "received", "delivered", "used", "verified"];
const STEPS: Step[] = ["received", "delivered", "used", "verified"];

const STEP_LABEL: Record<Step, DictKey> = {
  received: "coord.markReceived",
  delivered: "coord.markDelivered",
  used: "coord.markUsed2",
  verified: "coord.markVerified",
};
const STEP_TOAST: Record<Step, DictKey> = {
  received: "coord.received.toast",
  delivered: "coord.delivered.toast",
  used: "coord.used.toast",
  verified: "coord.verified.toast",
};

export function LedgerPanel({ data }: { data: ReviewData }) {
  const { t } = useI18n();
  const needs = data.needs.filter((n) => n.status === "approved" || n.status === "fulfilled");
  const byNeed = new Map<string, ReviewPledge[]>();
  for (const pl of data.pledges) {
    const arr = byNeed.get(pl.needId) ?? [];
    arr.push(pl);
    byNeed.set(pl.needId, arr);
  }
  return (
    <Section title={t("coord.ledger")}>
      <p className="mb-4 max-w-prose text-sm text-muted">{t("coord.ledger6.note")}</p>
      <ul aria-hidden className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted">
        {STAGES.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <StageSwatch stage={s} />
            {t(`coord.stage.${s}` as DictKey)}
          </li>
        ))}
      </ul>
      <style>{`
        @keyframes coord-num { from { transform: translateY(-4px); opacity: .2 } to { transform: none; opacity: 1 } }
        .coord-num { animation: coord-num 320ms ease-out }
        @media (prefers-reduced-motion: reduce) { .coord-num { animation: none } }
      `}</style>

      {needs.length === 0 ? (
        <p className="text-sm text-muted">{t("coord.need.noneApproved")}</p>
      ) : (
        <div className="space-y-6">
          {needs.map((n) => (
            <NeedLedger
              key={n.needId}
              need={n}
              projectId={data.project.projectId}
              isDemo={data.project.isDemo}
              pledges={byNeed.get(n.needId) ?? []}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function NeedLedger({
  need,
  projectId,
  isDemo,
  pledges,
}: {
  need: ReviewNeed;
  projectId: Id<"projects">;
  isDemo: boolean;
  pledges: ReviewPledge[];
}) {
  const { t, pick } = useI18n();
  const { sessionToken, user } = useSession();
  const record = useMutation(api.coordinator.recordMaterialEvent);
  const commitEvidence = useCommitEvidence();
  const { busy, run } = useAction();
  const [open, setOpen] = useState<Step | null>(null);
  const name = pick(need.nameEs, need.nameEn);
  const L = need.ledger;
  const activePledges = pledges.filter((p) => p.status === "active");
  const signed = user ? `${t("coord.verifiedBy")} ${user.name}` : undefined;

  // Each step is capped by the previous stage.
  const caps: Record<Exclude<Step, "received">, number> = {
    delivered: Math.max(0, L.received - L.delivered),
    used: Math.max(0, L.delivered - L.used),
    verified: Math.max(0, L.used - L.verified),
  };
  const openPledgeQty = activePledges.reduce((s, p) => s + Math.max(0, p.qty - p.receivedQty), 0);
  // The step the demo should click next: the furthest-along stage with something waiting.
  const next: Step | null =
    caps.verified > 0 ? "verified" : caps.used > 0 ? "used" : caps.delivered > 0 ? "delivered" : openPledgeQty > 0 ? "received" : null;

  const doRecord = async (
    key: string,
    args: { eventType: Step; qty: number; pledgeId?: Id<"pledges">; noteEs?: string; noteEn?: string },
    evidence?: EvidenceDraft,
  ) => {
    if (!sessionToken) return false;
    const ok = await run(
      key,
      async () => {
        const evidenceId = evidence ? await commitEvidence(evidence, { projectId, needId: need.needId }) : undefined;
        await record({ sessionToken, needId: need.needId, ...args, evidenceId });
      },
      `${t(STEP_TOAST[args.eventType])}: ${args.qty} ${name}`,
      signed,
    );
    if (ok) setOpen(null);
    return ok;
  };

  const values: Record<Stage, number | null> = {
    requested: L.requested,
    pledged: L.pledged,
    received: L.received,
    delivered: L.delivered,
    used: L.used,
    verified: L.verified,
  };

  return (
    <article id={`need-${need.needId}`} className="scroll-mt-24 rounded-[2px] border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-5">
        <MaterialIcon itemKey={need.itemKey} label={name} size={48} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-normal leading-tight">{name}</h3>
          <p className="text-[13px] text-muted">{need.unit}</p>
        </div>
        {need.status === "fulfilled" && <Chip tone="navy">{t("coord.need.fulfilled")}</Chip>}
        {need.needsConfirmation && <Chip tone="gold">{t("ledger.needsConfirmation")}</Chip>}
      </header>

      {/* Six separate numbers — never summed into each other. */}
      <dl className="mt-4 grid grid-cols-3 border-y border-rule sm:grid-cols-6">
        {STAGES.map((s, i) => (
          <Num
            key={s}
            stage={s}
            label={t(`coord.stage.${s}` as DictKey)}
            value={values[s]}
            className={`${i % 3 !== 2 ? "border-r" : "sm:border-r"} ${i < 3 ? "border-b sm:border-b-0" : ""} ${i === 5 ? "sm:border-r-0" : ""}`}
          />
        ))}
      </dl>
      <FlowBar values={values} />

      {/* The four staff steps, in order. */}
      <p className="px-4 pt-4 font-display text-[15px] italic text-muted sm:px-5">{t("coord.ledger.steps")}</p>
      <div className="grid grid-cols-2 gap-2 px-4 pt-2 sm:grid-cols-4 sm:px-5">
        {STEPS.map((s) => {
          const cap = s === "received" ? null : caps[s];
          const disabled = cap === 0;
          const isNext = next === s;
          const isOpen = open === s;
          return (
            <Button
              key={s}
              size="sm"
              variant={isOpen || isNext ? (s === "verified" ? "leaf" : "primary") : "ghost"}
              aria-expanded={isOpen}
              disabled={disabled}
              title={disabled ? t(`coord.cap.none.${s}` as DictKey) : undefined}
              onClick={() => setOpen(isOpen ? null : s)}
              className="justify-start! text-left"
            >
              <StageSwatch stage={s} className="shadow-[0_0_0_1px_var(--surface)]" />
              <span className="min-w-0 flex-1 py-1 leading-tight">{t(STEP_LABEL[s])}</span>
              {cap !== null && cap > 0 && <span className="font-display text-base font-normal tabular-nums">{cap}</span>}
            </Button>
          );
        })}
      </div>
      {next === null && L.received > 0 && (
        <p className="flex items-center gap-1.5 px-4 pt-2 text-[13px] font-semibold text-emerald sm:px-5">
          <VerifyMark />
          {t("coord.allVerified")}
        </p>
      )}

      {open === "received" && (
        <ReceiveForm
          pledges={activePledges}
          unit={need.unit}
          busy={busy === "received"}
          onSubmit={(qty, pledgeId, ev) => doRecord("received", { eventType: "received", qty, pledgeId }, ev)}
          onCancel={() => setOpen(null)}
        />
      )}
      {open && open !== "received" && (
        <StepForm
          key={open}
          step={open}
          max={caps[open]}
          unit={need.unit}
          needId={need.needId}
          isDemo={isDemo}
          busy={busy === open}
          onSubmit={(a, ev) => doRecord(open, { eventType: open, ...a }, ev)}
          onCancel={() => setOpen(null)}
        />
      )}

      <PledgeList pledges={pledges} busy={busy} onReceive={(pl, qty) => doRecord(pl.pledgeId, { eventType: "received", qty, pledgeId: pl.pledgeId })} />
      <NeedLog need={need} />
    </article>
  );
}

function Num({ stage, label, value, className }: { stage: Stage; label: string; value: number | null; className: string }) {
  return (
    <div className={`border-border px-3 py-3 sm:px-4 ${className}`}>
      <dt className={`flex items-center gap-1.5 text-xs leading-tight ${stage === "verified" ? "font-semibold text-emerald" : stage === "pledged" ? "text-gold-ink" : "text-muted"}`}>
        {stage === "verified" ? <VerifyMark className="size-3" /> : <StageSwatch stage={stage} size={8} />}
        {label}
      </dt>
      <dd className={`mt-1.5 font-display text-[28px] font-normal tabular-nums leading-none sm:text-[32px] ${value === 0 ? "text-muted/50" : STAGE_TEXT[stage]}`}>
        {/* key forces a re-mount so the number flashes when it changes */}
        <span key={value ?? "x"} className="coord-num inline-block">
          {value ?? "?"}
        </span>
      </dd>
    </div>
  );
}

/** Requested is the track; every other stage is its own lane (not stacked sums). */
function FlowBar({ values }: { values: Record<Stage, number | null> }) {
  const max = Math.max(values.requested ?? 0, values.pledged ?? 0, values.received ?? 0, 1);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div aria-hidden className="grid grid-cols-5 gap-1.5 px-4 pt-3 sm:px-5">
      {STAGES.slice(1).map((s) => (
        <div key={s} className="h-1.5 overflow-hidden bg-stage-track">
          <div className="h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: pct(values[s] ?? 0), background: stageFill(s) }} />
        </div>
      ))}
    </div>
  );
}

function PledgeList({
  pledges,
  busy,
  onReceive,
}: {
  pledges: ReviewPledge[];
  busy: string | null;
  onReceive: (pl: ReviewPledge, qty: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="px-4 pt-5 sm:px-5">
      <p className="mb-1.5 text-[13px] text-muted">
        <span className="font-display text-[15px] italic">{t("coord.pledgesForNeed")}</span> · {t("coord.contactPrivate")}
      </p>
      {pledges.length === 0 ? (
        <p className="text-sm text-muted">{t("coord.noPledges")}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {pledges.map((pl) => {
            const remaining = pl.qty - pl.receivedQty;
            return (
              <li key={pl.pledgeId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">
                    <span className="font-display text-lg tabular-nums text-gold-ink">{pl.qty}</span> · <span className="font-semibold">{pl.donorName}</span>{" "}
                    <span className="text-muted">· {pl.donorContact}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Chip tone="navy">{t(`coord.mode.${pl.mode}` as DictKey)}</Chip>
                    <Chip tone={pl.status === "active" ? "gold" : pl.status === "fulfilled" ? "navy" : "neutral"}>
                      {t(`coord.pledge.${pl.status}` as DictKey)}
                    </Chip>
                    <span className="text-[13px] tabular-nums text-muted">
                      {t("ledger.received")} {pl.receivedQty}/{pl.qty}
                    </span>
                  </div>
                </div>
                {pl.status === "active" && remaining > 0 && (
                  <Button size="sm" variant="primary" busy={busy === pl.pledgeId} onClick={() => onReceive(pl, remaining)}>
                    {t("coord.markReceived")} · {remaining}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type LogEvent = {
  eventId: string;
  eventType: "received" | "delivered" | "used" | "verified" | "returned";
  qty: number;
  createdAt: number;
  actorName: string | null;
  noteEs?: string | null;
  noteEn?: string | null;
  evidenceId?: string | null;
};

/** Who changed what, and when. */
function NeedLog({ need }: { need: ReviewNeed }) {
  const { t, pick, locale } = useI18n();
  const events = ((need as { events?: LogEvent[] }).events ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);
  return (
    <details className="group mx-4 mb-4 mt-4 border-t border-border sm:mx-5" open={events.length > 0 && events.length <= 4}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-muted">
        <span aria-hidden className="inline-block transition group-open:rotate-90">›</span>
        {t("coord.log")} <span className="tabular-nums">({events.length})</span>
      </summary>
      {events.length === 0 ? (
        <p className="pb-1 text-[13px] text-muted">{t("coord.log.empty")}</p>
      ) : (
        <ol className="divide-y divide-border border-t border-dotted border-border">
          {events.map((e) => {
            const note = pick(e.noteEs ?? undefined, e.noteEn ?? undefined);
            return (
              <li key={e.eventId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 text-sm">
                <StageSwatch stage={e.eventType === "returned" ? "requested" : e.eventType} size={8} />
                <strong className={`font-semibold ${e.eventType === "verified" ? "text-emerald" : ""}`}>{t(`coord.event.${e.eventType}` as DictKey)}</strong>
                <span className="font-display text-base tabular-nums">{e.qty}</span>
                <span className="text-muted">
                  {t("coord.log.by")} <span className="text-foreground">{e.actorName ?? "—"}</span>, {formatDate(e.createdAt, locale)}
                </span>
                {e.evidenceId && <Chip tone="navy">{t("coord.log.withEvidence")}</Chip>}
                {note && <span className="w-full pl-4 text-[13px] text-muted">{note}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}

function ReceiveForm({
  pledges,
  unit,
  busy,
  onSubmit,
  onCancel,
}: {
  pledges: ReviewPledge[];
  unit: string;
  busy: boolean;
  onSubmit: (qty: number, pledgeId: Id<"pledges"> | undefined, ev: EvidenceDraft) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const open = pledges.filter((p) => p.qty - p.receivedQty > 0);
  const [pledgeId, setPledgeId] = useState<string>(open[0]?.pledgeId ?? "");
  const sel = open.find((p) => p.pledgeId === pledgeId);
  const [qty, setQty] = useState<string>(sel ? String(sel.qty - sel.receivedQty) : "");
  const [ev, setEv] = useState<EvidenceDraft>(emptyEvidence());
  const max = sel ? sel.qty - sel.receivedQty : undefined;
  const n = Number(qty);
  const valid = Number.isInteger(n) && n > 0 && (max === undefined || n <= max) && evidenceState(ev) !== "incomplete";

  return (
    <form
      className="mx-4 mt-3 space-y-3 rounded-[2px] border border-rule bg-paper p-3 sm:mx-5 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(n, sel?.pledgeId, ev);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="rcv-pledge">{t("coord.fromPledge")}</Label>
          <select
            id="rcv-pledge"
            value={pledgeId}
            onChange={(e) => {
              setPledgeId(e.target.value);
              const p = open.find((x) => x.pledgeId === e.target.value);
              setQty(p ? String(p.qty - p.receivedQty) : "");
            }}
            className={inputCls}
          >
            {open.map((p) => (
              <option key={p.pledgeId} value={p.pledgeId}>
                {p.donorName} — {p.qty - p.receivedQty} {unit} ({formatDate(p.createdAt, locale)})
              </option>
            ))}
            <option value="">{t("coord.unlinked")}</option>
          </select>
        </div>
        <QtyField id="rcv-qty" qty={qty} setQty={setQty} unit={unit} max={max} capLabel={t("coord.cap.received")} />
      </div>
      <EvidenceAttach id="rcv-ev" value={ev} onChange={setEv} />
      <FormFooter busy={busy} valid={valid} onCancel={onCancel} label={`${t("coord.markReceived")} · ${qty || 0}`} signer={user?.name} />
    </form>
  );
}

function StepForm({
  step,
  max,
  unit,
  needId,
  isDemo,
  busy,
  onSubmit,
  onCancel,
}: {
  step: Exclude<Step, "received">;
  max: number;
  unit: string;
  needId: string;
  isDemo: boolean;
  busy: boolean;
  onSubmit: (a: { qty: number; noteEs?: string; noteEn?: string }, ev: EvidenceDraft) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const [qty, setQty] = useState(String(max));
  const [noteEs, setNoteEs] = useState("");
  const [noteEn, setNoteEn] = useState("");
  // Demo projects start with a clearly-labeled synthetic proof (editable), so the climax is open → confirm.
  const preset = step === "used" ? undefined : step;
  const [ev, setEv] = useState<EvidenceDraft>(() => (isDemo && preset ? syntheticEvidence(preset) : emptyEvidence()));
  const n = Number(qty);
  const valid = Number.isInteger(n) && n > 0 && n <= max && evidenceState(ev) !== "incomplete";
  const id = `${step}-${needId}`;

  return (
    <form
      className="mx-4 mt-3 space-y-3 rounded-[2px] border border-rule bg-paper p-3 sm:mx-5 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ qty: n, noteEs: noteEs.trim() || undefined, noteEn: noteEn.trim() || undefined }, ev);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
        <QtyField id={`${id}-qty`} qty={qty} setQty={setQty} unit={unit} max={max} capLabel={t(`coord.cap.${step}` as DictKey)} />
        <div>
          <Label htmlFor={`${id}-es`}>{t("coord.noteEs")}</Label>
          <input id={`${id}-es`} lang="es" value={noteEs} onChange={(e) => setNoteEs(e.target.value)} className={inputCls} />
        </div>
        <div>
          <Label htmlFor={`${id}-en`}>{t("coord.noteEn")}</Label>
          <input id={`${id}-en`} lang="en" value={noteEn} onChange={(e) => setNoteEn(e.target.value)} className={inputCls} />
        </div>
      </div>
      <EvidenceAttach id={`${id}-ev`} value={ev} onChange={setEv} syntheticPreset={isDemo ? preset : undefined} />
      <FormFooter busy={busy} valid={valid} onCancel={onCancel} label={`${t(STEP_LABEL[step])} · ${qty || 0}`} signer={user?.name} verify={step === "verified"} />
    </form>
  );
}

function QtyField({
  id,
  qty,
  setQty,
  unit,
  max,
  capLabel,
}: {
  id: string;
  qty: string;
  setQty: (s: string) => void;
  unit: string;
  max: number | undefined;
  capLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <Label htmlFor={id}>{t("coord.qty")}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="numeric"
          autoFocus
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
          className={`${inputCls} w-24! text-right font-display text-lg! tabular-nums`}
          aria-describedby={max !== undefined ? `${id}-max` : undefined}
        />
        <span className="text-sm text-muted">{unit}</span>
      </div>
      {max !== undefined && (
        <p id={`${id}-max`} className="mt-1 text-[13px] text-muted">
          {capLabel}: <span className="tabular-nums">{max}</span>
        </p>
      )}
    </div>
  );
}

function FormFooter({
  busy,
  valid,
  onCancel,
  label,
  signer,
  verify,
}: {
  busy: boolean;
  valid: boolean;
  onCancel: () => void;
  label: string;
  signer?: string;
  verify?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" variant={verify ? "leaf" : "primary"} busy={busy} disabled={!valid}>
        {label}
      </Button>
      <Button type="button" variant="quiet" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
      {signer && (
        <span className="ml-auto text-[13px] text-muted">
          {t("coord.youWillSign")} <strong className="text-foreground">{signer}</strong>
        </span>
      )}
    </div>
  );
}
