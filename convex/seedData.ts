/**
 * SYNTHETIC demo dataset for Espejo de Agua's recovery program in Colombia.
 * Everything here is fictional: no real people, households or addresses. Regions are coarse
 * (municipality, department). Private fields are obviously fake ("Familia Ejemplo", "(falso)").
 * Consumed by convex/seed.ts. No Convex functions live in this file.
 */
import type { Doc } from "./_generated/dataModel";

export type Role = Doc<"users">["role"];
export type Cat = Doc<"projects">["category"];
export type Status = Doc<"projects">["status"];
export type Urgency = Doc<"projects">["urgency"];
type Bi = { es: string; en: string };

export const DEMO_TRANSCRIPT =
  "Estamos ayudando a una familia cuya casa sufrió daños. Necesitamos aproximadamente 200 ladrillos, 15 bolsas de cemento y materiales para reparar el techo.";
export const DEMO_TRANSCRIPT_EN =
  "We are helping a family whose house was damaged. We need approximately 200 bricks, 15 bags of cement and materials to repair the roof.";

/** Demo personas. `key` is internal; the FIRST entry of each role is the signable primary persona. */
export const DEMO_USERS: { key: string; role: Role; name: string; email: string; withNonprofit: boolean }[] = [
  { key: "marisol", role: "field_worker", name: "Marisol (demo)", email: "marisol.demo@example.org", withNonprofit: true },
  { key: "ana", role: "coordinator", name: "Coordinadora Ana (demo)", email: "ana.demo@example.org", withNonprofit: true },
  { key: "luis", role: "donor", name: "Donante Luis (demo)", email: "luis.demo@example.org", withNonprofit: false },
  { key: "rosa", role: "community", name: "Vecina Rosa (demo)", email: "rosa.demo@example.org", withNonprofit: false },
  // Extra (non-primary) field workers — inserted after the primary so `by_role .first()` stays Marisol.
  { key: "jhon", role: "field_worker", name: "Jhon Fredy (demo)", email: "jhonfredy.demo@example.org", withNonprofit: true },
  { key: "yuliana", role: "field_worker", name: "Yuliana (demo)", email: "yuliana.demo@example.org", withNonprofit: true },
];
export type FieldWorkerKey = "marisol" | "jhon" | "yuliana";

/** Colombian names/units per itemKey (icons: public/materials/<itemKey>.png). */
export const MATERIALS: Record<string, { es: string; en: string; unit: string }> = {
  bricks: { es: "Ladrillos", en: "Bricks", unit: "unidades" },
  cement_bag: { es: "Bultos de cemento", en: "Cement bags (50 kg)", unit: "bultos" },
  zinc_sheet: { es: "Tejas de zinc", en: "Zinc roofing sheets", unit: "tejas" },
  wood_beam: { es: "Vigas de madera", en: "Wood beams", unit: "unidades" },
  nails: { es: "Cajas de puntillas", en: "Boxes of nails", unit: "cajas" },
  tarp: { es: "Lonas impermeables", en: "Waterproof tarps", unit: "unidades" },
  paint: { es: "Galones de pintura", en: "Gallons of paint", unit: "galones" },
  rebar: { es: "Varillas corrugadas", en: "Rebar rods", unit: "unidades" },
  seeds: { es: "Sobres de semillas", en: "Seed packets", unit: "sobres" },
  soil: { es: "Bultos de abono", en: "Bags of compost", unit: "bultos" },
  water_tank: { es: "Tanques de agua (1.000 L)", en: "Water tanks (1,000 L)", unit: "unidades" },
  tools: { es: "Kits de herramientas", en: "Tool kits", unit: "kits" },
};

/** Fictional donors. Contacts are fake and private (coordinators only). */
export const DONORS: { name: string; contact: string }[] = [
  { name: "Ferretería Ejemplo La Esperanza (ficticia)", contact: "ferreteria.ejemplo@example.org" },
  { name: "Carlos M. (ficticio)", contact: "300 000 0001 (falso)" },
  { name: "Parroquia Ejemplo San José (ficticia)", contact: "parroquia.ejemplo@example.org" },
  { name: "Diana R. (ficticia)", contact: "diana.ejemplo@example.org" },
  { name: "Colectivo Universitario Ejemplo (ficticio)", contact: "colectivo.ejemplo@example.org" },
  { name: "Andrés P. (ficticio)", contact: "300 000 0002 (falso)" },
  { name: "Fundación Ejemplo Raíces (ficticia)", contact: "raices.ejemplo@example.org" },
  { name: "Paola G. (ficticia)", contact: "paola.ejemplo@example.org" },
  { name: "Grupo Scout Ejemplo 12 (ficticio)", contact: "scouts.ejemplo@example.org" },
  { name: "Hernán T. (ficticio)", contact: "300 000 0003 (falso)" },
  { name: "Cooperativa Ejemplo del Café (ficticia)", contact: "coopcafe.ejemplo@example.org" },
  { name: "Lucía V. (ficticia)", contact: "lucia.ejemplo@example.org" },
  { name: "Constructora Ejemplo S.A.S. (ficticia)", contact: "constructora.ejemplo@example.org" },
  { name: "Familia donante Ejemplo (ficticia)", contact: "300 000 0004 (falso)" },
];

/** Progress of a quantity through the ledger. Each stage <= the previous one. */
export type Flow = { rec?: number; del?: number; used?: number; ver?: number };

export type SeedPledge = Flow & {
  by: "luis" | number; // "luis" = the signable demo donor persona (donorUserId set); number = DONORS index
  qty: number;
  mode: Doc<"pledges">["mode"];
  status?: Doc<"pledges">["status"]; // default: "fulfilled" if rec === qty, else "active"
};

type EvStatus = "approved" | "pending";
export type SeedNeed = {
  itemKey: keyof typeof MATERIALS;
  qty?: number; // undefined => needs confirmation
  quote: string; // MUST appear verbatim in the transcript (asserted at seed time)
  approximate?: boolean;
  nameEs?: string;
  nameEn?: string;
  unit?: string;
  status?: Doc<"materialNeeds">["status"]; // default derived from project status
  pledges?: SeedPledge[];
  direct?: Flow; // received outside any pledge (e.g. bought with contributions)
  receipt?: EvStatus; // receipt evidence on the first "received" event
  handover?: EvStatus; // signed handover doc on the first "delivered" event
  usedNote?: EvStatus; // staff note on the first "used" event (pending => awaiting verification)
};

