import { CoordinatorGate } from "@/components/coordinator/CoordinatorGate";
import { CoordinatorDesk } from "@/components/coordinator/CoordinatorDesk";

export default function CoordinatorPage() {
  return (
    <CoordinatorGate>
      <CoordinatorDesk />
    </CoordinatorGate>
  );
}
