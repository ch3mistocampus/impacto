"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Lane B — AI intake via OpenRouter (OpenAI-compatible chat completions), with a deterministic
 * local fallback so the live demo never depends on the network or an API key.
 *
 * PRIVACY — what leaves Convex, and only to OpenRouter:
 *   1. the field report audio, ONLY if the worker left "Send audio to AI for transcription" on
 *      (otherwise no audio is ever uploaded) — call #1 returns a verbatim transcript;
 *   2. the transcript AFTER regex redaction of obvious names / phones / emails — call #2 extracts
 *      the structured draft (so the extraction model never sees the unredacted text);
 *   3. a single photo, ONLY when the worker explicitly presses "Analizar foto con IA" for that
 *      photo and ticks the no-people/no-house-numbers confirmation (never automatic).
 * projectPrivate is NEVER read here. Logs contain model + latency + token counts, never content.
 *
 * Env (Convex dashboard / `npx convex env set`):
 *   OPENROUTER_API_KEY   optional — without it, the fallback extractor is used (voice needs text)
 *   AI_MODEL             default "google/gemini-3.8-flash" (must accept audio + image input)
 */

type Category = "roof_shelter" | "reconstruction" | "heal_sow";
type Urgency = "low" | "medium" | "high";
type Confidence = "high" | "medium" | "low";
type Material = {
  itemKey: string;
  nameEs: string;
  nameEn: string;
  quantity: number | null;
  unit: string;
  confidence: Confidence;
  /** quantity was stated with a qualifier ("aproximadamente", "unos", "about") */
  approximate: boolean;
  sourceQuote: string;
};
type Milestone = { es: string; en: string };
type Extraction = {
  source: "openrouter" | "fallback";
  model?: string;
  notice?: string;
  redactions: number;
  titleEs: string;
  titleEn: string;
  category: Category;
  summaryEs: string;
  summaryEn: string;
  /** AI *suggestion* only — the field worker confirms it. */
  urgency: Urgency;
  damageDescriptionEs: string;
  damageDescriptionEn: string;
  materials: Material[];
  missingQuestions: { es: string; en: string }[];
  proposedMilestones: Milestone[];
  transcriptTranslated: string | null;
};

const ITEM_KEYS = [
  "bricks",
  "cement_bag",
  "zinc_sheet",
  "wood_beam",
  "nails",
  "tarp",
  "paint",
  "rebar",
  "water_tank",
  "tools",
  // Sanar y sembrar: open community gatherings (support circles, workshops, theatre, sport, faith).
  "facilitator",
  "venue",
  "meals",
  "transport",
  "sports_kit",
  "art_supplies",
] as const;

// Keep in sync with DEMO_TRANSCRIPT in src/components/field/ui.tsx
export const DEMO_TRANSCRIPT_ES =
  "Estamos ayudando a una familia cuya casa sufrió daños. Necesitamos aproximadamente 200 ladrillos, 15 bolsas de cemento y materiales para reparar el techo.";
export const DEMO_TRANSCRIPT_EN =
  "We are helping a family whose house was damaged. We need about 200 bricks, 15 bags of cement and materials to fix the roof.";

// ---------------- redaction ----------------

export function redact(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  // emails
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, () => (count++, "[correo]"));
  // phone-like runs with >= 7 digits
  out = out.replace(/\+?\(?\d[\d\s().-]{5,}\d/g, (m) => {
    if (m.replace(/\D/g, "").length < 7) return m;
    count++;
    return "[teléfono]";
  });
  // names after common introducers ("se llama Ana Pérez", "my name is John", "doña Carmen")
  const intro =
    /\b(se llama|me llamo|mi nombre es|su nombre es|llamad[oa]|nombre:|my name is|his name is|her name is|named|name is|don|doña|señor|señora|sr\.|sra\.|mr\.|mrs\.|ms\.)\s+((?:[A-ZÁÉÍÓÚÑ][\wáéíóúñü'-]+)(?:\s+(?:de\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñü'-]+){0,3})/gi;
  out = out.replace(intro, (_m, lead: string, name: string) => {
    // only redact if the captured name is capitalized (avoid "señora mayor")
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(name)) return _m;
    count++;
    return `${lead} [nombre]`;
  });
  return { text: out, count };
}

// ---------------- deterministic fallback ----------------

const NUM: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21,
  veintiun: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400,
  cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900,
  novecientas: 900,
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const MULT: Record<string, number> = { mil: 1000, thousand: 1000, hundred: 100 };
const NUM_JOINERS = new Set(["y", "and"]);
// Qualifiers that make a stated quantity approximate (kept, but flagged + lower confidence).
const VAGUE = new Set([
  "unos", "unas", "aproximadamente", "aprox", "aprox.", "alrededor", "cerca", "casi", "como", "menos", // "más o menos"
  "about", "around", "approximately", "approx", "approx.", "roughly", "nearly", "almost", "some", "estimated",
]);
const CLAUSE_JOINERS = new Set(["y", "e", "and", "con", "with", "ademas", "also", "tambien"]);

const UNIT_WORDS: Record<string, string> = {
  bolsa: "bolsas", bolsas: "bolsas", saco: "sacos", sacos: "sacos", bags: "bolsas", bag: "bolsas",
  plancha: "planchas", planchas: "planchas", lamina: "láminas", laminas: "láminas",
  hoja: "hojas", hojas: "hojas", sheets: "planchas", sheet: "planchas",
  pieza: "piezas", piezas: "piezas", pieces: "piezas", unidades: "unidades", unidad: "unidades",
  units: "unidades", galon: "galones", galones: "galones", gallons: "galones", gallon: "galones",
  libras: "libras", libra: "libras", pounds: "libras", lbs: "libras", rollos: "rollos",
  rollo: "rollos", metros: "metros", metro: "metros", cubetas: "cubetas", cubeta: "cubetas",
  sobres: "sobres", sobre: "sobres", paquetes: "paquetes", paquete: "paquetes",
  cajas: "cajas", caja: "cajas", boxes: "cajas", box: "cajas",
  horas: "horas", hora: "horas", hours: "horas", hour: "horas", porciones: "porciones",
  porcion: "porciones", portions: "porciones", viajes: "viajes", viaje: "viajes", trips: "viajes",
  trip: "viajes", personas: "personas", people: "personas", kits: "kits", kit: "kits",
};
const SKIP = new Set(["de", "del", "of", "the", "los", "las", "el", "la", "más", "mas", "o", "menos"]);

