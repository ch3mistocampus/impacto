"use client";

import Image from "next/image";
import { useState } from "react";
import { MaterialGlyph } from "@/components/ui/MaterialGlyph";

const MATERIALS = new Set([
  "bricks", "cement_bag", "zinc_sheet", "wood_beam", "nails", "tarp",
  "paint", "rebar", "seeds", "soil", "water_tank", "tools",
]);

type Props = {
  itemKey?: string;
  src?: string;
  /** Program illustration to show when an approved project cover cannot load. */
  fallbackSrc?: string;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: "eager" | "lazy";
};

/** Shared, decorative artwork; approved project photos take precedence over illustrations. */
export function MaterialImage(props: Props) {
  const src = props.src || (props.itemKey && MATERIALS.has(props.itemKey)
    ? `/materials/${props.itemKey}.webp`
    : undefined);

  // A new source gets a fresh loading attempt (e.g. after a project cover is updated).
  return <ImageWithFallback key={`${src ?? ""}:${props.fallbackSrc ?? ""}`} {...props} src={src} />;
}

function ImageWithFallback({
  itemKey, src, fallbackSrc, alt, className = "", sizes = "64px", loading = "lazy",
}: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const imageSrc = [src, fallbackSrc].find((candidate) => candidate && !failed.includes(candidate));

  if (!imageSrc) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`inline-grid place-items-center text-foreground select-none ${className}`}
      >
        <MaterialGlyph itemKey={itemKey} className="size-full max-h-full max-w-full" />
      </span>
    );
  }

  const isLocalIllustration = imageSrc.startsWith("/materials/") || imageSrc.startsWith("/brand/");
  return (
    <span className={`relative inline-block overflow-hidden align-middle bg-[#f6f7fa] select-none ${className}`}>
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes}
        loading={loading}
        // Convex cover URLs are already browser-ready; do not proxy them through the optimizer.
        unoptimized={!isLocalIllustration}
        draggable={false}
        className={isLocalIllustration ? "object-contain" : "object-cover"}
        onError={() => setFailed((previous) => [...previous, imageSrc])}
      />
    </span>
  );
}
