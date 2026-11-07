import type { Metadata } from "next";
import { Colophon } from "@/components/public/Colophon";

export const metadata: Metadata = { title: "Colophon · Impacto" };

export default function ColophonPage() {
  return <Colophon />;
}
