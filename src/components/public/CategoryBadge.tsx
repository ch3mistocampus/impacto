"use client";

import { useI18n } from "@/lib/i18n";
import { CategoryMark } from "@/components/ui/tricolor";
import type { Category } from "./types";

/** Program label: shape mark + name in ink, square hairline chip. Programs never carry colour. */
export function CategoryBadge({ category, className = "" }: { category: Category; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-xs font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--rule)] ${className}`}
    >
      <CategoryMark category={category} size={9} />
      {t(`category.${category}`)}
    </span>
  );
}
