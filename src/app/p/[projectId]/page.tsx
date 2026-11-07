import { Suspense } from "react";
import { ProjectDetail } from "@/components/public/ProjectDetail";

export default function ProjectPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDetail />
    </Suspense>
  );
}
