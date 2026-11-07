"use client";

import { useI18n } from "@/lib/i18n";
import { CATEGORY_STYLE, type Category } from "./types";

export function CategoryBadge({ category, className = "" }: { category: Category; className?: string }) {
  const { t } = useI18n();
  const s = CATEGORY_STYLE[category];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.soft} ${s.text} ${className}`}
    >
      <span className={`size-2 rounded-[2px] ${s.bg}`} aria-hidden />
      {t(`category.${category}`)}
    </span>
  );
}
