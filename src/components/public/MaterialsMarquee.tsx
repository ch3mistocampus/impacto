"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { Kicker } from "@/components/ui/tricolor";
import { Reveal } from "@/components/motion/Reveal";

const ITEMS = [
  "bricks", "cement_bag", "zinc_sheet", "wood_beam", "water_tank", "seeds",
  "rebar", "tarp", "tools", "soil", "paint", "nails",
] as const;

/**
 * An endless, slow ribbon of the materials donors actually fund. Two copies of the list scroll
 * left in a loop (the second is aria-hidden). Hover/focus pauses it; under reduced motion it
 * becomes a plain swipeable row.
 */
export function MaterialsMarquee() {
  const { t } = useI18n();
  const row = (copy: boolean) => (
    <ul className="marquee-track flex shrink-0 gap-4 pr-4 sm:gap-6 sm:pr-6" aria-hidden={copy || undefined}>
      {ITEMS.map((k) => (
        <li key={k} className="group flex w-36 shrink-0 flex-col items-center sm:w-44">
          <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-[2px] border border-border bg-paper transition-[border-color,box-shadow] duration-300 group-hover:border-rule/40 group-hover:shadow-[0_10px_24px_-16px_rgb(11_42_91/0.55)]">
            <Image
              src={`/materials/${k}.webp`}
              alt=""
              width={176}
              height={176}
              className="size-[78%] object-contain transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.06]"
            />
          </div>
          <span className="mt-2.5 font-display text-lg">{t(`material.${k}` as DictKey)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="mt-20 sm:mt-28" aria-labelledby="materials-title">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Kicker>{t("landing.materials.kicker")}</Kicker>
        <h2 id="materials-title" className="mt-2 font-display text-[2rem] font-normal leading-tight sm:text-[2.75rem]">
          {t("landing.materials.title")}
        </h2>
      </Reveal>
      <Reveal
        variant="fade"
        delay={120}
        className="marquee -mx-4 mt-10 flex overflow-hidden sm:mx-0"
        aria-label={t("landing.materials.label")}
        role="region"
        tabIndex={0}
      >
        {row(false)}
        {row(true)}
      </Reveal>
    </section>
  );
}