type Catalog = { key: string; stems: string[]; nameEs: string; nameEn: string; unit: string };
const CATALOG: Catalog[] = [
  { key: "bricks", stems: ["ladrillo", "bloque", "brick", "block"], nameEs: "Ladrillos", nameEn: "Bricks", unit: "unidades" },
  { key: "cement_bag", stems: ["cemento", "cement"], nameEs: "Bolsas de cemento", nameEn: "Cement bags", unit: "bolsas" },
  { key: "zinc_sheet", stems: ["zinc", "techo", "roof", "tejado", "plancha"], nameEs: "Materiales de techo (planchas de zinc)", nameEn: "Roofing materials (zinc sheets)", unit: "planchas" },
  { key: "wood_beam", stems: ["madera", "viga", "tabla", "wood", "beam", "lumber", "plywood"], nameEs: "Madera / vigas", nameEn: "Wood beams", unit: "piezas" },
  { key: "nails", stems: ["clavo", "nail", "tornillo", "screw"], nameEs: "Clavos", nameEn: "Nails", unit: "libras" },
  { key: "tarp", stems: ["lona", "toldo", "tarp", "plastico"], nameEs: "Lonas", nameEn: "Tarps", unit: "unidades" },
  { key: "paint", stems: ["pintura", "paint", "sellador", "sealant"], nameEs: "Pintura / sellador", nameEn: "Paint / sealant", unit: "galones" },
  { key: "rebar", stems: ["varilla", "cabilla", "rebar"], nameEs: "Varillas", nameEn: "Rebar", unit: "unidades" },
  { key: "water_tank", stems: ["tanque", "cisterna", "tank"], nameEs: "Tanque de agua", nameEn: "Water tank", unit: "unidades" },
  { key: "tools", stems: ["herramienta", "pala", "martillo", "rastrillo", "tool", "shovel", "hammer"], nameEs: "Herramientas", nameEn: "Tools", unit: "unidades" },
  {
    key: "facilitator",
    stems: [
      "psicolog", "terapeut", "facilitador", "tallerista", "acompanante", "pastor", "sacerdote", "capellan",
      "entrenador", "arbitro", "cuentero", "psycholog", "therapist", "counselor", "facilitator", "chaplain",
      "coach", "referee", "storyteller",
    ],
    nameEs: "Facilitadores / acompañantes", nameEn: "Facilitators", unit: "personas",
  },
  { key: "venue", stems: ["salon", "cancha", "coliseo", "caseta", "venue"], nameEs: "Espacio para el encuentro", nameEn: "Venue", unit: "unidades" },
  { key: "meals", stems: ["refrigerio", "almuerzo", "comida", "sancocho", "meal", "lunch", "snack", "food"], nameEs: "Comida / refrigerios", nameEn: "Meals / snacks", unit: "porciones" },
  { key: "transport", stems: ["transporte", "chiva", "buses", "transport"], nameEs: "Transporte", nameEn: "Transport", unit: "viajes" },
  { key: "sports_kit", stems: ["balon", "pelota", "uniforme", "camiseta", "peto", "ball", "jersey", "uniform"], nameEs: "Balones y uniformes", nameEn: "Balls and jerseys", unit: "unidades" },
  { key: "art_supplies", stems: ["titere", "crayola", "marcador", "puppet", "craft", "crayon"], nameEs: "Materiales de taller", nameEn: "Workshop supplies", unit: "kits" },
];

/** Signals that a report is about an open community gathering (Sanar y sembrar), not a repair. */
const HEAL_RE =
  /terapia|psico|acompanamiento|duelo|sanacion|\bsanar|taller|teatro|cuento|titere|futbol|torneo|deporte|\bculto|\bmisa\b|oracion|encuentro|therapy|counsel|grief|healing|workshop|theat|storytell|puppet|soccer|football|tournament|\bsports?\b|worship|prayer|gathering/;
const EVENT_KEYS = ["facilitator", "venue", "meals", "sports_kit", "art_supplies"];

function healTitle(lower: string): [string, string] {
  if (/futbol|torneo|deporte|soccer|football|tournament|\bsports?\b/.test(lower)) return ["Encuentro deportivo comunitario", "Community sports day"];
  if (/teatro|cuento|titere|theat|storytell|puppet/.test(lower)) return ["Teatro y cuentos para la comunidad", "Theatre and stories for the community"];
  if (/\bculto|\bmisa\b|oracion|worship|prayer/.test(lower)) return ["Encuentro de fe y memoria", "Faith and remembrance gathering"];
  if (/terapia|psico|duelo|acompanamiento|therapy|counsel|grief/.test(lower)) return ["Círculo de apoyo comunitario", "Community support circle"];
  if (/taller|workshop/.test(lower)) return ["Taller comunitario", "Community workshop"];
  return ["Encuentro comunitario", "Community gathering"];
}

const norm = (w: string) =>
  w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]/g, "");

function parseNumberTokens(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let any = false;
  for (const t of tokens) {
    if (/^\d+([.,]\d+)?$/.test(t)) {
      current += Number(t.replace(",", "."));
      any = true;
    } else if (t in NUM) {
      current += NUM[t];
      any = true;
    } else if (t in MULT) {
      const m = MULT[t];
      if (m === 1000) {
        total += (current || 1) * 1000;
        current = 0;
      } else current = (current || 1) * m;
      any = true;
    }
  }
  return any ? total + current : null;
}

const isNumTok = (t: string) => /^\d+([.,]\d+)?$/.test(t) || t in NUM || t in MULT;

