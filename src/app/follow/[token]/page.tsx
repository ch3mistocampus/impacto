import { Suspense } from "react";
import { FollowPledge } from "@/components/public/FollowPledge";

export default function FollowPage() {
  return (
    <Suspense fallback={null}>
      <FollowPledge />
    </Suspense>
  );
}
