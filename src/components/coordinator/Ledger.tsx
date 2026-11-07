"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, Label, Section, formatDate, inputCls, useAction } from "./ui";
import { MaterialIcon } from "./MaterialIcon";
import type { ReviewData, ReviewNeed, ReviewPhoto, ReviewPledge } from "./types";

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
      <p className="mb-4 text-sm text-muted">{t("coord.ledger.note")}</p>
      <style>{`
        @keyframes coord-num { from { transform: translateY(-4px); opacity: .2 } to { transform: none; opacity: 1 } }
        .coord-num { animation: coord-num 320ms ease-out }
        @media (prefers-reduced-motion: reduce) { .coord-num { animation: none } }
      `}</style>

      {needs.length === 0 ? (
        <p className="text-sm text-muted">{t("coord.need.noneApproved")}</p>
      ) : (
        <div className="space-y-4">
          {needs.map((n) => (
            <NeedLedger key={n.needId} need={n} pledges={byNeed.get(n.needId) ?? []} photos={data.photos} />
          ))}
        </div>
      )}
    </Section>
  );
}

function NeedLedger({ need, pledges, photos }: { need: ReviewNeed; pledges: ReviewPledge[]; photos: ReviewPhoto[] }) {
  const { t, pick } = useI18n();
  const { sessionToken, user } = useSession();
  const record = useMutation(api.coordinator.recordMaterialEvent);
  const { busy, run } = useAction();
  const [open, setOpen] = useState<null | "received" | "used">(null);
  const name = pick(need.nameEs, need.nameEn);
  const L = need.ledger;
  const onHand = Math.max(0, L.received - L.used);
  const activePledges = pledges.filter((p) => p.status === "active");
  const signed = user ? `${t("coord.verifiedBy")} ${user.name}` : undefined;

  const doRecord = async (
    key: string,
    args: {
      eventType: "received" | "used";
      qty: number;
      pledgeId?: Id<"pledges">;
      noteEs?: string;
      noteEn?: string;
      evidencePhotoId?: Id<"photos">;
    },
  ) => {
    if (!sessionToken) return false;
    const ok = await run(
      key,
      () => record({ sessionToken, needId: need.needId, ...args }),
      `${args.eventType === "received" ? t("coord.received.toast") : t("coord.used.toast")}: ${args.qty} ${name}`,
      signed,
    );
    if (ok) setOpen(null);
    return ok;
  };

  return (
    <article id={`need-${need.needId}`} className="scroll-mt-24 rounded-lg border border-border bg-background/60">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <MaterialIcon itemKey={need.itemKey} label={name} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold leading-tight">{name}</h3>
          <p className="text-xs text-muted">{need.unit}</p>
        </div>
        {need.status === "fulfilled" && <Chip tone="leaf">{t("coord.need.fulfilled")}</Chip>}
        {need.needsConfirmation && <Chip tone="amber">{t("ledger.needsConfirmation")}</Chip>}
      </header>

      {/* The four numbers — always separate. */}
      <dl className="mt-3 grid grid-cols-4 border-y border-border bg-surface">
        <Num label={t("ledger.requested")} value={L.requested} tone="text-foreground" />
        <Num label={t("ledger.pledged")} value={L.pledged} tone="text-amber" />
        <Num label={t("ledger.received")} value={L.received} tone="text-sky" />
        <Num label={t("ledger.used")} value={L.used} tone="text-leaf" last />
      </dl>
      <FlowBar requested={L.requested} pledged={L.pledged} received={L.received} used={L.used} />

      <div className="flex flex-wrap items-center gap-2 px-4 pb-1 pt-3">
        <Button
          variant={open === "received" ? "primary" : "ghost"}
          aria-expanded={open === "received"}
          onClick={() => setOpen(open === "received" ? null : "received")}
        >
          <Dot className="bg-sky" /> {t("coord.markReceived")}
        </Button>
        <Button
          variant={open === "used" ? "leaf" : "ghost"}
          aria-expanded={open === "used"}
          disabled={onHand === 0}
          title={onHand === 0 ? t("coord.used.nothing") : undefined}
          onClick={() => setOpen(open === "used" ? null : "used")}
        >
          <Dot className="bg-leaf" /> {t("coord.markUsed")}
        </Button>
        <span className="ml-auto text-xs text-muted">
          {t("coord.ledger.inHand")}: <strong className="tabular-nums text-foreground">{onHand}</strong>
        </span>
      </div>

      {open === "received" && (
        <ReceiveForm
          pledges={activePledges}
          unit={need.unit}
          busy={busy === "receive"}
          onSubmit={(qty, pledgeId) => doRecord("receive", { eventType: "received", qty, pledgeId })}
          onCancel={() => setOpen(null)}
        />
      )}
      {open === "used" && (
        <UseForm
          max={onHand}
          unit={need.unit}
          photos={photos}
          busy={busy === "use"}
          onSubmit={(a) => doRecord("use", { eventType: "used", ...a })}
          onCancel={() => setOpen(null)}
        />
      )}

      <div className="px-4 pb-4 pt-3">
        <p className="mb-1.5 text-xs font-medium text-muted">
          {t("coord.pledgesForNeed")} · <span className="font-normal">{t("coord.contactPrivate")}</span>
        </p>
        {pledges.length === 0 ? (
          <p className="text-sm text-muted">{t("coord.noPledges")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {pledges.map((pl) => {
              const remaining = pl.qty - pl.receivedQty;
              return (
                <li key={pl.pledgeId} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <strong className="tabular-nums">{pl.qty}</strong> · {pl.donorName}{" "}
                      <span className="text-muted">· {pl.donorContact}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Chip tone="sky">{t(`coord.mode.${pl.mode}` as DictKey)}</Chip>
                      <Chip tone={pl.status === "active" ? "amber" : pl.status === "fulfilled" ? "leaf" : "neutral"}>
                        {t(`coord.pledge.${pl.status}` as DictKey)}
                      </Chip>
                      <span className="text-xs text-muted tabular-nums">
                        {t("ledger.received")} {pl.receivedQty}/{pl.qty}
                      </span>
                    </div>
                  </div>
                  {pl.status === "active" && remaining > 0 && (
                    <Button
                      size="sm"
                      variant="primary"
                      busy={busy === pl.pledgeId}
                      onClick={() => doRecord(pl.pledgeId, { eventType: "received", qty: remaining, pledgeId: pl.pledgeId })}
                    >
                      {t("coord.markReceived")} · {remaining}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}

function Num({ label, value, tone, last }: { label: string; value: number | null; tone: string; last?: boolean }) {
  return (
    <div className={`px-2 py-3 text-center sm:px-4 sm:text-left ${last ? "" : "border-r border-border"}`}>
      <dt className="text-[11px] leading-tight text-muted sm:text-xs">{label}</dt>
      <dd className={`mt-1 font-display text-2xl font-semibold tabular-nums leading-none sm:text-3xl ${tone}`}>
        {/* key forces a re-mount so the number flashes when it changes */}
        <span key={value ?? "x"} className="coord-num inline-block">
          {value ?? "?"}
        </span>
      </dd>
    </div>
  );
}

/** Requested is the track; pledged, received and used are separate lanes on it (not stacked sums). */
function FlowBar({ requested, pledged, received, used }: { requested: number | null; pledged: number; received: number; used: number }) {
  const max = Math.max(requested ?? 0, pledged + received, 1);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div aria-hidden className="space-y-1 px-4 pt-3">
      {[
        ["bg-amber", pledged],
        ["bg-sky", received],
        ["bg-leaf", used],
      ].map(([cls, n]) => (
        <div key={cls as string} className="h-1.5 overflow-hidden rounded-full bg-border/60">
          <div className={`h-full rounded-full ${cls} transition-[width] duration-500`} style={{ width: pct(n as number) }} />
        </div>
      ))}
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${className}`} />;
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
  onSubmit: (qty: number, pledgeId?: Id<"pledges">) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const open = pledges.filter((p) => p.qty - p.receivedQty > 0);
  const [pledgeId, setPledgeId] = useState<string>(open[0]?.pledgeId ?? "");
  const sel = open.find((p) => p.pledgeId === pledgeId);
  const [qty, setQty] = useState<string>(sel ? String(sel.qty - sel.receivedQty) : "");
  const max = sel ? sel.qty - sel.receivedQty : undefined;
  const n = Number(qty);
  const valid = Number.isInteger(n) && n > 0 && (max === undefined || n <= max);

  return (
    <form
      className="mx-4 mt-3 rounded-md border border-sky/40 bg-sky-soft/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(n, sel?.pledgeId);
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
        <div>
          <Label htmlFor="rcv-qty">{t("coord.qty")}</Label>
          <div className="flex items-center gap-2">
            <input
              id="rcv-qty"
              inputMode="numeric"
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
              className={`${inputCls} w-24! text-right tabular-nums`}
            />
            <span className="text-sm text-muted">{unit}</span>
          </div>
        </div>
      </div>
      <FormFooter busy={busy} valid={valid} onCancel={onCancel} label={`${t("coord.markReceived")} · ${qty || 0}`} variant="primary" signer={user?.name} />
    </form>
  );
}

function UseForm({
  max,
  unit,
  photos,
  busy,
  onSubmit,
  onCancel,
}: {
  max: number;
  unit: string;
  photos: ReviewPhoto[];
  busy: boolean;
  onSubmit: (a: { qty: number; noteEs?: string; noteEn?: string; evidencePhotoId?: Id<"photos"> }) => void;
  onCancel: () => void;
}) {
  const { t, pick } = useI18n();
  const { user } = useSession();
  const [qty, setQty] = useState(String(max));
  const [noteEs, setNoteEs] = useState("");
  const [noteEn, setNoteEn] = useState("");
  const [photoId, setPhotoId] = useState("");
  const n = Number(qty);
  const valid = Number.isInteger(n) && n > 0 && n <= max;

  return (
    <form
      className="mx-4 mt-3 rounded-md border border-leaf/40 bg-leaf-soft/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          qty: n,
          noteEs: noteEs.trim() || undefined,
          noteEn: noteEn.trim() || undefined,
          evidencePhotoId: (photoId || undefined) as Id<"photos"> | undefined,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <Label htmlFor="use-qty">{t("coord.qty")}</Label>
          <div className="flex items-center gap-2">
            <input
              id="use-qty"
              inputMode="numeric"
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
              className={`${inputCls} w-24! text-right tabular-nums`}
              aria-describedby="use-max"
            />
            <span className="text-sm text-muted">{unit}</span>
          </div>
          <p id="use-max" className="mt-1 text-xs text-muted">
            {t("coord.used.max")}: {max}
          </p>
        </div>
        <div>
          <Label htmlFor="use-photo">{t("coord.evidencePhoto")}</Label>
          <select id="use-photo" value={photoId} onChange={(e) => setPhotoId(e.target.value)} className={inputCls}>
            <option value="">{t("coord.noEvidence")}</option>
            {photos.map((ph, i) => (
              <option key={ph.photoId} value={ph.photoId}>
                #{i + 1} {pick(ph.captionEs ?? undefined, ph.captionEn ?? undefined)} (
                {ph.visibility === "publicApproved" ? t("coord.photo.public") : t("coord.photo.private")})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="use-es">{t("coord.noteEs")}</Label>
          <input id="use-es" lang="es" value={noteEs} onChange={(e) => setNoteEs(e.target.value)} className={inputCls} />
        </div>
        <div>
          <Label htmlFor="use-en">{t("coord.noteEn")}</Label>
          <input id="use-en" lang="en" value={noteEn} onChange={(e) => setNoteEn(e.target.value)} className={inputCls} />
        </div>
      </div>
      <FormFooter busy={busy} valid={valid} onCancel={onCancel} label={`${t("coord.markUsed")} · ${qty || 0}`} variant="leaf" signer={user?.name} />
    </form>
  );
}

function FormFooter({
  busy,
  valid,
  onCancel,
  label,
  variant,
  signer,
}: {
  busy: boolean;
  valid: boolean;
  onCancel: () => void;
  label: string;
  variant: "primary" | "leaf";
  signer?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button type="submit" variant={variant} busy={busy} disabled={!valid}>
        {label}
      </Button>
      <Button type="button" variant="quiet" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
      {signer && (
        <span className="ml-auto text-xs text-muted">
          {t("coord.youWillSign")} <strong className="text-foreground">{signer}</strong>
        </span>
      )}
    </div>
  );
}
