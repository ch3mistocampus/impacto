import { MaterialGlyph } from "@/components/ui/MaterialGlyph";

/** Material line drawing in ink on a square paper tile. The name is always printed beside it. */
export function MaterialIcon({ itemKey, label, size = 40 }: { itemKey: string; label: string; size?: number }) {
  void label;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-grid shrink-0 place-items-center rounded-[2px] border border-border bg-paper text-foreground"
    >
      <MaterialGlyph itemKey={itemKey} className="size-[78%]" />
    </span>
  );
}
