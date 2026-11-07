"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Lane B — AI intake. Speech-to-text + structured extraction (OpenAI), with a deterministic
 * local fallback so the live demo never depends on the network or an API key.
 *
 * PRIVACY: the only thing sent to the AI provider is the field report audio (for transcription)
 * and the transcript text (for extraction), after regex redaction of obvious names, phone numbers
 * and emails. projectPrivate and photos are NEVER read here.
 *
 * Env (Convex dashboard / `npx convex env set`):
 *   OPENAI_API_KEY            optional — without it, the fallback extractor is used
 *   OPENAI_TRANSCRIBE_MODEL   default "gpt-4o-transcribe"
 *   OPENAI_EXTRACT_MODEL      default "gpt-4.1-mini"
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
  source: "openai" | "fallback";
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
  "seeds",
  "soil",
  "water_tank",
  "tools",
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
  { key: "seeds", stems: ["semilla", "seed"], nameEs: "Semillas", nameEn: "Seeds", unit: "sobres" },
  { key: "soil", stems: ["tierra", "abono", "composta", "soil", "compost"], nameEs: "Tierra / abono", nameEn: "Soil / compost", unit: "sacos" },
  { key: "water_tank", stems: ["tanque", "cisterna", "tank"], nameEs: "Tanque de agua", nameEn: "Water tank", unit: "unidades" },
  { key: "tools", stems: ["herramienta", "pala", "martillo", "rastrillo", "tool", "shovel", "hammer"], nameEs: "Herramientas", nameEn: "Tools", unit: "unidades" },
];

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
  if (has("seeds") || has("soil") || /huerto|siembra|cosecha|garden|farm|cultivo/.test(lower)) category = structural ? "reconstruction" : "heal_sow";
  else if (!structural && (has("zinc_sheet") || has("tarp"))) category = "roof_shelter";

  const urgency: Urgency = /urgente|urgent|emergencia|emergency|lluvia|rain|ninos|children|ancian|elderly|enferm/.test(lower)
    ? "high"
    : "medium";

  const titles: Record<Category, [string, string]> = {
    reconstruction: ["Reconstrucción de vivienda", "Home reconstruction"],
    roof_shelter: ["Reparación de techo", "Roof repair"],
    heal_sow: ["Huerto comunitario", "Community garden"],
  };
  const fmt = (m: Material, lang: "es" | "en") => {
    const name = lang === "es" ? m.nameEs.toLowerCase() : m.nameEn.toLowerCase();
    if (m.quantity === null) return lang === "es" ? `${name} (cantidad por confirmar)` : `${name} (quantity to be confirmed)`;
    const approx = m.approximate ? (lang === "es" ? "aprox. " : "approx. ") : "";
    return lang === "es" ? `${name}: ${approx}${m.quantity} ${m.unit}` : `${name}: ${approx}${m.quantity}`;
  };
  const listEs = materials.map((m) => fmt(m, "es")).join("; ");
  const listEn = materials.map((m) => fmt(m, "en")).join("; ");
  const summaryEs = materials.length
    ? `Reporte de campo. Necesidades mencionadas: ${listEs}.`
    : "Reporte de campo. No se identificaron materiales específicos; revisar la transcripción.";
  const summaryEn = materials.length
    ? `Field report. Needs mentioned: ${listEn}.`
    : "Field report. No specific materials identified; please review the transcript.";

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
    missingQuestions.push({ es: "¿Qué materiales se necesitan y en qué cantidad?", en: "Which materials are needed, and how many?" });

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
  const damageDescriptionEs = sentence(dEs, "Sin descripción del daño en el reporte; confirmar con el equipo de campo.");
  const damageDescriptionEn = sentence(dEn, "No damage description in the report; confirm with the field team.");
  if (!dEs.length)
    missingQuestions.push({ es: "¿Qué daños tiene la vivienda o el lugar?", en: "What damage does the home or site have?" });

  // Proposed milestones (editable suggestions, never verified).
  const proposedMilestones: Milestone[] = [];
  if (materials.length) proposedMilestones.push({ es: "Materiales recibidos", en: "Materials received" });
  if (structural) proposedMilestones.push({ es: "Muro reconstruido", en: "Wall rebuilt" });
  if (has("zinc_sheet") || has("tarp")) proposedMilestones.push({ es: "Techo reparado", en: "Roof repaired" });
  if (has("seeds") || has("soil")) proposedMilestones.push({ es: "Huerto sembrado", en: "Garden planted" });
  if (has("water_tank")) proposedMilestones.push({ es: "Tanque de agua instalado", en: "Water tank installed" });
  if (proposedMilestones.length < 2) proposedMilestones.push({ es: "Trabajo completado", en: "Work completed" });

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

