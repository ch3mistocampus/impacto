import { Suspense } from "react";
import { FieldProjectClient } from "./client";

// Dynamic param is only known at request time; useParams suspends under cacheComponents.
export default function FieldProjectPage() {
  return (
    <Suspense fallback={null}>
      <FieldProjectClient />
    </Suspense>
  );
}
