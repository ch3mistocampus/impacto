"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { FlagBand, Kicker } from "@/components/ui/tricolor";
import { Button, Skeleton, ToastProvider } from "./ui";

/** Client-side convenience gate. Real authorization is enforced server-side in convex/coordinator.ts. */
export function CoordinatorGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, signInAs } = useSession();
  const [busy, setBusy] = useState(false);

  let body: ReactNode;
  if (user === undefined) {
    body = (
      <div className="pt-8">
        <Skeleton rows={3} />
      </div>
    );
  } else if (!user || user.role !== "coordinator") {
    body = (
      <div className="mx-auto max-w-xl pt-12 pb-8 sm:pt-20">
        <div className="relative rounded-[2px] border border-border bg-surface px-6 pb-8 pt-10 text-center sm:px-10">
          <FlagBand className="absolute inset-x-0 top-0" />
          <LockGlyph className="mx-auto size-8" />
          <Kicker className="mt-4">{t("coord.private.restricted")}</Kicker>
          <h1 className="mt-1 font-display text-4xl font-normal leading-tight sm:text-5xl">{t("coord.gate.title")}</h1>
          <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted">{t("coord.gate.body")}</p>
          {user && <p className="mt-3 text-sm font-semibold text-gold-ink">{t("coord.gate.wrongRole")}</p>}
          <Button
            variant="primary"
            size="lg"
            className="mt-7 w-full sm:w-auto"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signInAs("coordinator");
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("coord.gate.signIn")}
          </Button>
        </div>
      </div>
    );
  } else {
    body = children;
  }

  return <ToastProvider>{body}</ToastProvider>;
}

export function LockGlyph({ className = "size-9" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="4.5" y="10.5" width="15" height="10" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
