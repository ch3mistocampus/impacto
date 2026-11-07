"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { MaterialImage } from "@/components/public/MaterialImage";
import { savePledge } from "./followTokens";
import type { DeckCard } from "./types";

type Mode = "have_materials" | "will_buy" | "request_instructions";
const MODES: Mode[] = ["have_materials", "will_buy", "request_instructions"];
const QUICK = [10, 25, 50];

type Done = { followToken: string; qty: number; saved: boolean };

/**
 * Accessible pledge dialog (native <dialog> = focus trap + Esc). `card` is the live deck
 * entry, so `availableToPledge` updates reactively while the sheet is open.
 */
export function ContributionSheet({
  card,
  onClose,
}: {
  card: DeckCard | null;
  onClose: (pledged: boolean) => void;
}) {
  const { t, pick } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const create = useMutation(api.pledges.create);
  const titleId = useId();

  const available = card?.ledger.availableToPledge ?? 0;
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<Mode>("have_materials");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveAvail, setLiveAvail] = useState<number | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);

  // Reset the form whenever a different need is opened (state update during render, React-sanctioned).
  const cardId = card?.needId ?? null;
  if (cardId !== openFor) {
    setOpenFor(cardId);
    if (cardId) {
      setQty(Math.max(1, Math.min(10, available)));
      setMode("have_materials");
      setError(null);
      setLiveAvail(null);
      setDone(null);
      setBusy(false);
    }
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (card && !d.open) d.showModal();
    if (!card && d.open) d.close();
  }, [card]);

  const unit = card?.unit ?? "";
  const itemName = card ? pick(card.nameEs, card.nameEn) : "";
  const max = Math.max(0, available);
  const clamp = (n: number) => Math.max(1, Math.min(max || 1, Math.round(n) || 1));
  const overMax = qty > max;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!card || busy) return;
    if (!name.trim() || !contact.trim()) {
      setError(t("donate.required"));
      return;
    }
    if (overMax || max < 1) {
      setLiveAvail(max);
      return;
    }
    setBusy(true);
    setError(null);
    setLiveAvail(null);
    try {
      const res = await create({
        needId: card.needId,
        qty,
        mode,
        donorName: name.trim(),
        donorContact: contact.trim(),
      });
      const saved = savePledge({
        token: res.followToken,
        qty,
        nameEs: card.nameEs,
        nameEn: card.nameEn,
        unit: card.unit,
        alias: card.publicAlias,
        at: Date.now(),
      });
      setDone({ followToken: res.followToken, qty, saved });
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code?: string; available?: number }) : null;
      if (data?.code === "OVERPLEDGE") {
        const a = typeof data.available === "number" ? data.available : max;
        setLiveAvail(a);
        if (a > 0) setQty(Math.min(qty, a));
      } else {
        setError(t("donate.errorGeneric"));
      }
    } finally {
      setBusy(false);
    }
  }

  function close() {
    const pledged = !!done;
    setDone(null);
    onClose(pledged);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      className="m-0 mt-auto sm:m-auto w-full max-w-none sm:max-w-lg max-h-[92dvh] rounded-t-[1.75rem] sm:rounded-[1.75rem] bg-surface text-foreground p-0 backdrop:bg-black/50 open:flex flex-col"
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border">
        <div className="size-12 shrink-0 rounded-xl bg-background grid place-items-center">
          {card && <MaterialImage itemKey={card.itemKey} alt="" className="size-10" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-xl font-semibold leading-tight">
            {done ? t("donate.successTitle") : t("donate.sheetTitle")}
          </h2>
          <p className="text-sm text-muted truncate">
            {itemName}
            {card && <span>, {card.publicAlias}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="size-11 shrink-0 grid place-items-center rounded-full border border-border text-xl"
          aria-label={t("donate.close")}
        >
          <span aria-hidden>×</span>
        </button>
      </div>

      <div className="overflow-y-auto px-5 py-5">
        {!card ? null : done ? (
          <Success done={done} unit={unit} itemName={itemName} onContinue={close} />
        ) : (
          <form onSubmit={submit} noValidate className="space-y-6">
            {/* Quantity */}
            <fieldset>
              <legend className="font-semibold">{t("donate.qty")}</legend>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty(clamp(qty - 1))}
                  disabled={qty <= 1}
                  className="size-14 rounded-2xl border-2 border-border text-2xl font-semibold disabled:opacity-40"
                  aria-label={t("donate.decrease")}
                >
                  −
                </button>
                <label className="flex-1">
                  <span className="sr-only">{t("donate.qty")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={max}
                    value={qty}
                    onChange={(e) => setQty(clamp(Number(e.target.value)))}
                    className="w-full h-14 rounded-2xl border-2 border-border bg-background text-center font-display text-3xl font-semibold tabular-nums"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setQty(clamp(qty + 1))}
                  disabled={qty >= max}
                  className="size-14 rounded-2xl border-2 border-border text-2xl font-semibold disabled:opacity-40"
                  aria-label={t("donate.increase")}
                >
                  +
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK.filter((q) => q < max).map((q) => (
                  <button
                    key={q}
                    type="button"
                    aria-pressed={qty === q}
                    onClick={() => setQty(q)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border-2 ${
                      qty === q ? "bg-foreground text-background border-foreground" : "border-border"
                    }`}
                  >
                    {q}
                  </button>
                ))}
                {max > 0 && (
                  <button
                    type="button"
                    aria-pressed={qty === max}
                    onClick={() => setQty(max)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border-2 ${
                      qty === max ? "bg-foreground text-background border-foreground" : "border-border"
                    }`}
                  >
                    {t("donate.max")} ({max})
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-muted" aria-live="polite">
                {t("ledger.available")}: <strong className="text-foreground tabular-nums">{max}</strong> {unit}
              </p>
              {liveAvail !== null && (
                <p role="alert" className="mt-2 rounded-xl bg-amber-soft text-amber px-3 py-2 text-sm font-semibold">
                  {t("donate.overpledge")} {liveAvail} {unit}
                </p>
              )}
            </fieldset>

            {/* Mode */}
            <fieldset>
              <legend className="font-semibold">{t("donate.mode")}</legend>
              <div className="mt-2 space-y-2">
                {MODES.map((m) => (
                  <label
                    key={m}
                    className={`flex gap-3 items-start rounded-2xl border-2 p-3 cursor-pointer ${
                      mode === m ? "border-clay bg-clay-soft" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="mt-1 size-5 accent-[var(--clay)]"
                    />
                    <span>
                      <span className="block font-semibold">{t(`donate.mode.${m}` as DictKey)}</span>
                      <span className="block text-sm text-muted">{t(`donate.mode.${m}.hint` as DictKey)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Contact */}
            <fieldset className="space-y-3">
              <label className="block">
                <span className="font-semibold">{t("donate.name")}</span>
                <input
                  required
                  autoComplete="name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full h-12 rounded-xl border-2 border-border bg-background px-3"
                />
              </label>
              <label className="block">
                <span className="font-semibold">{t("donate.contact")}</span>
                <input
                  required
                  autoComplete="email"
                  value={contact}
                  maxLength={200}
                  onChange={(e) => setContact(e.target.value)}
                  className="mt-1 w-full h-12 rounded-xl border-2 border-border bg-background px-3"
                />
              </label>
              <p className="text-sm text-muted">{t("donate.privacy")}</p>
            </fieldset>

            {error && (
              <p role="alert" className="rounded-xl bg-brick-soft text-brick px-3 py-2 text-sm font-semibold">
                {error}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={busy || max < 1}
                className="w-full h-14 rounded-full bg-clay text-white text-lg font-semibold disabled:opacity-50 shadow-[0_2px_0_var(--brick)]"
              >
                {busy ? t("donate.submitting") : `${t("donate.submit")} ${qty} ${unit}`}
              </button>
              <p className="mt-2 text-center text-xs text-muted">{t("donate.noPayment")}</p>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

function Success({
  done,
  unit,
  itemName,
  onContinue,
}: {
  done: Done;
  unit: string;
  itemName: string;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="text-center">
      <p className="font-display text-5xl font-semibold tabular-nums">
        {done.qty} <span className="text-2xl">{unit}</span>
      </p>
      <p className="text-muted">{itemName}</p>
      <p
        className="mt-5 inline-flex items-center gap-2 rounded-2xl border-2 border-amber bg-amber-soft text-amber px-5 py-3 font-display text-2xl font-semibold"
        role="status"
      >
        <span className="size-3 rounded-full border-[3px] border-amber" aria-hidden />
        {t("ledger.pledgedNotDelivered")}
      </p>
      <p className="mt-5 text-left text-sm leading-relaxed max-w-prose mx-auto">{t("donate.successExplain")}</p>
      <div className="mt-6 grid gap-3">
        <Link
          href={`/follow/${done.followToken}`}
          className="h-14 rounded-full bg-sky text-white text-lg font-semibold grid place-items-center"
        >
          {t("donate.follow")}
        </Link>
        <button type="button" onClick={onContinue} className="h-12 rounded-full border-2 border-border font-semibold">
          {t("donate.keepSwiping")}
        </button>
      </div>
      {done.saved && <p className="mt-3 text-xs text-muted">{t("donate.followSaved")}</p>}
    </div>
  );
}