export function fallbackExtract(transcript: string, language: "es" | "en", redactions: number, notice: string): Extraction {
  // keep original tokens for quotes; normalized tokens for matching
  const rawTokens = transcript.split(/\s+/).filter(Boolean);
  const tokens = rawTokens.map(norm);
  const boundary = rawTokens.map((r) => /[,;.:!?]$/.test(r)); // clause ends after this token

  const materials: Material[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const item = CATALOG.find((c) => c.stems.some((s) => tok.startsWith(s)));
    if (!item || seen.has(item.key)) continue;
    // walk backwards within the clause
    let j = i - 1;
    let unit: string | undefined;
    while (j >= 0 && !boundary[j] && (SKIP.has(tokens[j]) || tokens[j] in UNIT_WORDS)) {
      if (tokens[j] in UNIT_WORDS) unit = UNIT_WORDS[tokens[j]];
      j--;
    }
    const numToks: string[] = [];
    while (j >= 0 && !boundary[j] && (isNumTok(tokens[j]) || (NUM_JOINERS.has(tokens[j]) && numToks.length > 0 && j > 0 && isNumTok(tokens[j - 1])))) {
      numToks.unshift(tokens[j]);
      j--;
    }
    // "un/una" alone before a noun is an article, not a count we can trust
    let quantity = numToks.length ? parseNumberTokens(numToks) : null;
    if (quantity !== null && numToks.length === 1 && ["un", "una", "uno"].includes(numToks[0])) quantity = null;
    if (quantity !== null && quantity <= 0) quantity = null;
    // look up to 3 tokens back (within the clause) for a qualifier: "aproximadamente 200", "alrededor de 200", "más o menos 200"
    let vagueAt = -1;
    if (quantity !== null) {
      for (let k = j; k >= 0 && k >= j - 2 && !boundary[k]; k--) {
        if (VAGUE.has(tokens[k])) {
          vagueAt = k;
          break;
        }
      }
    }
    const vague = vagueAt >= 0;
    // quote: include the qualifier ("aproximadamente 200 ladrillos"); with no number, the words leading up to the
    // item within the clause ("materiales para reparar el techo"), stopping at "y"/"and" or punctuation.
    let start = j + 1;
    if (vague) start = tokens[vagueAt] === "menos" && vagueAt >= 2 && tokens[vagueAt - 1] === "o" ? vagueAt - 2 : vagueAt;
    else if (quantity === null) {
      let k = j;
      while (k >= 0 && k > j - 5 && !boundary[k] && !CLAUSE_JOINERS.has(tokens[k]) && !/^necesit|^need/.test(tokens[k])) k--;
      start = k + 1;
    }
    start = Math.max(0, Math.min(start, i));
    const quote = rawTokens.slice(start, i + 1).join(" ").replace(/[,;.:!?]+$/, "");
    seen.add(item.key);
    materials.push({
      itemKey: item.key,
      nameEs: item.nameEs,
      nameEn: item.nameEn,
      quantity,
      unit: unit ?? item.unit,
      confidence: quantity === null ? "low" : vague ? "medium" : "high",
      approximate: quantity !== null && vague,
      sourceQuote: quote,
    });
  }

  const has = (k: string) => seen.has(k);
  const lower = transcript.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let category: Category = "reconstruction";
  const structural = has("bricks") || has("cement_bag") || has("rebar") || has("wood_beam");
  const healWords = HEAL_RE.test(lower);
  if (!structural && (has("zinc_sheet") || has("tarp")) && !healWords) category = "roof_shelter";
  else if (!structural && (healWords || EVENT_KEYS.some(has))) category = "heal_sow";
  const heal = category === "heal_sow";

  // A gathering with children is not an emergency; only explicit urgency counts there.
  const urgency: Urgency = (heal ? /urgente|urgent|emergencia|emergency/ : /urgente|urgent|emergencia|emergency|lluvia|rain|ninos|children|ancian|elderly|enferm/).test(lower)
    ? "high"
    : "medium";

  const titles: Record<Category, [string, string]> = {
    reconstruction: ["Reconstrucción de vivienda", "Home reconstruction"],
    roof_shelter: ["Reparación de techo", "Roof repair"],
    heal_sow: healTitle(lower),
  };
  const fmt = (m: Material, lang: "es" | "en") => {
    const name = lang === "es" ? m.nameEs.toLowerCase() : m.nameEn.toLowerCase();
    if (m.quantity === null) return lang === "es" ? `${name} (cantidad por confirmar)` : `${name} (quantity to be confirmed)`;
    const approx = m.approximate ? (lang === "es" ? "aprox. " : "approx. ") : "";
    return lang === "es" ? `${name}: ${approx}${m.quantity} ${m.unit}` : `${name}: ${approx}${m.quantity}`;
  };
  const listEs = materials.map((m) => fmt(m, "es")).join("; ");
  const listEn = materials.map((m) => fmt(m, "en")).join("; ");
  const leadEs = heal ? "Encuentro abierto a la comunidad." : "Reporte de campo.";
  const leadEn = heal ? "Gathering open to the community." : "Field report.";
  const summaryEs = materials.length
    ? `${leadEs} Necesidades mencionadas: ${listEs}.`
    : `${leadEs} No se identificaron necesidades específicas; revisar la transcripción.`;
  const summaryEn = materials.length
    ? `${leadEn} Needs mentioned: ${listEn}.`
    : `${leadEn} No specific needs identified; please review the transcript.`;

  const missingQuestions = materials
    .filter((m) => m.quantity === null)
    .map((m) => ({
      es: `¿Qué cantidad exacta de ${m.nameEs.toLowerCase()} se necesita?`,
      en: `What exact quantity of ${m.nameEn.toLowerCase()} is needed?`,
    }));
  if (has("zinc_sheet"))
    missingQuestions.push({
      es: "¿Qué tamaño aproximado tiene el techo dañado?",
      en: "Approximately how large is the damaged roof area?",
    });
  if (!materials.length)
    missingQuestions.push(
      heal
        ? { es: "¿Qué apoyos necesita el encuentro (facilitadores, espacio, comida, transporte)?", en: "What does the gathering need (facilitators, venue, food, transport)?" }
        : { es: "¿Qué materiales se necesitan y en qué cantidad?", en: "Which materials are needed, and how many?" },
    );
  if (heal)
    missingQuestions.push({ es: "¿Qué fecha y lugar tendrá el encuentro?", en: "What date and place will the gathering have?" });

  // Damage description: only from words actually present in the transcript (no invented details).
  const dEs: string[] = [];
  const dEn: string[] = [];
  const home = /\b(casa|vivienda|hogar|house|home)\b/.test(lower);
  const damaged = /dan(o|os|ad)|destru|afectad|damage|destroy|collaps|derrumb/.test(lower);
  if (home && damaged) {
    dEs.push("Vivienda con daños reportados");
    dEn.push("Home with reported damage");
  } else if (damaged) {
    dEs.push("Daños reportados en el lugar");
    dEn.push("Damage reported at the site");
  }
  if (has("zinc_sheet") || has("tarp") || /techo|roof|tejado/.test(lower)) {
    dEs.push("el techo necesita reparación");
    dEn.push("the roof needs repair");
  }
  if (/muro|pared|wall/.test(lower) || has("bricks") || has("cement_bag")) {
    dEs.push("se requieren materiales de construcción para reparar la estructura (muros)");
    dEn.push("building materials are needed to repair the structure (walls)");
  }
  if (/inund|flood/.test(lower)) {
    dEs.push("hubo inundación");
    dEn.push("there was flooding");
  }
  const sentence = (parts: string[], fallback: string) =>
    parts.length ? `${parts[0].charAt(0).toUpperCase()}${parts.join("; ").slice(1)}.` : fallback;
  const damageDescriptionEs = sentence(
    dEs,
    heal ? "Encuentro comunitario; no hay daños físicos que reparar." : "Sin descripción del daño en el reporte; confirmar con el equipo de campo.",
  );
  const damageDescriptionEn = sentence(
    dEn,
    heal ? "Community gathering; no physical damage to repair." : "No damage description in the report; confirm with the field team.",
  );
  if (!dEs.length && !heal)
    missingQuestions.push({ es: "¿Qué daños tiene la vivienda o el lugar?", en: "What damage does the home or site have?" });

  // Proposed milestones (editable suggestions, never verified).
  const proposedMilestones: Milestone[] = [];
  if (heal) {
    if (materials.length) proposedMilestones.push({ es: "Apoyos confirmados", en: "Support confirmed" });
    proposedMilestones.push({ es: "Encuentro realizado", en: "Gathering held" });
    proposedMilestones.push({ es: "Informe del encuentro publicado", en: "Gathering report published" });
  } else {
    if (materials.length) proposedMilestones.push({ es: "Materiales recibidos", en: "Materials received" });
    if (structural) proposedMilestones.push({ es: "Muro reconstruido", en: "Wall rebuilt" });
    if (has("zinc_sheet") || has("tarp")) proposedMilestones.push({ es: "Techo reparado", en: "Roof repaired" });
    if (has("water_tank")) proposedMilestones.push({ es: "Tanque de agua instalado", en: "Water tank installed" });
    if (proposedMilestones.length < 2) proposedMilestones.push({ es: "Trabajo completado", en: "Work completed" });
  }

  const n = norm(transcript.replace(/\s+/g, ""));
  const isDemoEs = n === norm(DEMO_TRANSCRIPT_ES.replace(/\s+/g, ""));
  const isDemoEn = n === norm(DEMO_TRANSCRIPT_EN.replace(/\s+/g, ""));
  return {
    source: "fallback",
    notice,
    redactions,
    titleEs: titles[category][0],
    titleEn: titles[category][1],
    category,
    summaryEs,
    summaryEn,
    urgency,
    damageDescriptionEs,
    damageDescriptionEn,
    materials,
    missingQuestions,
    proposedMilestones,
    transcriptTranslated: isDemoEs ? DEMO_TRANSCRIPT_EN : isDemoEn ? DEMO_TRANSCRIPT_ES : null,
  };
}

