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
  water_tank: { es: "Tanques de agua (1.000 L)", en: "Water tanks (1,000 L)", unit: "unidades" },
  tools: { es: "Kits de herramientas", en: "Tool kits", unit: "kits" },
  // Sanar y sembrar: what an open community gathering needs.
  facilitator: { es: "Facilitadores / acompañantes", en: "Facilitators", unit: "personas" },
  venue: { es: "Espacio para el encuentro", en: "Venue", unit: "unidades" },
  meals: { es: "Refrigerios", en: "Snacks / meals", unit: "porciones" },
  transport: { es: "Transporte", en: "Transport", unit: "viajes" },
  sports_kit: { es: "Balones y uniformes", en: "Balls and jerseys", unit: "unidades" },
  art_supplies: { es: "Kits de taller", en: "Workshop kits", unit: "kits" },
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
  /** Approved expenses get a mock receipt photo unless noReceipt (then it's a field "upload receipt" to-do). */
  expenses?: { amount: number; currency: string; category: string; supplierRegion?: string; localLabor?: boolean; approved: boolean; noReceipt?: boolean }[];
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
    key: "circle_rioblanco",
    alias: "Sanar y sembrar 003",
    category: "heal_sow",
    region: "Rioblanco, Tolima",
    urgency: "medium",
    status: "published",
    by: "marisol",
    daysAgo: 38,
    title: { es: "Círculos de apoyo después de la creciente", en: "Support circles after the river flood" },
    summary: {
      es: "Encuentros abiertos los sábados en la escuela de la vereda: dos psicólogas acompañan a las familias, hay refrigerio y transporte desde las veredas altas.",
      en: "Open Saturday gatherings at the rural school: two psychologists accompany families, with snacks and transport from the upper villages.",
    },
    damage: {
      es: "Después de la creciente muchas familias siguen con miedo y no han tenido un espacio para hablar de lo que pasó.",
      en: "Since the flood many families are still afraid and have had no space to talk about what happened.",
    },
    language: "es",
    transcript:
      "Después de la creciente las familias de la vereda no han vuelto a reunirse. Queremos hacer círculos de apoyo abiertos los sábados en la escuela. Necesitamos 2 psicólogas, 60 refrigerios por encuentro y 4 viajes de chiva para traer a la gente de las veredas altas.",
    translated:
      "Since the flood the families of the village have not gathered again. We want to hold open support circles on Saturdays at the school. We need 2 psychologists, 60 snacks per gathering and 4 trips by chiva bus to bring people down from the upper villages.",
    needs: [
      {
        itemKey: "facilitator", qty: 2, quote: "2 psicólogas",
        nameEs: "Psicólogas", nameEn: "Psychologists", unit: "personas",
        pledges: [{ by: 6, qty: 2, mode: "have_materials", rec: 2, del: 2, used: 2, ver: 2 }],
        handover: "approved",
      },
      {
        itemKey: "meals", qty: 60, quote: "60 refrigerios",
        pledges: [{ by: "luis", qty: 60, mode: "will_buy", rec: 60, del: 60, used: 60, ver: 60 }],
        receipt: "approved",
      },
      {
        itemKey: "transport", qty: 4, quote: "4 viajes de chiva",
        nameEs: "Viajes en chiva", nameEn: "Chiva bus trips",
        pledges: [{ by: 10, qty: 2, mode: "will_buy" }],
      },
    ],
    proposedMilestones: [
      { es: "Apoyos confirmados", en: "Support confirmed" },
      { es: "Primer círculo realizado", en: "First circle held" },
      { es: "Informe del encuentro publicado", en: "Gathering report published" },
    ],
    outcomes: [{ es: "Primer círculo de apoyo realizado: participaron unas 45 personas", en: "First support circle held: about 45 people took part" }],
    private: priv("03", "La junta de acción comunal (ficticia) presta la escuela los sábados."),
    contributions: [{ amount: 800_000, currency: "COP", status: "allocated", donor: "Parroquia Ejemplo San José (ficticia)" }],
    expenses: [
      { amount: 150_000, currency: "COP", category: "Transporte (chiva)", supplierRegion: "Rioblanco, Tolima", approved: true },
      { amount: 400_000, currency: "COP", category: "Cocineras locales (refrigerios)", supplierRegion: "Rioblanco, Tolima", localLabor: true, approved: true },
    ],
    followUps: [
      {
        es: "El encuentro empezó con un sancocho compartido y terminó con un círculo de palabra. Varias familias pidieron repetirlo cada mes; mientras tanto los niños jugaron en el patio.",
        en: "The gathering began with a shared sancocho and ended with a talking circle. Several families asked to repeat it every month; meanwhile the children played in the yard.",
        status: "approved",
      },
    ],
  },
  {
    key: "soccer_quibdo",
    alias: "Sanar y sembrar 011",
    category: "heal_sow",
    region: "Quibdó, Chocó",
    urgency: "medium",
    status: "published",
    by: "yuliana",
    daysAgo: 3,
    title: { es: "Torneo de fútbol abierto para el barrio", en: "Open soccer tournament for the neighborhood" },
    summary: {
      es: "Los jóvenes del barrio quieren volver a encontrarse en la cancha después de la inundación. Una cooperativa ofreció el almuerzo; faltan kits de equipo y un árbitro.",
      en: "The neighborhood youth want to meet again on the field after the flood. A cooperative offered lunch; team kits and a referee are still needed.",
    },
    damage: {
      es: "La inundación dejó la cancha en barro y los jóvenes llevan semanas sin un lugar para reunirse.",
      en: "The flood left the field covered in mud and the youth have gone weeks without a place to meet.",
    },
    language: "en",
    transcript:
      "The youth want an open soccer tournament on the community field now that the mud is cleared. They need 8 team kits with a ball and jerseys, a referee and 100 lunches for players and families.",
    translated:
      "Los jóvenes quieren un torneo de fútbol abierto en la cancha comunal ahora que se limpió el barro. Necesitan 8 kits de equipo con balón y petos, un árbitro y 100 almuerzos para jugadores y familias.",
    needs: [
      {
        itemKey: "sports_kit", qty: 8, quote: "8 team kits with a ball and jerseys",
        nameEs: "Kits de equipo (balón y petos)", nameEn: "Team kits (ball and jerseys)", unit: "kits",
        pledges: [{ by: 8, qty: 4, mode: "have_materials" }],
      },
      { itemKey: "facilitator", qty: 1, quote: "a referee", nameEs: "Árbitro", nameEn: "Referee", unit: "personas" },
      {
        itemKey: "meals", qty: 100, quote: "100 lunches", nameEs: "Almuerzos", nameEn: "Lunches",
        pledges: [{ by: 10, qty: 100, mode: "will_buy" }],
      },
    ],
    proposedMilestones: [
      { es: "Apoyos confirmados", en: "Support confirmed" },
      { es: "Torneo realizado", en: "Tournament held" },
      { es: "Informe del encuentro publicado", en: "Gathering report published" },
    ],
    private: priv("04", "El torneo sería un domingo para que vengan las familias."),
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
      { amount: 1_200_000, currency: "COP", category: "Transporte marítimo de materiales", supplierRegion: "San Andrés, San Andrés", approved: true, noReceipt: true },
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
    key: "theatre_providencia",
    alias: "Sanar y sembrar 006",
    category: "heal_sow",
    region: "Providencia, San Andrés",
    urgency: "medium",
    status: "completed",
    by: "yuliana",
    daysAgo: 35,
    endDaysAgo: 6,
    title: { es: "Teatro y cuentos para niños después del huracán", en: "Theatre and stories for children after the hurricane" },
    summary: {
      es: "Funciones abiertas de teatro de títeres y cuentos en la caseta comunal, para que niños y familias volvieran a reír juntos después del huracán.",
      en: "Open puppet theatre and storytelling shows at the community hall, so children and families could laugh together again after the hurricane.",
    },
    damage: {
      es: "Después del huracán los niños del sector tenían miedo con cada lluvia fuerte y no había actividades para ellos.",
      en: "After the hurricane the children in the area were frightened by every heavy rain and there were no activities for them.",
    },
    language: "es",
    transcript:
      "Queremos hacer funciones de teatro y cuentos para los niños del sector después del huracán. Piden 2 cuenteros, 10 kits de títeres y materiales y 80 refrigerios.",
    translated:
      "We want to hold theatre and storytelling shows for the children in the area after the hurricane. They ask for 2 storytellers, 10 puppet and supply kits and 80 snacks.",
    needs: [
      {
        itemKey: "facilitator", qty: 2, quote: "2 cuenteros",
        nameEs: "Cuenteros", nameEn: "Storytellers", unit: "personas",
        direct: { rec: 2, del: 2, used: 2, ver: 2 },
      },
      {
        itemKey: "art_supplies", qty: 10, quote: "10 kits de títeres y materiales",
        pledges: [{ by: 2, qty: 10, mode: "have_materials", rec: 10, del: 10, used: 10, ver: 10 }],
        handover: "approved",
      },
      {
        itemKey: "meals", qty: 80, quote: "80 refrigerios",
        pledges: [{ by: 13, qty: 80, mode: "will_buy", rec: 80, del: 80, used: 80, ver: 80 }],
        receipt: "approved",
      },
    ],
    proposedMilestones: [
      { es: "Apoyos confirmados", en: "Support confirmed" },
      { es: "Funciones realizadas", en: "Shows held" },
    ],
    outcomes: [
      { es: "3 funciones de teatro y cuentos realizadas en la caseta comunal", en: "3 theatre and storytelling shows held at the community hall" },
      { es: "Asistieron unas 120 personas entre niños y familias", en: "About 120 people attended, children and families together" },
    ],
    private: priv("10", "Grupo de madres (ficticio) coordinó las funciones."),
    contributions: [{ amount: 500_000, currency: "COP", status: "allocated", donor: "Paola G. (ficticia)" }],
    expenses: [{ amount: 280_000, currency: "COP", category: "Transporte de cuenteros (lancha)", supplierRegion: "San Andrés, San Andrés", approved: true }],
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
    title: { es: "Encuentro de memoria y oración tras la inundación", en: "Remembrance and prayer gathering after the flood" },
    summary: {
      es: "Las familias quieren una tarde abierta de memoria y oración en el salón comunal, con acompañamiento psicosocial y comida compartida.",
      en: "Families want an open afternoon of remembrance and prayer at the community hall, with psychosocial support and a shared meal.",
    },
    damage: {
      es: "La inundación se llevó casas y cosechas; la comunidad no ha tenido un momento para despedir lo perdido.",
      en: "The flood took homes and harvests; the community has not had a moment to mourn what was lost.",
    },
    language: "es",
    transcript:
      "Después de la inundación las familias quieren un encuentro de memoria y oración en el salón comunal. Necesitamos un acompañante psicosocial, el salón comunal por una tarde y comida para unas 70 personas.",
    translated:
      "After the flood the families want a remembrance and prayer gathering at the community hall. We need a psychosocial companion, the community hall for an afternoon and food for about 70 people.",
    needs: [
      { itemKey: "facilitator", quote: "un acompañante psicosocial", nameEs: "Acompañante psicosocial", nameEn: "Psychosocial companion", unit: "personas" },
      { itemKey: "venue", qty: 1, quote: "el salón comunal por una tarde", nameEs: "Salón comunal (una tarde)", nameEn: "Community hall (one afternoon)", unit: "tardes" },
      { itemKey: "meals", qty: 70, quote: "comida para unas 70 personas", approximate: true },
    ],
    missingQuestions: [{ es: "¿Qué fecha prefieren las familias para el encuentro?", en: "What date do the families prefer for the gathering?" }],
    proposedMilestones: [
      { es: "Apoyos confirmados", en: "Support confirmed" },
      { es: "Encuentro realizado", en: "Gathering held" },
    ],
    private: priv("11", "La parroquia y la iglesia evangélica del pueblo (ficticias) quieren participar juntas."),
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
    title: { es: "Talleres de cocina sanadora", en: "Healing-cooking workshops" },
    summary: {
      es: "Un grupo de mujeres quiere abrir talleres mensuales de cocina sanadora para toda la vereda. Piden kits de taller, una cocinera tallerista y transporte.",
      en: "A women's group wants to open monthly healing-cooking workshops for the whole village. They ask for workshop kits, a cook to lead them and transport.",
    },
    damage: {
      es: "Encuentro comunitario; no hay daños físicos que reparar.",
      en: "Community gathering; no physical damage to repair.",
    },
    language: "en",
    transcript:
      "I met with the women's group. They want monthly healing-cooking workshops open to the whole village. They need 3 workshop kits, a cook to lead the sessions and transport for about 20 people from the upper villages.",
    translated:
      "Me reuní con el grupo de mujeres. Quieren talleres mensuales de cocina sanadora abiertos a toda la vereda. Necesitan 3 kits de taller, una cocinera que guíe las sesiones y transporte para unas 20 personas de las veredas altas.",
    needs: [
      { itemKey: "art_supplies", qty: 3, quote: "3 workshop kits", nameEs: "Kits de taller de cocina", nameEn: "Cooking workshop kits" },
      { itemKey: "facilitator", quote: "a cook to lead the sessions", nameEs: "Cocinera tallerista", nameEn: "Workshop cook", unit: "personas" },
      { itemKey: "transport", qty: 20, quote: "transport for about 20 people", approximate: true, unit: "personas" },
    ],
    proposedMilestones: [
      { es: "Apoyos confirmados", en: "Support confirmed" },
      { es: "Primer taller realizado", en: "First workshop held" },
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
    project: "circle_rioblanco", kind: "thanks", language: "es", status: "approved", daysAgo: 4,
    message: "Gracias por el encuentro del sábado. Nos hacía falta volver a vernos.",
    response: { es: "¡Gracias a ustedes por venir! El próximo círculo es el primer sábado del mes.", en: "Thank you for coming! The next circle is the first Saturday of the month." },
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
    project: "soccer_quibdo", kind: "question", language: "es", status: "pending", byRosa: true, daysAgo: 1,
    message: "¿Las niñas también pueden armar equipo para el torneo?",
  },
  {
    project: "roof_providencia", kind: "question", language: "es", status: "hidden", daysAgo: 3,
    message: "Mensaje ocultado por moderación: incluía datos personales de una vecina (texto sintético).",
  },
];
