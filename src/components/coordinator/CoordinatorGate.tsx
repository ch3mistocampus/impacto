"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
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
      <div className="mx-auto max-w-lg pt-16 pb-8">
        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
          <LockGlyph />
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">{t("coord.gate.title")}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{t("coord.gate.body")}</p>
          {user && <p className="mt-3 text-sm text-amber">{t("coord.gate.wrongRole")}</p>}
          <Button
            variant="primary"
            size="lg"
            className="mt-6 w-full sm:w-auto"
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

export function LockGlyph({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`${className} text-brick`} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