// ---------------- OpenRouter ----------------
// Request formats verified against https://openrouter.ai/docs (multimodal/audio, multimodal/images,
// features/structured-outputs). Audio is base64 only (no URLs) as an `input_audio` content part;
// images go as an `image_url` data URL; structured output uses `response_format.json_schema`.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.8-flash";
const AI_TIMEOUT_MS = 45_000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type AiConfig = { apiKey: string; model: string };
type AiErrorCode = "timeout" | "network" | "http" | "empty" | "parse" | "too_large" | "unsupported_format";

class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

function aiConfig(): AiConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: process.env.AI_MODEL || DEFAULT_MODEL };
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "image_url"; image_url: { url: string } };

/**
 * One chat-completions call with strict JSON-schema output. Logs model, latency, token usage and
 * cost (when OpenRouter reports it) — never prompt or response content.
 */
async function callOpenRouter<T>(
  cfg: AiConfig,
  task: string,
  opts: { system: string; user: ContentPart[]; schemaName: string; schema: object; maxTokens: number },
): Promise<{ data: T; model: string }> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://impacto-gules.vercel.app",
        "X-Title": "Impacto",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        max_tokens: opts.maxTokens,
        reasoning: { effort: "low" },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
        // Only route to endpoints that honour response_format (OpenRouter structured-outputs guide).
        provider: { require_parameters: true },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const code: AiErrorCode = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
    console.error(JSON.stringify({ ai: task, model: cfg.model, ms: Date.now() - started, error: code }));
    throw new AiError(code, `${task}_${code}`);
  }
  if (!res.ok) {
    const ms = Date.now() - started;
    // OpenRouter error bodies describe the failure (model, quota, format) — they don't echo our input.
    const detail = (await res.text()).slice(0, 300);
    console.error(JSON.stringify({ ai: task, model: cfg.model, ms, status: res.status, detail }));
    throw new AiError("http", `${task}_http_${res.status}`);
  }
  const json = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };
  const model = json.model ?? cfg.model;
  const ms = Date.now() - started; // includes body read (OpenRouter may send headers early)
  console.log(
    JSON.stringify({
      ai: task,
      model,
      ms,
      finish: json.choices?.[0]?.finish_reason,
      tokensIn: json.usage?.prompt_tokens,
      tokensOut: json.usage?.completion_tokens,
      costUsd: json.usage?.cost,
    }),
  );
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new AiError("empty", `${task}_empty`);
  try {
    // Some providers wrap JSON in a ```json fence even in structured mode.
    const raw = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    return { data: JSON.parse(raw) as T, model };
  } catch {
    throw new AiError("parse", `${task}_parse`);
  }
}

