import { MaterialGlyph } from "@/components/ui/MaterialGlyph";
import { CategoryMark } from "@/components/ui/tricolor";
import { isCategory } from "./types";

/**
 * Material / program imagery. Tricolor has no raster assets: materials are drawn as fine line
 * glyphs (MaterialGlyph) and `/brand/<category>.png` paths become a line-drawn program emblem on
 * paper. Props are unchanged from the original image component (`emoji` is accepted and ignored).
 */
export function MaterialImage({
  itemKey,
  src,
  alt,
  className = "",
}: {
  itemKey?: string;
  src?: string;
  alt: string;
  className?: string;
  emoji?: string;
}) {
  const brand = src?.match(/^\/brand\/([a-z_]+)\.png$/)?.[1];
  const a11y = alt ? { role: "img" as const, "aria-label": alt } : { "aria-hidden": true as const };
  const cls = className.replace(/\bobject-\S+/g, "");

  if (src && brand !== undefined) {
    return (
      <span {...a11y} className={`grid place-items-center bg-paper text-foreground select-none [container-type:size] ${cls}`}>
        <Emblem category={isCategory(brand) ? brand : undefined} />
      </span>
    );
  }

  return (
    <span {...a11y} className={`inline-grid place-items-center text-foreground select-none ${cls}`}>
      <MaterialGlyph itemKey={itemKey ?? materialFromSrc(src)} className="size-full max-h-full max-w-full" />
    </span>
  );
}

function materialFromSrc(src?: string) {
  return src?.match(/^\/materials\/([a-z_]+)\.png$/)?.[1];
}

/** A hairline double ring with the program's shape at its centre — or all three for the hero. */
function Emblem({ category }: { category?: Parameters<typeof CategoryMark>[0]["category"] }) {
  return (
    <span
      aria-hidden
      className="relative grid aspect-square w-[clamp(1.5rem,52cqmin,9rem)] place-items-center rounded-full border border-rule"
      style={{ boxShadow: "inset 0 0 0 4px var(--paper), inset 0 0 0 5px var(--gold)" }}
    >
      {category ? (
        <CategoryMark category={category} size={48} className="h-[34%] w-[34%]" />
      ) : (
        <span className="flex items-end gap-[8%] w-[56%] justify-center">
          <CategoryMark category="roof_shelter" size={24} className="h-auto w-[28%]" />
          <CategoryMark category="reconstruction" size={24} className="h-auto w-[28%]" />
          <CategoryMark category="heal_sow" size={24} className="h-auto w-[28%]" />
        </span>
      )}
    </span>
  );
}
