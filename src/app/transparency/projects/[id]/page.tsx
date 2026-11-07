import { Suspense } from "react";
import { ProjectDetail } from "@/components/public/ProjectDetail";

export default function TransparencyProjectPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDetail backHref="/transparency" />
    </Suspense>
  );
}