// ---- audio ----

/**
 * Map a recorded blob's MIME type to the OpenRouter `input_audio.format` label.
 * Chrome/Firefox record audio/webm (opus); Safari records audio/mp4 (AAC) — labelled "m4a"
 * (the audio-only MP4 container). See TEST notes in the report for which formats were confirmed.
 */
export function audioFormatFor(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return m.includes("aac") && !m.includes("mp4") ? "aac" : "m4a";
  if (m.includes("wav") || m.includes("wave")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("aiff")) return "aiff";
  if (m.includes("flac")) return "flac";
  return null;
}

const TRANSCRIBE_SYSTEM = `You are a verbatim speech-to-text engine for disaster-recovery field reports.
Transcribe exactly what is said, in the language it is spoken (usually Spanish, sometimes English or mixed).
NEVER translate. NEVER summarize, correct, reorder or add words. Keep numbers as spoken (digits are fine).
If there is no intelligible speech, return an empty transcript.`;

const TRANSCRIBE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["transcript", "language"],
  properties: {
    transcript: { type: "string" },
    language: { type: "string", enum: ["es", "en", "other"] },
  },
} as const;

async function aiTranscribe(
  cfg: AiConfig,
  audio: Blob,
  hint: "es" | "en",
): Promise<{ transcript: string; language: "es" | "en" | null; model: string }> {
  if (audio.size > MAX_AUDIO_BYTES) throw new AiError("too_large", "audio_too_large");
  const format = audioFormatFor(audio.type || "audio/webm");
  if (!format) throw new AiError("unsupported_format", `audio_format_${audio.type}`);
  const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
  const { data: out, model } = await callOpenRouter<{ transcript?: unknown; language?: unknown }>(cfg, "transcribe", {
    system: TRANSCRIBE_SYSTEM,
    user: [
      {
        type: "text",
        text: `Transcribe this audio verbatim. The field worker selected ${hint === "es" ? "Spanish" : "English"} but keep whatever language is actually spoken.`,
      },
      { type: "input_audio", input_audio: { data, format } },
    ],
    schemaName: "transcript",
    schema: TRANSCRIBE_SCHEMA,
    maxTokens: 4000,
  });
  const transcript = typeof out.transcript === "string" ? out.transcript.trim().slice(0, 20_000) : "";
  const language = out.language === "es" || out.language === "en" ? out.language : null;
  return { transcript, language, model };
}

// ---- extraction ----

const SYSTEM_PROMPT = `You structure disaster-recovery field reports for a nonprofit in Puerto Rico / Latin America.
The transcript may be in Spanish or English (or mixed). Keep meaning faithful to the transcript.
Output BOTH Spanish and English for every human-readable field (titles, summaries, damage description, material names, missing questions, milestones).
Rules:
- NEVER invent or estimate quantities. "quantity" must be a number ONLY if the transcript explicitly states it (digits or words like "doscientos", "quince"). Otherwise null.
  Approximations explicitly stated (e.g. "aproximadamente 200", "unos doscientos", "about 200") keep the number but set approximate=true and confidence "medium".
  Vague requests with no number (e.g. "materiales para reparar el techo") => quantity null, confidence "low".
- itemKey must be one of: ${ITEM_KEYS.join(", ")}, or "other". Roof repair with no specific material => "zinc_sheet" with quantity null.
- unit: short Spanish unit word (e.g. "unidades", "bolsas", "planchas", "galones", "sacos").
- sourceQuote: the exact words from the transcript supporting this material (copy them verbatim, original language).
- category: roof_shelter (roofs, tarps, shelter), reconstruction (walls, structure, bricks, cement), heal_sow ("Sanar y sembrar": open community gatherings that help people heal together, e.g. support or grief circles, psychosocial accompaniment, workshops, theatre and storytelling for children, a soccer day, a faith or remembrance gathering, a shared meal; often hosted or sponsored by donors). heal_sow is NOT about gardens or farming.
- For heal_sow, the "materials" are what the gathering needs: facilitator (psychologist, therapist, pastor/priest, coach, referee, storyteller; unit "personas" or "horas"), venue, meals, transport, sports_kit, art_supplies. Gatherings are open to everyone: never list or ask for who attends; at most an expected number of people.
- damageDescriptionEs/En: one or two short sentences describing ONLY the damage stated in the transcript. No names, no locations. For heal_sow, describe what the community lived through and why it wants to gather, as stated; if nothing is stated, say it is a community gathering with no physical damage to repair.
- urgency is a SUGGESTION for the worker to confirm: high only if the transcript indicates danger, exposure to rain, vulnerable people, or says urgent.
- proposedMilestones: 2-4 short, verifiable project milestones in order (e.g. "Materiales recibidos"/"Materials received", "Muro reconstruido"/"Wall rebuilt", "Techo reparado"/"Roof repaired"; for heal_sow e.g. "Apoyos confirmados"/"Support confirmed", "Encuentro realizado"/"Gathering held", "Informe del encuentro publicado"/"Gathering report published"). Each has es and en.
- missingQuestions: concrete follow-up questions the field worker should answer (especially unknown quantities). Bilingual.
- transcriptTranslated: translate the full transcript into the OTHER language (Spanish->English or English->Spanish).
- Do not include any personal names, phone numbers or addresses in any output. Text in [brackets] was redacted.
- Titles must not contain household names or exact locations.`;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "titleEs", "titleEn", "category", "summaryEs", "summaryEn", "urgency", "damageDescriptionEs", "damageDescriptionEn",
    "materials", "missingQuestions", "proposedMilestones", "transcriptTranslated",
  ],
  properties: {
    titleEs: { type: "string" },
    titleEn: { type: "string" },
    category: { type: "string", enum: ["roof_shelter", "reconstruction", "heal_sow"] },
    summaryEs: { type: "string" },
    summaryEn: { type: "string" },
    urgency: { type: "string", enum: ["low", "medium", "high"] },
    damageDescriptionEs: { type: "string" },
    damageDescriptionEn: { type: "string" },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["itemKey", "nameEs", "nameEn", "quantity", "unit", "confidence", "approximate", "sourceQuote"],
        properties: {
          itemKey: { type: "string", enum: [...ITEM_KEYS, "other"] },
          nameEs: { type: "string" },
          nameEn: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          approximate: { type: "boolean" },
          sourceQuote: { type: "string" },
        },
      },
    },
    missingQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["es", "en"],
        properties: { es: { type: "string" }, en: { type: "string" } },
      },
    },
    proposedMilestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["es", "en"],
        properties: { es: { type: "string" }, en: { type: "string" } },
      },
    },
    transcriptTranslated: { type: ["string", "null"] },
  },
} as const;

