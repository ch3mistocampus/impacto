"use client";

import { useI18n } from "@/lib/i18n";
import { Card, LockIcon, Spinner } from "./ui";

export function AnalyzingPanel({ withAudio = false }: { withAudio?: boolean }) {
  const { t } = useI18n();
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-soft text-sky">
          <Spinner className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-semibold">{t("field.analyzing")}</h2>
        <p className="flex items-start gap-2 text-left text-sm text-muted">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t(withAudio ? "field.analyzing.bodyAudio" : "field.analyzing.body")}
        </p>
        <p className="text-xs text-muted">{t("field.analyzing.slow")}</p>
      </div>
    </Card>
  );
}
