"use client";

import { useState } from "react";

const EMOJI: Record<string, string> = {
  bricks: "🧱",
  cement_bag: "🪨",
  zinc_sheet: "🏚️",
  wood_beam: "🪵",
  nails: "🔩",
  tarp: "⛺",
  paint: "🎨",
  rebar: "🏗️",
  seeds: "🌱",
  soil: "🟫",
  water_tank: "💧",
  tools: "🛠️",
  generic: "📦",
};

/**
 * Material/brand image with a two-step fallback: given src → generic.png → emoji.
 * Uses a plain <img> because these are small static assets that may not exist yet.
 */
export function MaterialImage({
  itemKey,
  src,
  alt,
  className = "",
  emoji,
}: {
  itemKey?: string;
  src?: string;
  alt: string;
  className?: string;
  emoji?: string;
}) {
  const primary = src ?? (itemKey ? `/materials/${itemKey}.png` : "/materials/generic.png");
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [prevPrimary, setPrevPrimary] = useState(primary);
  if (prevPrimary !== primary) {
    setPrevPrimary(primary);
    setStage(0);
  }

  if (stage === 2) {
    return (
      <span role="img" aria-label={alt} className={`grid place-items-center select-none [container-type:size] ${className}`}>
        <span className="text-[clamp(1.75rem,40cqmin,5rem)] leading-none" aria-hidden>
          {emoji ?? EMOJI[itemKey ?? "generic"] ?? EMOJI.generic}
        </span>
      </span>
    );
  }
  const current = stage === 0 ? primary : "/materials/generic.png";
  const fail = () => setStage(stage === 0 && primary !== "/materials/generic.png" ? 1 : 2);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      draggable={false}
      className={`${className.includes("object-") ? "" : "object-contain"} select-none ${className}`}
      onError={fail}
      // SSR'd images can 404 before hydration, so onError never fires: catch that on attach.
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0) queueMicrotask(fail);
      }}
    />
  );
}
