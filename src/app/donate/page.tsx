import { Suspense } from "react";
import { DonateDeck } from "@/components/donate/DonateDeck";

export default function DonatePage() {
  return (
    <Suspense fallback={null}>
      <DonateDeck />
    </Suspense>
  );
}
