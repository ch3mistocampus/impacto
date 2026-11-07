"use client";

import { FieldGate } from "@/components/field/ui";
import { FieldHome } from "@/components/field/FieldHome";

export default function FieldPage() {
  return (
    <FieldGate>
      <FieldHome />
    </FieldGate>
  );
}