export type SeedProject = {
  key: string;
  alias: string;
  category: Cat;
  region: string;
  urgency: Urgency;
  status: Status;
  by: FieldWorkerKey;
  /** For public projects: days since publication. For others: days since creation. */
  daysAgo: number;
  /** For completed projects: days ago the last activity happened. */
  endDaysAgo?: number;
  title: Bi;
  summary: Bi;
  damage: Bi;
  language: "es" | "en";
  transcript: string;
  translated: string;
  needs: SeedNeed[];
  missingQuestions?: Bi[];
  proposedMilestones: Bi[];
  reviewStatus?: Doc<"fieldReports">["reviewStatus"]; // default derived from status
  coordinatorNote?: string; // appended to fieldReports.missingQuestions
  pause?: Bi;
  outcomes?: Bi[];
  private: { beneficiaryName: string; privateAddress: string; contact: string; privateNotes: string };
  contributions?: { amount: number; currency: string; status: Doc<"donations">["status"]; donor: string }[];
  expenses?: { amount: number; currency: string; category: string; supplierRegion?: string; localLabor?: boolean; approved: boolean }[];
  photoSuggestion?: boolean; // seed a private photo + AI photoSuggestions example (draft only)
  followUps?: { es: string; en: string; status: "approved" | "pending" }[];
};

const priv = (n: string, notes: string) => ({
  beneficiaryName: `Familia Ejemplo ${n}`,
  privateAddress: `Vereda ficticia ${n} (dirección sintética)`,
  contact: `300 000 00${n} (falso)`,
  privateNotes: `Datos ficticios para la demostración. ${notes}`,
});

