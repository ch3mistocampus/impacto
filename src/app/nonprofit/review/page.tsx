import { CoordinatorGate } from "@/components/coordinator/CoordinatorGate";
import { CoordinatorDesk } from "@/components/coordinator/CoordinatorDesk";

/** Alias of /coordinator (approval queue). Gating stays inside the page (client gate + server-side role checks). */
export default function NonprofitReviewPage() {
  return (
    <CoordinatorGate>
      <CoordinatorDesk />
    </CoordinatorGate>
  );
}
