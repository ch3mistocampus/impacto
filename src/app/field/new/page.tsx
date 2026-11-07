"use client";

import { FieldGate } from "@/components/field/ui";
import { CaptureStep } from "@/components/field/CaptureStep";

export default function NewFieldReportPage() {
  return (
    <FieldGate>
      <CaptureStep />
    </FieldGate>
  );
}
