"use client";

import { useI18n } from "@/lib/i18n";
import type { Financial } from "./publicApi";

/** Received / allocated / spent per currency. Original currency, never converted or summed across currencies. */
export function FinancialsTable({ rows, className = "" }: { rows: Financial[]; className?: string }) {
  const { t, locale } = useI18n();
  if (rows.length === 0) return <p className={`text-sm text-muted ${className}`}>{t("fin.none")}</p>;
  const fmt = (n: number, cur: string) => {
    try {
      return new Intl.NumberFormat(locale === "es" ? "es-PR" : "en-US", {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${n.toLocaleString()} ${cur}`;
    }
  };
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th scope="col" className="py-2 pr-3 font-semibold">{t("fin.currency")}</th>
              <th scope="col" className="py-2 px-3 font-semibold text-right">{t("fin.received")}</th>
              <th scope="col" className="py-2 px-3 font-semibold text-right">{t("fin.allocated")}</th>
              <th scope="col" className="py-2 pl-3 font-semibold text-right">{t("fin.spent")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.currency} className="border-b border-border last:border-b-0">
                <th scope="row" className="py-2.5 pr-3 font-display font-semibold">{r.currency}</th>
                <td className="py-2.5 px-3 text-right tabular-nums">{fmt(r.received, r.currency)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{fmt(r.allocated, r.currency)}</td>
                <td className="py-2.5 pl-3 text-right tabular-nums font-semibold">{fmt(r.spent, r.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">{t("fin.noFx")}</p>
    </div>
  );
}
