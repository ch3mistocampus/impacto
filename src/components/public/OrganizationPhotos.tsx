"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { Kicker } from "@/components/ui/tricolor";

const PHOTOS = [
  {
    key: "roof",
    src: "/espejo-de-agua/ibanacuara-roof.webp",
    source: "https://www.espejodeagua.org/emergencia.html",
  },
  {
    key: "road",
    src: "/espejo-de-agua/earthquake-road.webp",
    source: "https://www.espejodeagua.org/emergencia.html",
  },
] as const;

/**
 * Official archive imagery retains its context, separate from the demo project's evidence.
 * Only photos without identifiable people are shown (the page promises "no names, no faces").
 */
export function OrganizationPhotos() {
  const { t } = useI18n();
  return (
    <section id="official-archive" className="mt-20 scroll-mt-28 sm:mt-28" aria-labelledby="archive-title">
      <div className="flex flex-col gap-5 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <Kicker>{t("landing.archive.kicker")}</Kicker>
          <h2 id="archive-title" className="mt-2 font-display text-[2rem] font-normal leading-tight sm:text-[2.75rem]">
            {t("landing.archive.title")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{t("landing.archive.body")}</p>
        </div>
        <a href="https://www.espejodeagua.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-3 text-sm font-semibold underline underline-offset-4">
          <Image src="/espejo-de-agua/logo.png" alt="" width={40} height={40} />
          {t("landing.archive.site")}
        </a>
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {PHOTOS.map((photo) => (
          <figure key={photo.key} className="min-w-0">
            <Image
              src={photo.src}
              alt={t(`landing.archive.${photo.key}.alt`)}
              width={1200}
              height={900}
              sizes="(min-width: 1152px) 544px, (min-width: 768px) 48vw, 100vw"
              className="h-auto w-full rounded-[2px] border border-border"
            />
            <figcaption className="mt-3">
              <p className="font-display text-xl">{t(`landing.archive.${photo.key}.caption`)}</p>
              <a href={photo.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4">
                {t("landing.archive.credit")}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
