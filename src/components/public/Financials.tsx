"use client";

import { useI18n } from "@/lib/i18n";
import { intlLocale } from "@/components/ui/tricolor";
import type { Financial } from "./publicApi";

/** Received / allocated / spent per currency. Original currency, never converted or summed across currencies. */
export function FinancialsTable({ rows, className = "" }: { rows: Financial[]; className?: string }) {
  const { t, locale } = useI18n();
  if (rows.length === 0) return <p className={`text-[15px] text-muted ${className}`}>{t("fin.none")}</p>;
  const tag = intlLocale(locale);
  const fmt = (n: number, cur: string) => {
    try {
      return new Intl.NumberFormat(tag, {
        style: "currency",
        currency: cur,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return n.toLocaleString(tag);
    }
  };
  const curName = (cur: string) => {
    try {
      return new Intl.DisplayNames([tag], { type: "currency" }).of(cur) ?? cur;
    } catch {
      return cur;
    }
  };
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-y border-rule text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[13px] text-muted">
              <th scope="col" className="py-2 pr-2 font-semibold">{t("fin.currency")}</th>
              <th scope="col" className="py-2 px-2 sm:px-3 font-semibold text-right">{t("fin.received")}</th>
              <th scope="col" className="py-2 px-2 sm:px-3 font-semibold text-right">{t("fin.allocated")}</th>
              <th scope="col" className="py-2 pl-2 sm:pl-3 font-semibold text-right">{t("fin.spent")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.currency} className="border-b border-border last:border-b-0">
                <th scope="row" className="py-3 pr-2 text-left align-baseline font-normal">
                  <span className="block font-semibold">{r.currency}</span>
                  <span className="hidden sm:block text-[12px] text-muted leading-tight">{curName(r.currency)}</span>
                </th>
                {[r.received, r.allocated, r.spent].map((v, i) => (
                  <td
                    key={i}
                    className={`py-3 ${i === 2 ? "pl-2 sm:pl-3" : "px-2 sm:px-3"} text-right align-baseline font-display text-[15px] sm:text-[17px] tabular-nums whitespace-nowrap`}
                  >
                    {fmt(v, r.currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-display italic text-[13px] text-muted">{t("fin.noFx")}</p>
    </div>
  );
}
