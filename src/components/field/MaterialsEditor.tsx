"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { Chip } from "@/components/ui/tricolor";
import { MaterialGlyph } from "@/components/ui/MaterialGlyph";
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
  approximate?: boolean; // AI saw "aproximadamente/unos/about" before the number
};

function MaterialIcon({ itemKey }: { itemKey: string }) {
  return (
    <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center border border-border bg-paper text-foreground">
      <MaterialGlyph itemKey={itemKey} className="h-11 w-11" />
    </span>
  );
}

export function MaterialsEditor({ rows, onChange }: { rows: NeedRow[]; onChange: (rows: NeedRow[]) => void }) {
  const { t } = useI18n();
  const update = (key: string, patch: Partial<NeedRow>) =>
    onChange(rows.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className="divide-y divide-border border-y border-border">
      {rows.map((r, i) => {
        const unknown = r.qty.trim() === "";
        return (
          <div
            key={r.rowKey}
            className={`py-4 ${unknown ? "-mx-3 border-l-2 border-l-gold bg-gold-soft/40 px-3" : ""}`}
          >
            <div className="flex items-start gap-3">
              <MaterialIcon itemKey={r.itemKey} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[17px] font-semibold">{r.nameEs || r.nameEn || `#${i + 1}`}</span>
                  {r.aiSuggested && <AiBadge />}
                  {unknown && <ConfirmChip />}
                  {!unknown && r.approximate && (
                    <Chip tone="gold">≈ {t("field.mat.approx")}</Chip>
                  )}
                </div>
                {r.quote && (
                  <p className="text-sm text-muted">
                    {t("field.mat.quote")}:{" "}
                    <q className="font-display italic text-foreground underline decoration-gold decoration-2 underline-offset-4">{r.quote}</q>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(rows.filter((x) => x.rowKey !== r.rowKey))}
                className="min-h-11 shrink-0 px-1 text-sm font-semibold text-muted underline decoration-1 underline-offset-4 hover:text-red"
              >
                {t("field.mat.remove")}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
              <label className="col-span-1 text-sm font-semibold text-foreground">
                {t("field.mat.qty")}
                <input
                  inputMode="decimal"
                  type="number"
                  min={0}
                  value={r.qty}
                  placeholder="?"
                  aria-describedby={`${r.rowKey}-qtyhint`}
                  onChange={(e) => update(r.rowKey, { qty: e.target.value, approximate: false })}
                  className={`${inputCls} mt-1 font-display text-xl tabular-nums ${unknown ? "border-gold" : ""}`}
                />
              </label>
              <label className="col-span-1 text-sm font-semibold text-foreground">
                {t("field.mat.unit")}
                <input value={r.unit} onChange={(e) => update(r.rowKey, { unit: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <span id={`${r.rowKey}-qtyhint`} className="col-span-2 -mt-1 text-xs text-muted">
                {t("field.mat.qtyBlank")}
              </span>
              <label className="col-span-2 text-sm font-semibold text-foreground sm:col-span-1">
                {t("field.mat.nameEs")}
                <input lang="es" value={r.nameEs} onChange={(e) => update(r.rowKey, { nameEs: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <label className="col-span-2 text-sm font-semibold text-foreground sm:col-span-1">
                {t("field.mat.nameEn")}
                <input lang="en" value={r.nameEn} onChange={(e) => update(r.rowKey, { nameEn: e.target.value })} className={`${inputCls} mt-1`} />
              </label>
              <label className="col-span-2 text-sm font-semibold text-foreground">
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
      </div>
      <button
        type="button"
        className={`${btnSecondary} mt-4 w-full`}
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