export const PROJECTS: SeedProject[] = [
  // ───────────────────────────── PUBLISHED ─────────────────────────────
  {
    key: "roof_mocoa",
    alias: "Techo y abrigo 014",
    category: "roof_shelter",
    region: "Mocoa, Putumayo",
    urgency: "high",
    status: "published",
    by: "marisol",
    daysAgo: 30,
    title: { es: "Techo nuevo tras la avenida torrencial", en: "New roof after the flash flood" },
    summary: {
      es: "La avenida torrencial dañó el techo de una vivienda rural. Con tejas de zinc, puntillas y lonas la familia puede volver a dormir bajo techo seco.",
      en: "A flash flood damaged the roof of a rural home. With zinc sheets, nails and tarps the family can sleep under a dry roof again.",
    },
    damage: {
      es: "Techo de zinc parcialmente desprendido; filtraciones en las dos habitaciones.",
      en: "Zinc roof partially torn off; leaks in both bedrooms.",
    },
    language: "es",
    transcript:
      "En la vereda la avenida torrencial dañó el techo de una casa. Se necesitan unas 30 tejas de zinc, 4 cajas de puntillas y 6 lonas para cubrir mientras tanto. La familia está durmiendo donde un vecino.",
    translated:
      "In the rural district the flash flood damaged a house's roof. About 30 zinc sheets, 4 boxes of nails and 6 tarps are needed to cover it in the meantime. The family is sleeping at a neighbor's.",
    needs: [
      {
        itemKey: "zinc_sheet", qty: 30, quote: "unas 30 tejas de zinc", approximate: true,
        pledges: [
          { by: "luis", qty: 12, mode: "will_buy", rec: 12, del: 12, used: 12 },
          { by: 1, qty: 8, mode: "have_materials" },
        ],
        handover: "approved", usedNote: "pending",
      },
      { itemKey: "nails", qty: 4, quote: "4 cajas de puntillas", direct: { rec: 4, del: 4, used: 4, ver: 4 }, receipt: "approved" },
      {
        itemKey: "tarp", qty: 6, quote: "6 lonas",
        pledges: [{ by: 0, qty: 6, mode: "have_materials", rec: 6, del: 6, used: 6, ver: 6 }],
      },
    ],
    proposedMilestones: [
      { es: "Lonas instaladas", en: "Tarps installed" },
      { es: "Materiales recibidos", en: "Materials received" },
      { es: "Techo reparado", en: "Roof repaired" },
    ],
    private: priv("01", "La familia pidió que no se publiquen fotos de la fachada."),
    contributions: [
      { amount: 2_400_000, currency: "COP", status: "allocated", donor: "Fundación Ejemplo Raíces (ficticia)" },
      { amount: 1_000_000, currency: "COP", status: "committed", donor: "Donante individual ficticio" },
    ],
    expenses: [
      { amount: 112_000, currency: "COP", category: "Puntillas (4 cajas)", supplierRegion: "Mocoa, Putumayo", approved: true },
      { amount: 600_000, currency: "COP", category: "Mano de obra local (techado)", supplierRegion: "Mocoa, Putumayo", localLabor: true, approved: true },
      { amount: 180_000, currency: "COP", category: "Transporte de materiales", supplierRegion: "Mocoa, Putumayo", approved: false },
    ],
    followUps: [
      {
        es: "Ya se instalaron 12 tejas sobre las habitaciones; falta cubrir la cocina.",
        en: "12 sheets are already installed over the bedrooms; the kitchen still needs covering.",
        status: "approved",
      },
    ],
  },
  {
    key: "wall_gramalote",
    alias: "Reconstrucción 007",
    category: "reconstruction",
    region: "Gramalote, Norte de Santander",
    urgency: "high",
    status: "published",
    by: "jhon",
    daysAgo: 21,
    title: { es: "Reconstruir la pared trasera de una vivienda", en: "Rebuild a home's back wall" },
    summary: {
      es: "Un movimiento de tierra agrietó y tumbó la pared trasera de una casa. Se necesitan ladrillos, cemento y varillas para reconstruirla de forma segura.",
      en: "Ground movement cracked and toppled a home's back wall. Bricks, cement and rebar are needed to rebuild it safely.",
    },
    damage: {
      es: "Pared trasera colapsada y grietas en la pared lateral.",
      en: "Back wall collapsed and cracks in the side wall.",
    },
    language: "es",
    transcript:
      "Con el movimiento de tierra se agrietó y se cayó la pared de atrás de la vivienda. Calculamos 400 ladrillos, 20 bultos de cemento y 12 varillas. Todavía no sabemos cuántas vigas de madera hacen falta.",
    translated:
      "With the ground movement the back wall of the home cracked and fell. We estimate 400 bricks, 20 bags of cement and 12 rebar rods. We still don't know how many wood beams are needed.",
    needs: [
      {
        itemKey: "bricks", qty: 400, quote: "400 ladrillos",
        pledges: [
          { by: 2, qty: 100, mode: "have_materials" },
          { by: 3, qty: 150, mode: "will_buy", rec: 150, del: 150, used: 90 },
        ],
        handover: "pending",
      },
      {
        itemKey: "cement_bag", qty: 20, quote: "20 bultos de cemento",
        pledges: [{ by: "luis", qty: 10, mode: "will_buy", rec: 10, del: 10 }],
        direct: { rec: 4 },
        receipt: "approved",
      },
      { itemKey: "rebar", qty: 12, quote: "12 varillas", pledges: [{ by: 4, qty: 12, mode: "request_instructions", status: "canceled" }] },
      { itemKey: "wood_beam", quote: "cuántas vigas de madera hacen falta" },
    ],
    missingQuestions: [{ es: "¿Cuántas vigas de madera se necesitan y de qué largo?", en: "How many wood beams are needed, and how long?" }],
    proposedMilestones: [
      { es: "Materiales recibidos", en: "Materials received" },
      { es: "Muro reconstruido", en: "Wall rebuilt" },
    ],
    private: priv("02", "Visita técnica pendiente para revisar la pared lateral."),
    contributions: [{ amount: 3_500_000, currency: "COP", status: "received", donor: "Cooperativa Ejemplo del Café (ficticia)" }],
    expenses: [
      { amount: 140_000, currency: "COP", category: "Cemento (4 bultos)", supplierRegion: "Cúcuta, Norte de Santander", approved: true },
      { amount: 900_000, currency: "COP", category: "Maestro de obra local", supplierRegion: "Gramalote, Norte de Santander", localLabor: true, approved: false },
    ],
  },
  {
    key: "garden_rioblanco",
    alias: "Sanar y sembrar 003",
    category: "heal_sow",
    region: "Rioblanco, Tolima",
    urgency: "medium",
    status: "published",
    by: "marisol",
    daysAgo: 38,
    title: { es: "Huerta escolar después de la creciente", en: "School garden after the river flood" },
    summary: {
      es: "La creciente del río se llevó la huerta de una escuela rural. Madres y estudiantes la están resembrando con semillas, abono y mangueras de riego.",
      en: "The river flood washed away a rural school's garden. Mothers and students are replanting it with seeds, compost and irrigation hoses.",
    },
    damage: {
      es: "Huerta escolar arrasada por el agua; suelo lavado y sin sistema de riego.",
      en: "School garden swept away by water; washed-out soil and no irrigation.",
    },
    language: "es",
    transcript:
      "La creciente del río se llevó la huerta de la escuela de la vereda. Las mamás quieren volver a sembrar: piden 40 sobres de semillas, 15 bultos de abono y 50 metros de manguera.",
    translated:
      "The river flood washed away the rural school's garden. The mothers want to plant again: they ask for 40 seed packets, 15 bags of compost and 50 meters of hose.",
    needs: [
      {
        itemKey: "seeds", qty: 40, quote: "40 sobres de semillas",
        pledges: [{ by: "luis", qty: 30, mode: "have_materials", rec: 30, del: 30, used: 30, ver: 30 }],
        direct: { rec: 10, del: 10, used: 10, ver: 10 },
        handover: "approved",
      },
      {
        itemKey: "soil", qty: 15, quote: "15 bultos de abono",
        pledges: [{ by: 5, qty: 15, mode: "will_buy", rec: 15, del: 15, used: 15, ver: 15 }],
        receipt: "approved",
      },
      {
        itemKey: "tools", qty: 50, quote: "50 metros de manguera",
        nameEs: "Mangueras de riego", nameEn: "Irrigation hoses", unit: "metros",
        pledges: [{ by: 6, qty: 20, mode: "will_buy" }],
      },
    ],
    proposedMilestones: [
      { es: "Semillas y abono recibidos", en: "Seeds and compost received" },
      { es: "Huerta sembrada", en: "Garden planted" },
      { es: "Riego instalado", en: "Irrigation installed" },
    ],
    outcomes: [{ es: "Huerta escolar resembrada: 6 eras con cilantro, fríjol y maíz", en: "School garden replanted: 6 beds of cilantro, beans and corn" }],
    private: priv("03", "Contacto con la junta de padres (ficticio)."),
    contributions: [{ amount: 800_000, currency: "COP", status: "allocated", donor: "Parroquia Ejemplo San José (ficticia)" }],
    expenses: [
      { amount: 150_000, currency: "COP", category: "Transporte de abono", supplierRegion: "Chaparral, Tolima", approved: true },
      { amount: 400_000, currency: "COP", category: "Jornales locales (siembra)", supplierRegion: "Rioblanco, Tolima", localLabor: true, approved: true },
    ],
    followUps: [
      {
        es: "Ya salieron las primeras plántulas de cilantro y fríjol; los estudiantes riegan por turnos.",
        en: "The first cilantro and bean seedlings are up; students take turns watering.",
        status: "approved",
      },
    ],
  },
  {
    key: "water_quibdo",
    alias: "Sanar y sembrar 011",
    category: "heal_sow",
    region: "Quibdó, Chocó",
    urgency: "high",
    status: "published",
    by: "yuliana",
    daysAgo: 3,
    title: { es: "Agua y semillas para una huerta comunitaria", en: "Water and seeds for a community garden" },
    summary: {
      es: "La inundación dañó la huerta comunitaria junto a la escuela. Dos tanques de agua, semillas y polisombra permitirán volver a sembrar.",
      en: "The flood damaged the community garden next to the school. Two water tanks, seeds and shade cloth will make replanting possible.",
    },
    damage: {
      es: "Huerta inundada, cultivos perdidos y sin almacenamiento de agua limpia.",
      en: "Flooded garden, crops lost and no clean-water storage.",
    },
    language: "en",
    transcript:
      "The river flooded the community school garden. They need two 1,000-liter water tanks, 30 seed packets and 10 rolls of shade cloth.",
    translated:
      "El río inundó la huerta comunitaria de la escuela. Necesitan dos tanques de agua de 1.000 litros, 30 sobres de semillas y 10 rollos de polisombra.",
    needs: [
      { itemKey: "water_tank", qty: 2, quote: "two 1,000-liter water tanks" },
      { itemKey: "seeds", qty: 30, quote: "30 seed packets" },
      { itemKey: "tarp", qty: 10, quote: "10 rolls of shade cloth", nameEs: "Rollos de polisombra", nameEn: "Rolls of shade cloth", unit: "rollos" },
    ],
    proposedMilestones: [
      { es: "Tanques de agua instalados", en: "Water tanks installed" },
      { es: "Huerta sembrada", en: "Garden planted" },
    ],
    private: priv("04", "La escuela prefiere que la entrega sea entre semana."),
  },
  {
    key: "roof_providencia",
    alias: "Techo y abrigo 022",
    category: "roof_shelter",
    region: "Providencia, San Andrés",
    urgency: "high",
    status: "published",
    by: "marisol",
    daysAgo: 14,
    title: { es: "Techo para una vivienda después del huracán", en: "A roof for a home after the hurricane" },
    summary: {
      es: "El huracán dejó una vivienda sin techo; la familia se cubre con plástico. Se necesitan tejas de zinc, vigas de madera y puntillas.",
      en: "The hurricane left a home without a roof; the family is covering it with plastic. Zinc sheets, wood beams and nails are needed.",
    },
    damage: {
      es: "Techo y parte de la estructura de madera arrancados por el viento.",
      en: "Roof and part of the wooden frame torn off by the wind.",
    },
    language: "es",
    transcript:
      "Después del huracán quedaron varias casas sin techo en el sector. Para esta vivienda pedimos 40 tejas de zinc, 10 vigas de madera y 6 cajas de puntillas. Mientras tanto están con plástico.",
    translated:
      "After the hurricane several houses in the area were left without a roof. For this home we ask for 40 zinc sheets, 10 wood beams and 6 boxes of nails. Meanwhile they are using plastic.",
    needs: [
      {
        itemKey: "zinc_sheet", qty: 40, quote: "40 tejas de zinc",
        pledges: [
          { by: "luis", qty: 10, mode: "will_buy" },
          { by: 7, qty: 15, mode: "have_materials", rec: 15, del: 15 },
        ],
        handover: "pending",
      },
      {
        itemKey: "wood_beam", qty: 10, quote: "10 vigas de madera",
        pledges: [{ by: 8, qty: 10, mode: "will_buy", rec: 10 }],
        receipt: "approved",
      },
      {
        itemKey: "nails", qty: 6, quote: "6 cajas de puntillas",
        pledges: [
          { by: "luis", qty: 4, mode: "have_materials", status: "expired" },
          { by: 9, qty: 2, mode: "have_materials" },
        ],
      },
    ],
    proposedMilestones: [
      { es: "Estructura de madera reparada", en: "Wooden frame repaired" },
      { es: "Techo instalado", en: "Roof installed" },
    ],
    private: priv("05", "Hay un adulto mayor en la vivienda (dato sintético)."),
    contributions: [
      { amount: 1_500, currency: "USD", status: "received", donor: "Fondo institucional ficticio (USD)" },
      { amount: 2_000_000, currency: "COP", status: "committed", donor: "Constructora Ejemplo S.A.S. (ficticia)" },
    ],
    expenses: [
      { amount: 1_200_000, currency: "COP", category: "Transporte marítimo de materiales", supplierRegion: "San Andrés, San Andrés", approved: true },
    ],
    followUps: [
      {
        es: "Llegaron 15 tejas a la bodega comunitaria; esperamos la madera para empezar.",
        en: "15 zinc sheets arrived at the community storeroom; we're waiting for the wood to start.",
        status: "pending",
      },
    ],
  },
  {
    key: "wall_dabeiba",
    alias: "Reconstrucción 018",
    category: "reconstruction",
    region: "Dabeiba, Antioquia",
    urgency: "medium",
    status: "published",
    by: "jhon",
    daysAgo: 5,
    title: { es: "Muro de contención después de un deslizamiento", en: "Retaining wall after a landslide" },
    summary: {
      es: "Un deslizamiento tapó parte de una vivienda. Hay que levantar de nuevo un muro de contención con cemento, ladrillo y varillas.",
      en: "A landslide buried part of a home. A retaining wall must be rebuilt with cement, bricks and rebar.",
    },
    damage: {
      es: "Muro de contención destruido y tierra acumulada contra la vivienda.",
      en: "Retaining wall destroyed and soil piled against the home.",
    },
    language: "es",
    transcript:
      "Un deslizamiento tapó parte de la casa y hay que levantar de nuevo un muro de contención. Hacen falta 25 bultos de cemento, 300 ladrillos y unas varillas, todavía no sabemos cuántas.",
    translated:
      "A landslide buried part of the house and a retaining wall must be rebuilt. 25 bags of cement, 300 bricks and some rebar are needed; we don't know how many yet.",
    needs: [
      { itemKey: "cement_bag", qty: 25, quote: "25 bultos de cemento" },
      { itemKey: "bricks", qty: 300, quote: "300 ladrillos" },
      { itemKey: "rebar", quote: "unas varillas, todavía no sabemos cuántas" },
    ],
    missingQuestions: [{ es: "¿Cuántas varillas pide el maestro de obra?", en: "How many rebar rods does the builder need?" }],
    proposedMilestones: [
      { es: "Tierra retirada", en: "Soil cleared" },
      { es: "Muro de contención construido", en: "Retaining wall built" },
    ],
    private: priv("06", "Acceso solo a pie desde la vía principal."),
  },
  {
    key: "flood_lorica",
    alias: "Techo y abrigo 027",
    category: "roof_shelter",
    region: "Lorica, Córdoba",
    urgency: "medium",
    status: "published",
    by: "yuliana",
    daysAgo: 10,
    title: { es: "Abrigo para una vivienda inundada", en: "Shelter for a flooded home" },
    summary: {
      es: "La inundación del río Sinú entró a varias viviendas. Esta familia necesita lonas de inmediato, tejas de zinc y pintura para terminar.",
      en: "The Sinú river flood entered several homes. This family needs tarps right away, zinc sheets, and paint to finish.",
    },
    damage: {
      es: "Agua dentro de la vivienda durante días; techo con goteras y paredes con humedad.",
      en: "Water inside the home for days; leaking roof and damp walls.",
    },
    language: "en",
    transcript:
      "Floodwater from the Sinú river got into several homes. This family needs 8 tarps to cover the roof right away and about 20 zinc sheets. They also asked for 4 gallons of paint later.",
    translated:
      "El agua de la inundación del río Sinú entró en varias casas. Esta familia necesita 8 lonas para cubrir el techo de inmediato y unas 20 tejas de zinc. También pidieron 4 galones de pintura para después.",
    needs: [
      {
        itemKey: "tarp", qty: 8, quote: "8 tarps",
        pledges: [{ by: "luis", qty: 8, mode: "have_materials", rec: 8 }],
        receipt: "pending",
      },
      { itemKey: "zinc_sheet", qty: 20, quote: "about 20 zinc sheets", approximate: true, pledges: [{ by: 10, qty: 6, mode: "will_buy" }] },
      { itemKey: "paint", qty: 4, quote: "4 gallons of paint" },
    ],
    proposedMilestones: [
      { es: "Lonas instaladas", en: "Tarps installed" },
      { es: "Techo reparado", en: "Roof repaired" },
    ],
    private: priv("07", "Vivienda en zona inundable; la familia evalúa reubicarse."),
    contributions: [{ amount: 600_000, currency: "COP", status: "committed", donor: "Grupo Scout Ejemplo 12 (ficticio)" }],
  },
  // ───────────────────────────── PAUSED ─────────────────────────────
  {
    key: "paused_dabeiba",
    alias: "Reconstrucción 012",
    category: "reconstruction",
    region: "Dabeiba, Antioquia",
    urgency: "medium",
    status: "paused",
    by: "marisol",
    daysAgo: 25,
    title: { es: "Refuerzo de la base de una vivienda en ladera", en: "Reinforcing the foundation of a hillside home" },
    summary: {
      es: "Una vivienda en ladera necesita refuerzo en la base con cemento y varillas, después de una evaluación técnica.",
      en: "A hillside home needs its foundation reinforced with cement and rebar, after a technical assessment.",
    },
    damage: {
      es: "Base de la vivienda socavada por el agua; la ladera sigue inestable.",
      en: "The home's foundation was undermined by water; the slope is still unstable.",
    },
    language: "es",
    transcript:
      "La casa quedó al lado de una ladera que sigue moviéndose. Necesitamos 10 bultos de cemento y 8 varillas para reforzar la base, pero primero que la miren.",
    translated:
      "The house sits next to a slope that keeps moving. We need 10 bags of cement and 8 rebar rods to reinforce the foundation, but it should be inspected first.",
    needs: [
      { itemKey: "cement_bag", qty: 10, quote: "10 bultos de cemento", direct: { rec: 6 }, receipt: "approved" },
      { itemKey: "rebar", qty: 8, quote: "8 varillas", pledges: [{ by: 11, qty: 8, mode: "will_buy" }] },
    ],
    missingQuestions: [{ es: "¿Ya hubo evaluación técnica de la ladera?", en: "Has the slope had a technical assessment?" }],
    proposedMilestones: [
      { es: "Evaluación técnica realizada", en: "Technical assessment done" },
      { es: "Base reforzada", en: "Foundation reinforced" },
    ],
    pause: {
      es: "Pausado por riesgo de deslizamiento en la zona; se reanudará tras evaluación técnica.",
      en: "Paused due to landslide risk in the area; it will resume after a technical assessment.",
    },
    private: priv("08", "Cemento guardado en la bodega de Espejo de Agua mientras se evalúa."),
    contributions: [{ amount: 350_000, currency: "COP", status: "allocated", donor: "Lucía V. (ficticia)" }],
    expenses: [{ amount: 210_000, currency: "COP", category: "Cemento (6 bultos)", supplierRegion: "Dabeiba, Antioquia", approved: true }],
  },
  // ───────────────────────────── COMPLETED ─────────────────────────────
  {
    key: "stairs_salgar",
    alias: "Reconstrucción 004",
    category: "reconstruction",
    region: "Salgar, Antioquia",
    urgency: "low",
    status: "completed",
    by: "marisol",
    daysAgo: 42,
    endDaysAgo: 9,
    title: { es: "Escalas de acceso reconstruidas", en: "Access stairs rebuilt" },
    summary: {
      es: "La avenida torrencial destruyó las escalas de acceso a varias casas. Ya fueron reconstruidas con cemento y varillas donadas.",
      en: "The flash flood destroyed the access stairs to several homes. They have been rebuilt with donated cement and rebar.",
    },
    damage: {
      es: "Escalas de concreto destruidas; acceso peligroso para cinco hogares.",
      en: "Concrete stairs destroyed; unsafe access for five households.",
    },
    language: "es",
    transcript:
      "La avenida torrencial dañó las escalas de acceso a cinco casas de la vereda. Se necesitan 12 bultos de cemento y 10 varillas. La gente baja agarrada de los palos.",
    translated:
      "The flash flood damaged the access stairs to five houses in the rural district. 12 bags of cement and 10 rebar rods are needed. People climb down holding onto posts.",
    needs: [
      {
        itemKey: "cement_bag", qty: 12, quote: "12 bultos de cemento",
        pledges: [
          { by: "luis", qty: 6, mode: "will_buy", rec: 6, del: 6, used: 6, ver: 6 },
          { by: 12, qty: 6, mode: "have_materials", rec: 6, del: 6, used: 6, ver: 6 },
        ],
        handover: "approved",
      },
      { itemKey: "rebar", qty: 10, quote: "10 varillas", direct: { rec: 10, del: 10, used: 10, ver: 10 }, receipt: "approved" },
    ],
    proposedMilestones: [
      { es: "Materiales recibidos", en: "Materials received" },
      { es: "Escalas reconstruidas", en: "Stairs rebuilt" },
    ],
    outcomes: [{ es: "Escalas de acceso reconstruidas y en uso por 5 hogares", en: "Access stairs rebuilt and in use by 5 households" }],
    private: priv("09", "La junta de acción comunal (ficticia) coordinó los convites."),
    contributions: [{ amount: 1_800_000, currency: "COP", status: "allocated", donor: "Colectivo Universitario Ejemplo (ficticio)" }],
    expenses: [
      { amount: 320_000, currency: "COP", category: "Varillas corrugadas (10)", supplierRegion: "Salgar, Antioquia", approved: true },
      { amount: 1_200_000, currency: "COP", category: "Mano de obra local", supplierRegion: "Salgar, Antioquia", localLabor: true, approved: true },
    ],
  },
  {
    key: "garden_providencia",
    alias: "Sanar y sembrar 006",
    category: "heal_sow",
    region: "Providencia, San Andrés",
    urgency: "medium",
    status: "completed",
    by: "yuliana",
    daysAgo: 35,
    endDaysAgo: 6,
    title: { es: "Huerto comunitario recuperado", en: "Community garden restored" },
    summary: {
      es: "El huracán destruyó un huerto comunitario. Con semillas, tanques de agua y herramientas, la comunidad volvió a cosechar.",
      en: "The hurricane destroyed a community garden. With seeds, water tanks and tools, the community is harvesting again.",
    },
    damage: {
      es: "Huerto arrasado, tanques de agua rotos y herramientas perdidas.",
      en: "Garden flattened, water tanks broken and tools lost.",
    },
    language: "es",
    transcript:
      "Queremos recuperar el huerto comunitario que dañó el huracán. Piden 25 sobres de semillas, 2 tanques de agua y 4 kits de herramientas.",
    translated:
      "We want to restore the community garden damaged by the hurricane. They ask for 25 seed packets, 2 water tanks and 4 tool kits.",
    needs: [
      { itemKey: "seeds", qty: 25, quote: "25 sobres de semillas", direct: { rec: 25, del: 25, used: 25, ver: 25 } },
      {
        itemKey: "water_tank", qty: 2, quote: "2 tanques de agua",
        pledges: [{ by: 13, qty: 2, mode: "will_buy", rec: 2, del: 2, used: 2, ver: 2 }],
        receipt: "approved",
      },
      {
        itemKey: "tools", qty: 4, quote: "4 kits de herramientas",
        pledges: [{ by: 2, qty: 4, mode: "have_materials", rec: 4, del: 4, used: 4, ver: 4 }],
        handover: "approved",
      },
    ],
    proposedMilestones: [
      { es: "Tanques de agua instalados", en: "Water tanks installed" },
      { es: "Huerto sembrado", en: "Garden planted" },
    ],
    outcomes: [
      { es: "Huerto comunitario sembrado de nuevo, con riego desde los tanques", en: "Community garden replanted, irrigated from the tanks" },
      { es: "Primera cosecha repartida entre los vecinos del sector", en: "First harvest shared among neighbors in the area" },
    ],
    private: priv("10", "Grupo de mujeres (ficticio) a cargo del huerto."),
    contributions: [{ amount: 500_000, currency: "COP", status: "allocated", donor: "Paola G. (ficticia)" }],
    expenses: [{ amount: 280_000, currency: "COP", category: "Abono y transporte", supplierRegion: "San Andrés, San Andrés", approved: true }],
  },
  // ───────────────────────────── IN REVIEW ─────────────────────────────
  // THE live-demo project: waits in the coordinator inbox. Bricks need is NOT yet published.
  {
    key: "live_demo",
    alias: "Reconstrucción 021",
    category: "reconstruction",
    region: "Salgar, Antioquia",
    urgency: "high",
    status: "in_review",
    by: "marisol",
    daysAgo: 0,
    title: { es: "Reparación de vivienda: paredes y techo", en: "Home repair: walls and roof" },
    summary: {
      es: "Una vivienda sufrió daños. Se necesitan aproximadamente 200 ladrillos, 15 bolsas de cemento y materiales para reparar el techo (cantidad por confirmar).",
      en: "A home was damaged. About 200 bricks, 15 bags of cement and materials to repair the roof (quantity to be confirmed) are needed.",
    },
    damage: {
      es: "Vivienda de una familia con daños en paredes y techo (datos de demostración).",
      en: "A family's home with damaged walls and roof (demo data).",
    },
    language: "es",
    transcript: DEMO_TRANSCRIPT,
    translated: DEMO_TRANSCRIPT_EN,
    needs: [
      { itemKey: "bricks", qty: 200, quote: "aproximadamente 200 ladrillos", approximate: true },
      { itemKey: "cement_bag", qty: 15, quote: "15 bolsas de cemento", approximate: true, nameEs: "Bolsas de cemento", nameEn: "Cement bags", unit: "bolsas" },
      {
        itemKey: "zinc_sheet", quote: "materiales para reparar el techo",
        nameEs: "Materiales de techo (tejas de zinc)", nameEn: "Roofing materials (zinc sheets)", unit: "tejas",
      },
    ],
    missingQuestions: [{ es: "¿Qué materiales para el techo se necesitan y en qué cantidad?", en: "Which roofing materials are needed, and how many?" }],
    proposedMilestones: [
      { es: "Materiales recibidos", en: "Materials received" },
      { es: "Muro reconstruido", en: "Wall rebuilt" },
      { es: "Techo reparado", en: "Roof repaired" },
    ],
    private: {
      beneficiaryName: "Familia Ejemplo 07",
      privateAddress: "Vereda ficticia El Ejemplo, casa sintética 7",
      contact: "300 000 0000 (falso)",
      privateNotes: "Datos ficticios para la demostración.",
    },
  },
  {
    key: "review_lorica",
    alias: "Borrador LR4K",
    category: "heal_sow",
    region: "Lorica, Córdoba",
    urgency: "medium",
    status: "in_review",
    by: "yuliana",
    daysAgo: 2,
    title: { es: "Volver a sembrar pancoger tras la inundación", en: "Replanting food crops after the flood" },
    summary: {
      es: "La inundación dañó los cultivos de pancoger de varias familias. Semillas y abono permitirán volver a sembrar maíz, fríjol y ahuyama.",
      en: "The flood damaged several families' subsistence crops. Seeds and compost will allow replanting corn, beans and squash.",
    },
    damage: {
      es: "Cultivos de pancoger perdidos y suelo con sedimentos.",
      en: "Subsistence crops lost and soil covered in sediment.",
    },
    language: "es",
    transcript:
      "La inundación dañó los cultivos de pancoger de varias familias. Necesitamos 50 sobres de semillas y 20 bultos de abono para volver a sembrar maíz, fríjol y ahuyama.",
    translated:
      "The flood damaged several families' subsistence crops. We need 50 seed packets and 20 bags of compost to replant corn, beans and squash.",
    needs: [
      { itemKey: "seeds", qty: 50, quote: "50 sobres de semillas" },
      { itemKey: "soil", qty: 20, quote: "20 bultos de abono" },
    ],
    missingQuestions: [{ es: "¿Las familias tienen herramientas para sembrar?", en: "Do the families have tools to plant?" }],
    proposedMilestones: [
      { es: "Semillas entregadas", en: "Seeds delivered" },
      { es: "Parcelas sembradas", en: "Plots planted" },
    ],
    private: priv("11", "Lista de familias (ficticia) guardada solo aquí."),
  },
  // ───────────────────────────── DRAFTS ─────────────────────────────
  {
    key: "draft_mocoa_photo",
    alias: "Borrador M0C4",
    category: "roof_shelter",
    region: "Mocoa, Putumayo",
    urgency: "high",
    status: "draft",
    by: "marisol",
    daysAgo: 1,
    title: { es: "Techo levantado por el viento", en: "Roof lifted by the wind" },
    summary: {
      es: "El viento levantó parte del techo de una vivienda. Se necesitan tejas de zinc y puntillas.",
      en: "The wind lifted part of a home's roof. Zinc sheets and nails are needed.",
    },
    damage: {
      es: "Unas 15 tejas dañadas o desprendidas; lluvia entra a la sala.",
      en: "About 15 sheets damaged or detached; rain gets into the living room.",
    },
    language: "es",
    transcript:
      "Visité una casa en la vereda donde el viento levantó parte del techo. Se ven como 15 tejas de zinc dañadas y hacen falta puntillas. Tomé una foto del techo.",
    translated:
      "I visited a house in the rural district where the wind lifted part of the roof. About 15 zinc sheets look damaged and nails are needed. I took a photo of the roof.",
    needs: [
      { itemKey: "zinc_sheet", qty: 15, quote: "como 15 tejas de zinc", approximate: true },
      { itemKey: "nails", quote: "hacen falta puntillas" },
    ],
    missingQuestions: [{ es: "¿Cuántas cajas de puntillas se necesitan?", en: "How many boxes of nails are needed?" }],
    proposedMilestones: [
      { es: "Materiales recibidos", en: "Materials received" },
      { es: "Techo reparado", en: "Roof repaired" },
    ],
    photoSuggestion: true,
    private: priv("12", "Pendiente confirmar si la familia es propietaria (dato sintético)."),
  },
  {
    key: "draft_rioblanco_en",
    alias: "Borrador R1B2",
    category: "heal_sow",
    region: "Rioblanco, Tolima",
    urgency: "low",
    status: "draft",
    by: "marisol",
    daysAgo: 2,
    title: { es: "Banco de semillas de un grupo de mujeres", en: "A women's group seed bank" },
    summary: {
      es: "El cuarto donde un grupo de mujeres guarda su banco de semillas se inundó. Piden un tanque de agua y semillas para resembrar.",
      en: "The room where a women's group keeps its seed bank flooded. They ask for a water tank and seeds to replant.",
    },
    damage: {
      es: "Semillas guardadas se dañaron con la humedad.",
      en: "Stored seeds were ruined by the damp.",
    },
    language: "en",
    transcript:
      "I visited the women's group that runs the seed bank. Their storage room flooded. They need a water tank and around 60 seed packets to replant.",
    translated:
      "Visité al grupo de mujeres que maneja el banco de semillas. Su bodega se inundó. Necesitan un tanque de agua y unos 60 sobres de semillas para resembrar.",
    needs: [
      { itemKey: "water_tank", qty: 1, quote: "a water tank" },
      { itemKey: "seeds", qty: 60, quote: "around 60 seed packets", approximate: true },
    ],
    proposedMilestones: [
      { es: "Semillas entregadas", en: "Seeds delivered" },
      { es: "Banco de semillas reabierto", en: "Seed bank reopened" },
    ],
    private: priv("13", "Reunión del grupo los sábados (dato sintético)."),
  },
  {
    key: "draft_gramalote",
    alias: "Borrador G7M3",
    category: "reconstruction",
    region: "Gramalote, Norte de Santander",
    urgency: "medium",
    status: "draft",
    by: "jhon",
    daysAgo: 1,
    title: { es: "Reparar grietas en dos paredes", en: "Repair cracks in two walls" },
    summary: {
      es: "Una vivienda tiene grietas en dos paredes tras el movimiento de tierra. Se necesitan cemento y pintura.",
      en: "A home has cracks in two walls after ground movement. Cement and paint are needed.",
    },
    damage: { es: "Grietas en dos paredes de carga.", en: "Cracks in two load-bearing walls." },
    language: "es",
    transcript:
      "La casa tiene grietas en dos paredes después del movimiento de tierra. Necesitamos 8 bultos de cemento y pintura para terminar, no sé cuántos galones.",
    translated:
      "The house has cracks in two walls after the ground movement. We need 8 bags of cement and paint to finish; I don't know how many gallons.",
    needs: [
      { itemKey: "cement_bag", qty: 8, quote: "8 bultos de cemento" },
      { itemKey: "paint", quote: "pintura para terminar, no sé cuántos galones" },
    ],
    missingQuestions: [{ es: "¿Cuántos galones de pintura se necesitan?", en: "How many gallons of paint are needed?" }],
    proposedMilestones: [
      { es: "Grietas reparadas", en: "Cracks repaired" },
      { es: "Paredes pintadas", en: "Walls painted" },
    ],
    private: priv("14", "Visita del ingeniero voluntario (ficticio) pendiente."),
  },
  {
    key: "changes_quibdo",
    alias: "Borrador Q8D1",
    category: "roof_shelter",
    region: "Quibdó, Chocó",
    urgency: "medium",
    status: "draft",
    by: "marisol",
    daysAgo: 4,
    reviewStatus: "changes_requested",
    coordinatorNote:
      "Nota de coordinación: confirmen cuántas vigas se necesitan y adjunten una foto del techo sin personas. / Coordinator note: confirm how many beams are needed and attach a roof photo without people.",
    title: { es: "Techo caído por las lluvias", en: "Roof collapsed by the rains" },
    summary: {
      es: "Las lluvias tumbaron parte del techo de una vivienda. Se necesitan tejas de zinc y vigas de madera.",
      en: "The rains brought down part of a home's roof. Zinc sheets and wood beams are needed.",
    },
    damage: { es: "Parte del techo y una viga principal caídos.", en: "Part of the roof and a main beam collapsed." },
    language: "es",
    transcript: "Las lluvias tumbaron parte del techo de la vivienda. Pedimos 12 tejas de zinc y algunas vigas de madera.",
    translated: "The rains brought down part of the home's roof. We ask for 12 zinc sheets and some wood beams.",
    needs: [
      { itemKey: "zinc_sheet", qty: 12, quote: "12 tejas de zinc" },
      { itemKey: "wood_beam", quote: "algunas vigas de madera" },
    ],
    missingQuestions: [{ es: "¿Cuántas vigas de madera se necesitan?", en: "How many wood beams are needed?" }],
    proposedMilestones: [
      { es: "Vigas reemplazadas", en: "Beams replaced" },
      { es: "Techo reparado", en: "Roof repaired" },
    ],
    private: priv("15", "Coordinación pidió más detalle antes de publicar."),
  },
  // ───────────────────────────── ARCHIVED ─────────────────────────────
  {
    key: "rejected_rioblanco",
    alias: "Borrador X2R9",
    category: "reconstruction",
    region: "Rioblanco, Tolima",
    urgency: "low",
    status: "rejected",
    by: "marisol",
    daysAgo: 12,
    coordinatorNote:
      "Archivado: la solicitud no corresponde a daños de la emergencia. / Archived: the request is not related to emergency damage.",
    title: { es: "Pintura para fachada", en: "Paint for a façade" },
    summary: {
      es: "Solicitud de pintura para la fachada de una vivienda sin daños por la emergencia.",
      en: "Request for paint for a home's façade with no emergency damage.",
    },
    damage: { es: "Sin daños estructurales reportados.", en: "No structural damage reported." },
    language: "es",
    transcript:
      "Un vecino pide pintura para la fachada de su casa, que no sufrió daños por la emergencia. Serían 6 galones de pintura.",
    translated:
      "A neighbor asks for paint for his house's façade, which was not damaged by the emergency. It would be 6 gallons of paint.",
    needs: [{ itemKey: "paint", qty: 6, quote: "6 galones de pintura", status: "rejected" }],
    proposedMilestones: [{ es: "Fachada pintada", en: "Façade painted" }],
    private: priv("16", "Se orientó al vecino hacia otros programas (dato sintético)."),
  },
];