// ---------------- OpenAI ----------------

const SYSTEM_PROMPT = `You structure disaster-recovery field reports for a nonprofit in Puerto Rico / Latin America.
The transcript may be in Spanish or English (or mixed). Keep meaning faithful to the transcript.
Output BOTH Spanish and English for every human-readable field (titles, summaries, damage description, material names, missing questions, milestones).
Rules:
- NEVER invent or estimate quantities. "quantity" must be a number ONLY if the transcript explicitly states it (digits or words like "doscientos", "quince"). Otherwise null.
  Approximations explicitly stated (e.g. "aproximadamente 200", "unos doscientos", "about 200") keep the number but set approximate=true and confidence "medium".
  Vague requests with no number (e.g. "materiales para reparar el techo") => quantity null, confidence "low".
- itemKey must be one of: ${ITEM_KEYS.join(", ")}, or "other". Roof repair with no specific material => "zinc_sheet" with quantity null.
- unit: short Spanish unit word (e.g. "unidades", "bolsas", "planchas", "galones", "sacos").
- sourceQuote: the exact words from the transcript supporting this material.
- category: roof_shelter (roofs, tarps, shelter), reconstruction (walls, structure, bricks, cement), heal_sow (gardens, seeds, soil, community healing).
- damageDescriptionEs/En: one or two short sentences describing ONLY the damage stated in the transcript. No names, no locations.
- urgency is a SUGGESTION for the worker to confirm: high only if the transcript indicates danger, exposure to rain, vulnerable people, or says urgent.
- proposedMilestones: 2-4 short, verifiable project milestones in order (e.g. "Materiales recibidos"/"Materials received", "Muro reconstruido"/"Wall rebuilt", "Techo reparado"/"Roof repaired"). Each has es and en.
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

async function openaiExtract(apiKey: string, transcript: string, language: "es" | "en"): Promise<Omit<Extraction, "source" | "redactions">> {
  const model = process.env.OPENAI_EXTRACT_MODEL || "gpt-4.1-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Transcript language selected by the field worker: ${language === "es" ? "Spanish (es)" : "English (en)"}.\nTranscript:\n"""${transcript}"""`,
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "field_report", strict: true, schema: JSON_SCHEMA } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`openai_extract_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("openai_extract_empty");
  const p = JSON.parse(content) as Omit<Extraction, "source" | "redactions" | "model">;

  const cats: Category[] = ["roof_shelter", "reconstruction", "heal_sow"];
  const urg: Urgency[] = ["low", "medium", "high"];
  const conf: Confidence[] = ["high", "medium", "low"];
  const str = (x: unknown, d = "") => (typeof x === "string" ? x.slice(0, 2000) : d);
  return {
    model,
    titleEs: str(p.titleEs),
    titleEn: str(p.titleEn),
    category: cats.includes(p.category) ? p.category : "reconstruction",
    summaryEs: str(p.summaryEs),
    summaryEn: str(p.summaryEn),
    urgency: urg.includes(p.urgency) ? p.urgency : "medium",
    damageDescriptionEs: str(p.damageDescriptionEs),
    damageDescriptionEn: str(p.damageDescriptionEn),
    materials: (Array.isArray(p.materials) ? p.materials : []).slice(0, 30).map((m) => ({
      itemKey: (ITEM_KEYS as readonly string[]).includes(m.itemKey) ? m.itemKey : "other",
      nameEs: str(m.nameEs),
      nameEn: str(m.nameEn),
      quantity: typeof m.quantity === "number" && Number.isFinite(m.quantity) && m.quantity > 0 ? m.quantity : null,
      unit: str(m.unit, "unidades") || "unidades",
      confidence: conf.includes(m.confidence) ? m.confidence : "low",
      approximate: m.approximate === true,
      sourceQuote: str(m.sourceQuote),
    })),
    missingQuestions: (Array.isArray(p.missingQuestions) ? p.missingQuestions : [])
      .slice(0, 10)
      .map((q) => ({ es: str(q.es), en: str(q.en) })),
    proposedMilestones: (Array.isArray(p.proposedMilestones) ? p.proposedMilestones : [])
      .slice(0, 8)
      .map((q) => ({ es: str(q.es).slice(0, 200), en: str(q.en).slice(0, 200) }))
      .filter((q) => q.es || q.en),
    transcriptTranslated: typeof p.transcriptTranslated === "string" ? p.transcriptTranslated : null,
  };
}

async function openaiTranscribe(apiKey: string, audio: Blob, language: "es" | "en"): Promise<string> {
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
  const type = audio.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac")
    ? "m4a"
    : type.includes("ogg")
      ? "ogg"
      : type.includes("wav")
        ? "wav"
        : type.includes("mpeg") || type.includes("mp3")
          ? "mp3"
          : "webm";
  const form = new FormData();
  form.append("file", new File([audio], `report.${ext}`, { type }));
  form.append("model", model);
  form.append("language", language); // hint only; transcript stays in the original language
  form.append("response_format", "json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`openai_transcribe_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