/** Every number explicitly stated in the text — digit runs ("200", "1,000") and spelled-out runs ("doscientos"). */
function statedNumbers(text: string): Set<number> {
  const out = new Set<number>();
  for (const d of text.match(/\d[\d.,]*/g) ?? []) {
    const n = Number(d.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (Number.isFinite(n)) out.add(n);
  }
  const toks = text.split(/\s+/).map(norm).filter(Boolean);
  let run: string[] = [];
  const flush = () => {
    if (run.length) {
      const n = parseNumberTokens(run);
      if (n !== null) out.add(n);
    }
    run = [];
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (isNumTok(t) || (NUM_JOINERS.has(t) && run.length > 0 && i + 1 < toks.length && isNumTok(toks[i + 1]))) run.push(t);
    else flush();
  }
  flush();
  return out;
}

const CATS: Category[] = ["roof_shelter", "reconstruction", "heal_sow"];
const URGS: Urgency[] = ["low", "medium", "high"];
const CONFS: Confidence[] = ["high", "medium", "low"];
const str = (x: unknown, d = "", max = 2000) => (typeof x === "string" ? x.slice(0, max) : d);
const itemKeyOf = (x: unknown) => (typeof x === "string" && (ITEM_KEYS as readonly string[]).includes(x) ? x : "other");

async function aiExtract(
  cfg: AiConfig,
  transcript: string,
  language: "es" | "en",
): Promise<Omit<Extraction, "source" | "redactions">> {
  type Raw = Omit<Extraction, "source" | "redactions" | "model">;
  const { data: p, model } = await callOpenRouter<Raw>(cfg, "extract", {
    system: SYSTEM_PROMPT,
    user: [
      {
        type: "text",
        text: `Transcript language selected by the field worker: ${language === "es" ? "Spanish (es)" : "English (en)"}.\nTranscript:\n"""${transcript}"""`,
      },
    ],
    schemaName: "field_report",
    schema: JSON_SCHEMA,
    maxTokens: 4000,
  });

  // Post-response quantity check: a quantity survives only if that number is explicitly stated in
  // the transcript. Anything else is treated as invented => null + low confidence + needs confirmation.
  const stated = statedNumbers(transcript);
  let dropped = 0;
  const materials: Material[] = (Array.isArray(p.materials) ? p.materials : []).slice(0, 30).map((m) => {
    const q = typeof m.quantity === "number" && Number.isFinite(m.quantity) && m.quantity > 0 ? m.quantity : null;
    const ok = q !== null && stated.has(q);
    if (q !== null && !ok) dropped++;
    return {
      itemKey: itemKeyOf(m.itemKey),
      nameEs: str(m.nameEs),
      nameEn: str(m.nameEn),
      quantity: ok ? q : null,
      unit: str(m.unit, "unidades") || "unidades",
      confidence: ok ? (CONFS.includes(m.confidence) ? m.confidence : "low") : "low",
      approximate: ok && m.approximate === true,
      sourceQuote: str(m.sourceQuote, "", 500),
    };
  });
  if (dropped) console.warn(JSON.stringify({ ai: "extract", quantityCheckDropped: dropped }));
  const missingQuestions = (Array.isArray(p.missingQuestions) ? p.missingQuestions : [])
    .slice(0, 10)
    .map((q) => ({ es: str(q.es), en: str(q.en) }));
  // Safety net: if the model asked nothing, still ask for every unknown quantity.
  if (!missingQuestions.length)
    for (const m of materials.filter((x) => x.quantity === null))
      missingQuestions.push({
        es: `¿Qué cantidad exacta de ${m.nameEs.toLowerCase()} se necesita?`,
        en: `What exact quantity of ${m.nameEn.toLowerCase()} is needed?`,
      });

  return {
    model,
    titleEs: str(p.titleEs, "", 200),
    titleEn: str(p.titleEn, "", 200),
    category: CATS.includes(p.category) ? p.category : "reconstruction",
    summaryEs: str(p.summaryEs),
    summaryEn: str(p.summaryEn),
    urgency: URGS.includes(p.urgency) ? p.urgency : "medium",
    damageDescriptionEs: str(p.damageDescriptionEs),
    damageDescriptionEn: str(p.damageDescriptionEn),
    materials,
    missingQuestions: missingQuestions.slice(0, 12),
    proposedMilestones: (Array.isArray(p.proposedMilestones) ? p.proposedMilestones : [])
      .slice(0, 8)
      .map((q) => ({ es: str(q.es, "", 200), en: str(q.en, "", 200) }))
      .filter((q) => q.es || q.en),
    transcriptTranslated: typeof p.transcriptTranslated === "string" ? p.transcriptTranslated.slice(0, 20_000) : null,
  };
}

// ---- photo analysis ----

const BUILD_KEYS = ITEM_KEYS.filter((k) => !EVENT_KEYS.includes(k) && k !== "transport");

const PHOTO_SYSTEM = `You help a disaster-recovery nonprofit draft a materials list from ONE photo of damage.
Describe ONLY physical damage and building materials visible in the photo.
Rules:
- Never describe, identify or guess anything about people, faces, names, house numbers, street signs, licence plates or locations.
- If the photo shows people, faces, readable house numbers, names, documents or licence plates, set privacyConcern=true.
- observationsEs/En: 1-4 short factual sentences about the visible damage (Spanish and English, same order).
- materials: building materials likely needed to repair what is visible. itemKey must be one of: ${BUILD_KEYS.join(", ")}, or "other".
- quantity: a number ONLY if the items are clearly countable in the photo (e.g. 3 missing roof sheets). Otherwise null. Never estimate areas or volumes.
- confidence: how sure you are this material is needed, from the photo alone. Prefer "low"/"medium".
- reasonEs/En: one short phrase pointing to what in the photo supports it.
- unit: short Spanish unit word ("unidades", "planchas", "bolsas", ...).`;

const PHOTO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["privacyConcern", "observationsEs", "observationsEn", "materials"],
  properties: {
    privacyConcern: { type: "boolean" },
    observationsEs: { type: "array", items: { type: "string" } },
    observationsEn: { type: "array", items: { type: "string" } },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["itemKey", "nameEs", "nameEn", "quantity", "unit", "confidence", "reasonEs", "reasonEn"],
        properties: {
          itemKey: { type: "string", enum: [...BUILD_KEYS, "other"] },
          nameEs: { type: "string" },
          nameEn: { type: "string" },
          quantity: { type: ["integer", "null"] },
          unit: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          reasonEs: { type: "string" },
          reasonEn: { type: "string" },
        },
      },
    },
  },
} as const;

