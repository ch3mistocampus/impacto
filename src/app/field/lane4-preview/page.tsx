"use client";
// TEMPORARY visual preview for lane 4 — delete after screenshots.
import { Editor } from "@/components/field/ProjectScreen";
import { FieldGate } from "@/components/field/ui";

const T = "Estamos ayudando a una familia cuya casa sufrió daños. Necesitamos aproximadamente 200 ladrillos, 15 bolsas de cement y materiales para reparar el techo.";
const data = {
  project: { _id: "x", category: "reconstruction", titleEs: "Reparación de vivienda: paredes y techo", titleEn: "Home repair: walls and roof", summaryEs: "Una familia necesita reparar paredes y techo dañados.", summaryEn: "A family needs to repair damaged walls and roof.", urgency: "high", status: "draft", _creationTime: 0 },
  report: { _id: "r", transcriptOriginal: T, transcriptTranslated: "We are helping a family...", language: "es", hasAudio: false, aiStatus: "done", aiError: null, reviewStatus: "pending",
    draftExtraction: { source: "openrouter", model: "gpt-4o-mini", redactions: 1, titleEs: "", titleEn: "", category: "reconstruction", summaryEs: "", summaryEn: "", urgency: "high",
      damageDescriptionEs: "Paredes agrietadas y techo con filtraciones.", damageDescriptionEn: "Cracked walls and leaking roof.",
      materials: [{ itemKey: "bricks", sourceQuote: "aproximadamente 200 ladrillos", approximate: true }, { itemKey: "cement_bag", sourceQuote: "15 bolsas de cement" }],
      missingQuestions: [{ es: "¿Cuántas láminas de zinc se necesitan?", en: "How many zinc sheets?" }],
      proposedMilestones: [{ es: "Entrega de materiales", en: "Materials delivered" }, { es: "Paredes reparadas", en: "Walls repaired" }],
      transcriptTranslated: null, photoSuggestions: [] } },
  needs: [
    { _id: "n1", itemKey: "bricks", nameEs: "Ladrillos", nameEn: "Bricks", requestedQty: 200, unit: "unidades", needsConfirmation: false, aiSuggested: true },
    { _id: "n2", itemKey: "cement_bag", nameEs: "Cemento", nameEn: "Cement", requestedQty: 15, unit: "bolsas", needsConfirmation: false, aiSuggested: true },
    { _id: "n3", itemKey: "zinc_sheet", nameEs: "Láminas de zinc", nameEn: "Zinc sheets", requestedQty: null, unit: "láminas", needsConfirmation: true, aiSuggested: true },
  ],
  photos: [],
  private: null,
};
export default function P() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <FieldGate><Editor data={data as any} onReanalyze={() => {}} /></FieldGate>;
}
