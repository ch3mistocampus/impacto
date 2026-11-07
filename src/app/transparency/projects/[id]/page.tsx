import { Suspense } from "react";
import { ProjectDetail } from "@/components/public/ProjectDetail";
import { ProjectCommunity } from "@/components/community/ProjectCommunity";

export default function TransparencyProjectPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDetail backHref="/transparency" />
      <ProjectCommunity />
    </Suspense>
  );
}
