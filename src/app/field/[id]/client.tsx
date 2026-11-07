"use client";

import { useParams } from "next/navigation";
import { FieldGate } from "@/components/field/ui";
import { ProjectScreen } from "@/components/field/ProjectScreen";

export function FieldProjectClient() {
  const { id } = useParams<{ id: string }>();
  return (
    <FieldGate>
      <ProjectScreen projectId={id} />
    </FieldGate>
  );
}
