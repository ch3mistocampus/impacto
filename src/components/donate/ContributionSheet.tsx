"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { MaterialGlyph } from "@/components/ui/MaterialGlyph";
import {
  DoubleRule,
  FlagBand,
  Kicker,
  StageSwatch,
  btn,
  inputCls,
  intlLocale,
  labelCls,
} from "@/components/ui/tricolor";
import { savePledge } from "./followTokens";
import type { DeckCard, PledgeMode } from "./types";

type Mode = PledgeMode;
const MODES: Mode[] = ["have_materials", "will_buy", "request_instructions"];
const QUICK = [10, 25, 50];

type Done = { followToken: string; qty: number; saved: boolean };

/**
 * Accessible pledge dialog (native <dialog> = focus trap + Esc). `card` is the live deck
 * entry, so `availableToPledge` updates reactively while the sheet is open.
 */
export function ContributionSheet({
  card,
  initialMode = "have_materials",
  onClose,
}: {
  card: DeckCard | null;
  initialMode?: Mode;
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
  const cardId = card ? `${card.needId}:${initialMode}` : null;
  if (cardId !== openFor) {
    setOpenFor(cardId);
    if (cardId) {
      setQty(Math.max(1, Math.min(10, available)));
      setMode(initialMode);
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
        pledgeId: res.pledgeId,
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
      className="m-0 mt-auto sm:m-auto w-full max-w-none sm:max-w-lg max-h-[92dvh] rounded-t-[6px] sm:rounded-[2px] border border-border bg-surface text-foreground p-0 backdrop:bg-[#081530]/55 open:flex flex-col overflow-hidden"
    >
      <FlagBand thickness={5} className="shrink-0" />
      <div className="flex items-start gap-3 px-5 sm:px-7 pt-4 pb-4 border-b border-border">
        {card && <MaterialGlyph itemKey={card.itemKey} className="mt-1 size-10 shrink-0 text-foreground" />}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-2xl font-normal leading-tight">
            {done ? t("donate.successTitle") : t("donate.sheetTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-muted truncate">
            {itemName}
            {card && <span>, {card.publicAlias}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="-mr-2 size-11 shrink-0 grid place-items-center rounded-[2px] text-2xl leading-none text-muted hover:text-foreground hover:bg-paper"
          aria-label={t("donate.close")}
        >
          <span aria-hidden>×</span>
        </button>
      </div>

      <div className="overflow-y-auto px-5 sm:px-7 py-6">
        {!card ? null : done ? (
          <Success done={done} unit={unit} itemName={itemName} onContinue={close} />
        ) : (
          <form onSubmit={submit} noValidate className="space-y-7">
            {/* The one place on this screen that says it: the decision happens here. */}
            <p className="flex items-start gap-2.5 border-l-2 border-gold pl-3 text-[15px] font-semibold text-gold-ink">
              <StageSwatch stage="pledged" size={12} className="mt-1" />
              {t("stage.pledgeIsNot")}
            </p>

            {/* Quantity */}
            <fieldset>
              <legend className={labelCls}>{t("donate.qty")}</legend>
              <div className="mt-1 flex items-stretch border border-rule rounded-[2px]">
                <button
                  type="button"
                  onClick={() => setQty(clamp(qty - 1))}
                  disabled={qty <= 1}
                  className="w-16 shrink-0 text-3xl font-light hover:bg-paper disabled:opacity-35 disabled:hover:bg-transparent"
                  aria-label={t("donate.decrease")}
                >
                  <span aria-hidden>−</span>
                </button>
                <label className="flex-1 min-w-0 border-x border-border">
                  <span className="sr-only">{t("donate.qty")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={max}
                    value={qty}
                    onChange={(e) => setQty(clamp(Number(e.target.value)))}
                    className="w-full h-20 bg-transparent text-center font-display text-5xl font-normal tabular-nums focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setQty(clamp(qty + 1))}
                  disabled={qty >= max}
                  className="w-16 shrink-0 text-3xl font-light hover:bg-paper disabled:opacity-35 disabled:hover:bg-transparent"
                  aria-label={t("donate.increase")}
                >
                  <span aria-hidden>+</span>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK.filter((q) => q < max).map((q) => (
                  <button key={q} type="button" aria-pressed={qty === q} onClick={() => setQty(q)} className={quickCls(qty === q)}>
                    {q}
                  </button>
                ))}
                {max > 0 && (
                  <button type="button" aria-pressed={qty === max} onClick={() => setQty(max)} className={quickCls(qty === max)}>
                    {t("donate.max")} ({max})
                  </button>
                )}
              </div>
              <p className="mt-3 text-sm text-muted" aria-live="polite">
                {t("ledger.available")}: <strong className="text-foreground tabular-nums">{max}</strong> {unit}
              </p>
              {liveAvail !== null && (
                <p role="alert" className="mt-2 border-l-2 border-gold bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink">
                  {t("donate.overpledge")} {liveAvail} {unit}
                </p>
              )}
            </fieldset>

            {/* Mode: ruled radio rows */}
            <fieldset>
              <legend className={labelCls}>{t("donate.mode")}</legend>
              <div className="mt-1 border-y border-rule divide-y divide-border">
                {MODES.map((m) => (
                  <label
                    key={m}
                    className={`flex gap-3 items-start py-3 pr-2 pl-3 cursor-pointer border-l-2 transition-colors ${
                      mode === m ? "border-l-navy bg-paper" : "border-l-transparent hover:bg-paper/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--navy)]"
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
            <fieldset className="space-y-4">
              <label className="block">
                <span className={labelCls}>{t("donate.name")}</span>
                <input
                  required
                  autoComplete="name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>{t("donate.contact")}</span>
                <input
                  required
                  autoComplete="email"
                  value={contact}
                  maxLength={200}
                  onChange={(e) => setContact(e.target.value)}
                  className={inputCls}
                />
              </label>
              <p className="text-sm text-muted">{t("donate.privacy")}</p>
            </fieldset>

            {error && (
              <p role="alert" className="border-l-2 border-red bg-red-soft px-3 py-2 text-sm font-semibold text-red">
                {error}
              </p>
            )}

            <div>
              <button type="submit" disabled={busy || max < 1} aria-busy={busy || undefined} className={btn("primary", "lg", "w-full text-lg")}>
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

function quickCls(active: boolean) {
  return `min-h-11 rounded-[2px] px-4 text-sm font-semibold tabular-nums transition-colors ${
    active ? "bg-navy text-on-navy" : "bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--rule)]"
  }`;
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
  const { t, locale } = useI18n();
  return (
    <div className="text-center">
      <Kicker className="text-base">{t("donate.receipt.kicker")}</Kicker>
      <p className="mt-2 font-display text-7xl font-normal tabular-nums leading-none">
        {new Intl.NumberFormat(intlLocale(locale)).format(done.qty)}
      </p>
      <p className="mt-2 text-lg">
        {unit} <span className="text-muted">· {itemName}</span>
      </p>
      <DoubleRule className="my-5 mx-8" />
      <p
        className="inline-flex -rotate-2 items-center gap-2.5 rounded-[2px] border border-gold-ink px-5 py-2.5 font-display italic text-2xl text-gold-ink outline outline-1 outline-offset-[3px] outline-gold-ink"
        role="status"
      >
        <StageSwatch stage="pledged" size={14} />
        {t("ledger.pledgedNotDelivered")}
      </p>
      <p className="mt-6 text-left text-[15px] leading-relaxed max-w-prose mx-auto">{t("donate.successExplain")}</p>
      <div className="mt-6 grid gap-3">
        <Link href={`/follow/${done.followToken}`} className={btn("primary", "lg", "w-full")}>
          {t("donate.follow")}
        </Link>
        <Link href="/donations" className={btn("secondary", "md", "w-full min-h-12")}>
          {t("donate.successDonations")}
        </Link>
        <button type="button" onClick={onContinue} className={btn("quiet", "md", "min-h-11 justify-self-center")}>
          {t("donate.keepSwiping")}
        </button>
      </div>
      {done.saved && <p className="mt-3 text-xs text-muted">{t("donate.followSaved")}</p>}
    </div>
  );
}
