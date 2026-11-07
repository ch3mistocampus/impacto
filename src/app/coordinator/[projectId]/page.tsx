import { Suspense } from "react";
import { ReviewScreen } from "@/components/coordinator/ReviewScreen";
import { Skeleton } from "@/components/coordinator/ui";
import { CoordinatorGate } from "@/components/coordinator/CoordinatorGate";

async function Review({ params }: { params: PageProps<"/coordinator/[projectId]">["params"] }) {
  const { projectId } = await params;
  return (
    <CoordinatorGate>
      <ReviewScreen projectId={projectId} />
    </CoordinatorGate>
  );
}

export default function CoordinatorProjectPage({ params }: PageProps<"/coordinator/[projectId]">) {
  return (
    <Suspense
      fallback={
        <div className="pt-8">
          <Skeleton rows={4} />
        </div>
      }
    >
      <Review params={params} />
    </Suspense>
  );
}
