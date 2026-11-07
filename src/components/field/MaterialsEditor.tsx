"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { AiBadge, ConfirmChip, ITEM_KEYS, btnSecondary, inputCls } from "./ui";

export type NeedRow = {
  rowKey: string;
  needId?: string;
  itemKey: string;
  nameEs: string;
  nameEn: string;
  qty: string; // "" => unknown, needs confirmation
  unit: string;
  aiSuggested: boolean;
  quote?: string;
};

function MaterialIcon({ itemKey }: { itemKey: string }) {
  const [broken, setBroken] = useState(false);
  if (broken || itemKey === "other")
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-clay-soft text-xs font-bold uppercase text-clay" aria-hidden>
        {itemKey.slice(0, 2)}
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/materials/${itemKey}.png`}
      alt=""
      onError={() => setBroken(true)}
      className="h-12 w-12 shrink-0 rounded-xl bg-background object-contain"
    />
  );
}

export function MaterialsEditor({ rows, onChange }: { rows: NeedRow[]; onChange: (rows: NeedRow[]) => void }) {
  const { t } = useI18n();
  const update = (key: string, patch: Partial<NeedRow>) =>
    onChange(rows.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const unknown = r.qty.trim() === "";
        return (
          <div
            key={r.rowKey}
            className={`rounded-2xl border p-3 ${unknown ? "border-amber bg-amber-soft/40" : "border-border bg-background"}`}
          >
            <div className="flex items-start gap-3">
              <MaterialIcon itemKey={r.itemKey} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{r.nameEs || r.nameEn || `#${i + 1}`}</span>
                  {r.aiSuggested && <AiBadge />}
                  {unknown && <ConfirmChip />}
                </div>
                {r.quote && (
                  <p className="text-xs text-muted">
                    {t("field.mat.quote")}: <q className="italic">{r.quote}</q>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(rows.filter((x) => x.rowKey !== r.rowKey))}
                className="min-h-11 rounded-lg px-2 text-sm text-brick underline-offset-4 hover:underline"
              >
                {t("field.mat.remove")}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="col-span-1 text-xs font-medium text-muted">
                {t("field.mat.qty")}
                <input
                  inputMode="decimal"
                  type="number"
                  min={0}
                  value={r.qty}
                  placeholder="?"
                  aria-describedby={`${r.rowKey}-qtyhint`}
                  onChange={(e) => update(r.rowKey, { qty: e.target.value })}
                  className={`${inputCls} mt-1 text-lg font-semibold ${unknown ? "border-amber" : ""}`}
                />
              </label>
              <label className="col-span-1 text-xs font-medium text-muted">
                {t("field.mat.unit")}
                <input value={r.unit} onChange={(e) => update(r.rowKey, { unit: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <span id={`${r.rowKey}-qtyhint`} className="col-span-2 -mt-1 text-[11px] text-muted">
                {t("field.mat.qtyBlank")}
              </span>
              <label className="col-span-2 text-xs font-medium text-muted sm:col-span-1">
                {t("field.mat.nameEs")}
                <input lang="es" value={r.nameEs} onChange={(e) => update(r.rowKey, { nameEs: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <label className="col-span-2 text-xs font-medium text-muted sm:col-span-1">
                {t("field.mat.nameEn")}
                <input lang="en" value={r.nameEn} onChange={(e) => update(r.rowKey, { nameEn: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <label className="col-span-2 text-xs font-medium text-muted">
                {t("field.mat.type")}
                <select value={r.itemKey} onChange={(e) => update(r.rowKey, { itemKey: e.target.value })} className={`${inputCls} mt-1`}>
                  {ITEM_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                  <option value="other">{t("field.mat.other" as DictKey)}</option>
                </select>
              </label>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className={`${btnSecondary} w-full border-dashed`}
        onClick={() =>
          onChange([
            ...rows,
            { rowKey: `new-${Date.now()}`, itemKey: "other", nameEs: "", nameEn: "", qty: "", unit: "unidades", aiSuggested: false },
          ])
        }
      >
        + {t("field.mat.add")}
      </button>
    </div>
  );
}
