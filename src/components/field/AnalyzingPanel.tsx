"use client";

import { useI18n } from "@/lib/i18n";
import { FlagBand } from "@/components/ui/tricolor";
import { LockIcon } from "./ui";

export function AnalyzingPanel({ withAudio = false }: { withAudio?: boolean }) {
  const { t } = useI18n();
  return (
    <section className="mx-auto mt-10 max-w-md border border-border bg-surface">
      <FlagBand />
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-5 px-6 py-10 text-center">
        {/* Three quiet dots; static under reduced motion. */}
        <div aria-hidden className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 bg-foreground animate-pulse motion-reduce:animate-none"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
        <h2 className="font-display text-[28px] font-normal italic leading-tight">{t("field.analyzing")}</h2>
        <p className="flex items-start gap-2 text-left text-[15px] leading-relaxed text-muted">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
          {t(withAudio ? "field.analyzing.bodyAudio" : "field.analyzing.body")}
        </p>
        <p className="border-t border-border pt-4 text-sm text-muted">{t("field.analyzing.slow")}</p>
      </div>
    </section>
  );
}
