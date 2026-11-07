"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { Chip, Kicker } from "@/components/ui/tricolor";

/**
 * Before = REAL Espejo de Agua photos (Ibanacuara earthquake), always credited and captioned in
 * their original context, never presented as a fictional household. After = demo imagery of what
 * Impacto verifies, always labelled as demo. See docs/espejo-de-agua/README.md for usage rules.
 */
const SOURCE = "https://www.espejodeagua.org/galeria.html";
const BEFORE = [
  { key: "collapsed", src: "/espejo-de-agua/ibanacuara-collapsed.webp", w: 1200, h: 1600 },
  { key: "roofs", src: "/espejo-de-agua/ibanacuara-roofs.webp", w: 1200, h: 1600 },
] as const;

function Credit() {
  const { t } = useI18n();
  return (
    <a href={SOURCE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4">
      {t("landing.archive.credit")}
    </a>
  );
}

function ColumnLabel({ label, chip, tone }: { label: string; chip: string; tone: "navy" | "gold" }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="font-display text-2xl">{label}</span>
      <Chip tone={tone}>{chip}</Chip>
    </div>
  );
}

/** Homepage section: two real "before" photos, one demo "after". */
export function BeforeAfterSection() {
  const { t } = useI18n();
  return (
    <section className="mt-20 sm:mt-28" aria-labelledby="ba-title">
      <div className="max-w-2xl border-b border-rule pb-6">
        <Kicker>{t("ba.kicker")}</Kicker>
        <h2 id="ba-title" className="mt-2 font-display text-[2rem] font-normal leading-tight sm:text-[2.75rem]">
          {t("ba.title")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{t("ba.body")}</p>
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <ColumnLabel label={t("ba.before")} chip={t("ba.real")} tone="navy" />
          <div className="grid gap-4 sm:grid-cols-2">
            {BEFORE.map((p) => (
              <figure key={p.key} className="min-w-0">
                <Image
                  src={p.src}
                  alt={t(`ba.${p.key}.alt` as DictKey)}
                  width={p.w}
                  height={p.h}
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 48vw, 100vw"
                  className="aspect-[4/5] h-auto w-full rounded-[2px] border border-border object-cover"
                />
                <figcaption className="mt-2">
                  <p className="font-display text-lg leading-snug">{t(`ba.${p.key}.caption` as DictKey)}</p>
                  <Credit />
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
        <div>
          <ColumnLabel label={t("ba.after")} chip={t("ba.demo")} tone="gold" />
          <figure>
            <Image
              src="/proof/zinc_sheet.jpg"
              alt={t("ba.after.alt")}
              width={480}
              height={360}
              sizes="(min-width: 1024px) 360px, 100vw"
              className="h-auto w-full rounded-[2px] border border-border"
            />
            <figcaption className="mt-2">
              <p className="font-display text-lg leading-snug">{t("ba.after.caption")}</p>
              <p className="mt-2 text-sm text-muted">{t("ba.after.steps")}</p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/**
 * Project page: real program-context "before" (roof/reconstruction programs only) next to this
 * project's latest approved photo. Used only when the project has no before/after evidence of its own.
 */
export function ProjectBeforeAfter({ afterUrl, alias }: { afterUrl: string | null; alias: string }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-4">
      <figure className="min-w-0">
        <Image
          src={BEFORE[0].src}
          alt={t("ba.collapsed.alt")}
          width={BEFORE[0].w}
          height={BEFORE[0].h}
          sizes="(min-width: 768px) 360px, 50vw"
          className="aspect-[4/3] h-auto w-full border border-border object-cover"
        />
        <figcaption className="mt-1.5">
          <span className="flex flex-wrap items-center gap-2 font-display text-[15px] italic">
            {t("ba.before")} <Chip tone="navy">{t("ba.real")}</Chip>
          </span>
          <p className="mt-1 text-[13px] leading-snug text-muted">{t("ba.project.context")}</p>
          <Credit />
        </figcaption>
      </figure>
      <figure className="min-w-0">
        {afterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={afterUrl} alt={`${t("ba.after")}: ${alias}`} className="aspect-[4/3] w-full border border-border object-cover" />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center border border-dashed border-border text-sm text-muted">
            {t("ba.project.none")}
          </div>
        )}
        <figcaption className="mt-1.5">
          <span className="flex flex-wrap items-center gap-2 font-display text-[15px] italic">
            {t("ba.after")} <Chip tone="gold">{t("ba.demo")}</Chip>
          </span>
          <p className="mt-1 text-[13px] leading-snug text-muted">{t("ba.project.after")}</p>
        </figcaption>
      </figure>
    </div>
  );
}