/** Moderated community voice. `project` refers to SeedProject.key. */
export const FEEDBACK: {
  project?: string;
  kind: Doc<"communityFeedback">["kind"];
  message: string;
  language: "es" | "en";
  status: Doc<"communityFeedback">["status"];
  response?: Bi;
  contactPrivate?: string;
  byRosa?: boolean;
  daysAgo: number;
}[] = [
  {
    project: "roof_mocoa", kind: "question", language: "es", status: "approved", byRosa: true, daysAgo: 6,
    message: "¿Cuándo terminan de poner el techo? Ya va a empezar la temporada de lluvias.",
    response: {
      es: "Ya se instalaron 12 tejas. Faltan 10 por comprometer; apenas lleguen se termina la cocina.",
      en: "12 sheets are already installed. 10 still need a pledge; as soon as they arrive the kitchen will be finished.",
    },
  },
  {
    project: "garden_rioblanco", kind: "thanks", language: "es", status: "approved", daysAgo: 4,
    message: "Gracias por la huerta, los niños ya están sembrando en el recreo.",
    response: { es: "¡Gracias a las mamás y a los estudiantes que la sacaron adelante!", en: "Thanks to the mothers and students who made it happen!" },
  },
  {
    project: "wall_gramalote", kind: "question", language: "en", status: "approved", daysAgo: 8,
    message: "Can I donate labor instead of materials?",
    response: {
      es: "Sí. Escríbanos desde el formulario de voluntariado; la mano de obra local se coordina con la junta.",
      en: "Yes. Write to us through the volunteer form; local labor is coordinated with the community board.",
    },
  },
  {
    kind: "suggestion", language: "es", status: "approved", byRosa: true, daysAgo: 10,
    message: "Sería bueno leer los informes semanales también en la emisora comunitaria.",
    response: { es: "Buena idea: lo estamos coordinando con la emisora.", en: "Good idea: we're arranging it with the community radio." },
  },
  {
    project: "stairs_salgar", kind: "thanks", language: "es", status: "approved", daysAgo: 7,
    message: "Ahora los abuelos pueden bajar seguros por las escalas. ¡Mil gracias!",
    response: { es: "Gracias por el convite de los vecinos.", en: "Thank you to the neighbors who pitched in." },
  },
  {
    project: "paused_dabeiba", kind: "concern", language: "es", status: "pending", daysAgo: 1,
    message: "La ladera sigue sonando cuando llueve, ¿alguien va a venir a revisar?",
    contactPrivate: "300 000 0000 (falso)",
  },
  {
    project: "water_quibdo", kind: "question", language: "es", status: "pending", byRosa: true, daysAgo: 1,
    message: "¿Los tanques también van a servir para el agua de la escuela?",
  },
  {
    project: "roof_providencia", kind: "question", language: "es", status: "hidden", daysAgo: 3,
    message: "Mensaje ocultado por moderación: incluía datos personales de una vecina (texto sintético).",
  },
];
