import { Suspense } from "react";
import { ReviewScreen } from "@/components/coordinator/ReviewScreen";
import { Skeleton } from "@/components/coordinator/ui";
import { CoordinatorGate } from "@/components/coordinator/CoordinatorGate";

/** Alias of /coordinator/[projectId]: needs, six-stage ledger, evidence, financials, milestones. */
async function Project({ params }: { params: PageProps<"/nonprofit/projects/[id]">["params"] }) {
  const { id } = await params;
  return (
    <CoordinatorGate>
      <ReviewScreen projectId={id} />
    </CoordinatorGate>
  );
}

export default function NonprofitProjectPage({ params }: PageProps<"/nonprofit/projects/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="pt-8">
          <Skeleton rows={4} />
        </div>
      }
    >
      <Project params={params} />
    </Suspense>
  );
}
