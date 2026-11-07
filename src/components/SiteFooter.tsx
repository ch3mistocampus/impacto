"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/** Slim site footer: attribution + link to the colophon. */
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-[13px] text-muted">
        <span className="font-display italic">
          {t("app.name")} · {t("app.attributionPrefix")} {t("app.attribution")}
        </span>
        <Link href="/colophon" className="flex min-h-11 items-center underline decoration-1 underline-offset-4 hover:text-foreground">
          {t("nav.colophon")}
        </Link>
      </div>
    </footer>
  );
}
