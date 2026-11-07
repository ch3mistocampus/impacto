import type { Metadata } from "next";
import { Suspense } from "react";
import { PresenterConsole } from "@/components/demo/PresenterConsole";

// Presenter-only: not linked from anywhere public, and kept out of search engines.
export const metadata: Metadata = {
  title: "Demo · Impacto",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function DemoPage() {
  return (
    <Suspense fallback={null}>
      <PresenterConsole />
    </Suspense>
  );
}