// ---------------- actions ----------------

const resultValidator = v.object({
  status: v.union(v.literal("done"), v.literal("needs_text")),
  source: v.optional(v.union(v.literal("openai"), v.literal("fallback"))),
  reason: v.optional(v.string()),
});

export const transcribeAndExtract = action({
  args: { sessionToken: v.string(), reportId: v.id("fieldReports") },
  returns: resultValidator,
  handler: async (ctx, args): Promise<typeof resultValidator.type> => {
    // Authorization + data minimization: this query returns only transcript/audio ref.
    const info: { transcript: string; language: "es" | "en"; audioStorageId: Id<"_storage"> | null } =
      await ctx.runQuery(internal.field.getReportForAi, args);
    const apiKey = process.env.OPENAI_API_KEY;
    await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "pending" });

    let transcript = info.transcript.trim();
    if (!transcript) {
      if (!info.audioStorageId) {
        await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "error", aiError: "no_input" });
        return { status: "needs_text", reason: "no_input" };
      }
      if (!apiKey) {
        await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "error", aiError: "no_api_key_audio" });
        return { status: "needs_text", reason: "no_api_key_audio" };
      }
      try {
        const blob = await ctx.storage.get(info.audioStorageId);
        if (!blob) throw new Error("audio_missing");
        transcript = await openaiTranscribe(apiKey, blob, info.language);
        if (!transcript) throw new Error("empty_transcript");
        await ctx.runMutation(internal.field.storeTranscript, { reportId: args.reportId, transcript });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("transcription failed", msg);
        await ctx.runMutation(internal.field.setAiStatus, { reportId: args.reportId, aiStatus: "error", aiError: "transcription_failed" });
        return { status: "needs_text", reason: "transcription_failed" };
      }
    }

    // Strip obvious names/phones/emails before the transcript leaves Convex.
    const { text: safe, count } = redact(transcript);
    let extraction: Extraction;
    if (apiKey) {
      try {
        extraction = { source: "openai", redactions: count, ...(await openaiExtract(apiKey, safe, info.language)) };
      } catch (e) {
        console.error("extraction failed, using fallback", e instanceof Error ? e.message : e);
        extraction = fallbackExtract(safe, info.language, count, "openai_error");
      }
    } else {
      extraction = fallbackExtract(safe, info.language, count, "no_api_key");
    }
    await ctx.runMutation(internal.field.storeExtraction, { reportId: args.reportId, extraction });
    return { status: "done", source: extraction.source };
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
