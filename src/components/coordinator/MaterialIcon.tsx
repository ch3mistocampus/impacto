"use client";

import { useState } from "react";

/** Material icon from public/materials/<itemKey>.png (Lane E), with a lettered tile fallback. */
export function MaterialIcon({ itemKey, label, size = 40 }: { itemKey: string; label: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-clay-soft font-display text-lg font-semibold text-clay"
      >
        {label.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/materials/${itemKey}.png`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-md bg-background object-contain"
      style={{ width: size, height: size }}
    />
  );
}