type PhotoSuggestion = {
  photoId: Id<"photos">;
  model: string;
  createdAt: number;
  privacyConcern: boolean;
  observationsEs: string[];
  observationsEn: string[];
  observationsStatus: "pending" | "accepted" | "discarded";
  materials: {
    itemKey: string;
    nameEs: string;
    nameEn: string;
    quantity: number | null;
    unit: string;
    confidence: Confidence;
    reasonEs: string;
    reasonEn: string;
    status: "pending" | "accepted" | "discarded";
  }[];
};

async function aiAnalyzePhoto(cfg: AiConfig, image: Blob, photoId: Id<"photos">): Promise<PhotoSuggestion> {
  if (image.size > MAX_IMAGE_BYTES) throw new AiError("too_large", "image_too_large");
  const mime = /^image\/(jpeg|png|webp)$/.test(image.type) ? image.type : "image/jpeg";
  const url = `data:${mime};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  type Raw = {
    privacyConcern?: unknown;
    observationsEs?: unknown;
    observationsEn?: unknown;
    materials?: { [k: string]: unknown }[];
  };
  const { data: p, model } = await callOpenRouter<Raw>(cfg, "photo", {
    system: PHOTO_SYSTEM,
    user: [
      { type: "text", text: "Analyze this damage photo." },
      { type: "image_url", image_url: { url } },
    ],
    schemaName: "photo_suggestions",
    schema: PHOTO_SCHEMA,
    maxTokens: 2000,
  });
  const strs = (x: unknown) => (Array.isArray(x) ? x : []).filter((s): s is string => typeof s === "string").slice(0, 4).map((s) => s.slice(0, 300));
  return {
    photoId,
    model,
    createdAt: Date.now(),
    privacyConcern: p.privacyConcern === true,
    observationsEs: strs(p.observationsEs),
    observationsEn: strs(p.observationsEn),
    observationsStatus: "pending",
    materials: (Array.isArray(p.materials) ? p.materials : []).slice(0, 8).map((m) => {
      const q = typeof m.quantity === "number" && Number.isInteger(m.quantity) && m.quantity > 0 && m.quantity <= 100 ? m.quantity : null;
      return {
        itemKey: itemKeyOf(m.itemKey),
        nameEs: str(m.nameEs, "", 120),
        nameEn: str(m.nameEn, "", 120),
        quantity: q,
        unit: str(m.unit, "unidades", 40) || "unidades",
        // Photo suggestions are never "high": a picture can't confirm a need.
        confidence: m.confidence === "medium" ? "medium" : "low",
        reasonEs: str(m.reasonEs, "", 200),
        reasonEn: str(m.reasonEn, "", 200),
        status: "pending",
      };
    }),
  };
}

// ---------------- actions ----------------

const resultValidator = v.object({
  status: v.union(v.literal("done"), v.literal("needs_text")),
  source: v.optional(v.union(v.literal("openrouter"), v.literal("fallback"))),
  reason: v.optional(v.string()),
});

export const transcribeAndExtract = action({
  args: { sessionToken: v.string(), reportId: v.id("fieldReports") },
  returns: resultValidator,
  handler: async (ctx, args): Promise<typeof resultValidator.type> => {
    // Authorization + data minimization: this query returns only transcript/audio ref.
    const info: { transcript: string; language: "es" | "en"; audioStorageId: Id<"_storage"> | null } =
      await ctx.runQuery(internal.field.getReportForAi, args);
    const cfg = aiConfig();
    await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "pending" });

    let transcript = info.transcript.trim();
    let language = info.language;
    if (!transcript) {
      if (!info.audioStorageId) {
        await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "error", aiError: "no_input" });
        return { status: "needs_text", reason: "no_input" };
      }
      if (!cfg) {
        await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "error", aiError: "no_api_key_audio" });
        return { status: "needs_text", reason: "no_api_key_audio" };
      }
      // Call #1: audio -> verbatim transcript (original language). Stored before redaction so the
      // worker sees exactly what they said; only the redacted copy goes to call #2.
      try {
        const blob = await ctx.storage.get(info.audioStorageId);
        if (!blob) throw new AiError("empty", "audio_missing");
        const r = await aiTranscribe(cfg, blob, info.language);
        if (!r.transcript) throw new AiError("empty", "empty_transcript");
        transcript = r.transcript;
        if (r.language) language = r.language;
        await ctx.runMutation(internal.field.storeTranscript, {
          reportId: args.reportId,
          transcript,
          language: r.language ?? undefined,
        });
      } catch (e) {
        const code = e instanceof AiError ? e.code : "network";
        console.error("transcription failed", e instanceof Error ? e.message : String(e));
        const reason = code === "timeout" ? "transcription_timeout" : "transcription_failed";
        await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "error", aiError: reason });
        return { status: "needs_text", reason };
      }
    }

    // Call #2: strip obvious names/phones/emails before the transcript is used for extraction.
    const { text: safe, count } = redact(transcript);
    let extraction: Extraction;
    if (cfg) {
      try {
        extraction = { source: "openrouter", redactions: count, ...(await aiExtract(cfg, safe, language)) };
      } catch (e) {
        console.error("extraction failed, using fallback", e instanceof Error ? e.message : e);
        const notice = e instanceof AiError && e.code === "timeout" ? "ai_timeout" : "ai_error";
        extraction = fallbackExtract(safe, language, count, notice);
      }
    } else {
      extraction = fallbackExtract(safe, language, count, "no_api_key");
    }
    await ctx.runMutation(internal.field.storeExtraction, { reportId: args.reportId, extraction });
    return { status: "done", source: extraction.source };
  },
});

const photoResultValidator = v.object({
  status: v.union(v.literal("done"), v.literal("error")),
  reason: v.optional(v.string()),
  privacyConcern: v.optional(v.boolean()),
  materials: v.optional(v.number()),
});

/**
 * Opt-in, per-photo analysis. Never called automatically: the UI requires a button press AND a
 * ticked "no people / faces / house numbers / names" confirmation, which is re-checked here.
 * The stored photo is already EXIF-stripped + re-encoded client-side (src/lib/image.ts).
 */
export const analyzePhoto = action({
  args: { sessionToken: v.string(), photoId: v.id("photos"), confirmedNoPeople: v.boolean() },
  returns: photoResultValidator,
  handler: async (ctx, args): Promise<typeof photoResultValidator.type> => {
    if (!args.confirmedNoPeople) return { status: "error", reason: "not_confirmed" };
    const info: { storageId: Id<"_storage">; reportId: Id<"fieldReports"> } = await ctx.runQuery(
      internal.field.getPhotoForAi,
      { sessionToken: args.sessionToken, photoId: args.photoId },
    );
    const cfg = aiConfig();
    if (!cfg) return { status: "error", reason: "no_api_key" };
    try {
      const blob = await ctx.storage.get(info.storageId);
      if (!blob) return { status: "error", reason: "photo_missing" };
      const suggestion = await aiAnalyzePhoto(cfg, blob, args.photoId);
      await ctx.runMutation(internal.field.storePhotoSuggestion, { reportId: info.reportId, suggestion });
      return { status: "done", privacyConcern: suggestion.privacyConcern, materials: suggestion.materials.length };
    } catch (e) {
      console.error("photo analysis failed", e instanceof Error ? e.message : String(e));
      return { status: "error", reason: e instanceof AiError && e.code === "timeout" ? "timeout" : "failed" };
    }
  },
});

/**
 * Smoke test for the offline extractor:
 *   npx convex run ai:testFallback '{"transcript":"..."}'
 *   npx convex run ai:testFallback '{"demo":"en"}'
 */
export const testFallback = internalAction({
  args: {
    transcript: v.optional(v.string()),
    demo: v.optional(v.union(v.literal("es"), v.literal("en"))),
    language: v.optional(v.union(v.literal("es"), v.literal("en"))),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const text = args.transcript ?? (args.demo === "en" ? DEMO_TRANSCRIPT_EN : DEMO_TRANSCRIPT_ES);
    const language =
      args.language ?? (args.demo ?? (/\b(we|the|need|and|bags?|bricks?)\b/i.test(text) ? "en" : "es"));
    const r = redact(text);
    return { redacted: r.text, extraction: fallbackExtract(r.text, language, r.count, "test") };
  },
});

/**
 * Live smoke tests against OpenRouter (costs a few cents; internal only — not callable by clients):
 *   npx convex run ai:testLive '{"demo":"es"}'                       -> redaction + extraction
 *   npx convex run ai:testLive '{"transcript":"...","language":"en"}'
 *   npx convex run ai:testLive '{"audioBase64":"...","mime":"audio/wav"}'  -> transcribe + extract
 *   npx convex run ai:testLive '{"storageId":"...","mime":"audio/webm"}'   -> same, from storage
 *   npx convex run ai:testLive '{"imageStorageId":"..."}'                 -> photo analysis
 */
export const testLive = internalAction({
  args: {
    transcript: v.optional(v.string()),
    demo: v.optional(v.union(v.literal("es"), v.literal("en"))),
    language: v.optional(v.union(v.literal("es"), v.literal("en"))),
    audioBase64: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mime: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    skipExtract: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const cfg = aiConfig();
    if (!cfg) return { error: "OPENROUTER_API_KEY not set" };
    if (args.imageStorageId) {
      const blob = await ctx.storage.get(args.imageStorageId);
      if (!blob) return { error: "image missing" };
      return { photo: await aiAnalyzePhoto(cfg, blob, "test" as Id<"photos">) };
    }
    let language: "es" | "en" = args.language ?? (args.demo ?? "es");
    let transcript = args.transcript ?? (args.demo === "en" ? DEMO_TRANSCRIPT_EN : DEMO_TRANSCRIPT_ES);
    let transcription: unknown = null;
    if (args.audioBase64 || args.storageId) {
      let blob: Blob | null = null;
      if (args.storageId) blob = await ctx.storage.get(args.storageId);
      else {
        // Round-trip through Convex storage, exactly like a recorded upload.
        const sid = await ctx.storage.store(
          new Blob([Buffer.from(args.audioBase64!, "base64")], { type: args.mime ?? "audio/wav" }),
        );
        blob = await ctx.storage.get(sid);
        await ctx.storage.delete(sid);
      }
      if (!blob) return { error: "audio missing" };
      const t0 = Date.now();
      try {
        const r = await aiTranscribe(cfg, blob, language);
        transcription = { ...r, format: audioFormatFor(blob.type), bytes: blob.size, ms: Date.now() - t0 };
        transcript = r.transcript;
        if (r.language) language = r.language;
      } catch (e) {
        return { transcriptionError: e instanceof Error ? e.message : String(e), format: audioFormatFor(blob.type) };
      }
      if (args.skipExtract) return { transcription };
    }
    const r = redact(transcript);
    const t0 = Date.now();
    const extraction = await aiExtract(cfg, r.text, language);
    return { transcription, redacted: r.text, redactions: r.count, ms: Date.now() - t0, extraction };
  },
});
