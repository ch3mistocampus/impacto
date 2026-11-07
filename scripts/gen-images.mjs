#!/usr/bin/env node
// Generates Impacto illustration assets via OpenRouter's Image API.
//
// Usage:
//   OPENROUTER_API_KEY=... node scripts/gen-images.mjs            # generate missing files
//   OPENROUTER_API_KEY=... node scripts/gen-images.mjs hero bricks # (re)generate specific keys
//   node scripts/gen-images.mjs --list                             # print jobs as JSON (no network)
//
// Endpoint: POST https://openrouter.ai/api/v1/images  -> { data: [{ b64_json }], usage: { cost } }
// Post-processing (resize / icons) is done separately with `sips`.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRIMARY_MODEL = "openai/gpt-5.4-image-2";
const FALLBACK_MODEL = "google/gemini-3.1-flash-image";
const ENDPOINT = "https://openrouter.ai/api/v1/images";

export const STYLE =
  "Style: warm, earthy, hand-crafted flat illustration with a soft paper texture. " +
  "Limited palette: clay #b4532a, brick #8a3b2a, leaf green #3f7a4a, sky blue #2f6690, cream background #fbf7f1. " +
  "Absolutely NO text, letters, numbers, logos or signage anywhere. No visible human faces. " +
  "Respectful and hopeful mood, not disaster imagery.";

const material = (obj) =>
  `A single ${obj}, centered, shown as a clean object icon on a plain flat cream #fbf7f1 background with generous empty margin around it, ` +
  `no scene, no ground clutter, subtle soft shadow. Part of a consistent icon set of building and garden supplies for a community recovery app in Puerto Rico.`;

const scene = (desc) =>
  `${desc} Setting: rural Puerto Rico, tropical vegetation (plantain, palms, flamboyan), modest concrete and wood homes.`;

const demoPhoto = (desc) =>
  `${desc} Privacy-safe: no people, no house numbers, no signs, no recognizable landmarks, no license plates.`;

export const JOBS = [
  // 1. Materials (square)
  ["bricks", "public/materials/bricks.png", "1:1", material("neat stack of clay bricks")],
  ["cement_bag", "public/materials/cement_bag.png", "1:1", material("paper sack of cement, plain unlabeled bag")],
  ["zinc_sheet", "public/materials/zinc_sheet.png", "1:1", material("corrugated metal (zinc) roofing sheet, slightly angled to show its ridges")],
  ["wood_beam", "public/materials/wood_beam.png", "1:1", material("pair of lumber wood beams with visible grain")],
  ["nails", "public/materials/nails.png", "1:1", material("small pile of steel nails")],
  ["tarp", "public/materials/tarp.png", "1:1", material("folded blue tarp with metal grommets")],
  ["paint", "public/materials/paint.png", "1:1", material("paint can with lid off showing clay-colored paint, with a brush resting on top, unlabeled can")],
  ["rebar", "public/materials/rebar.png", "1:1", material("bundle of ribbed steel rebar rods tied with wire")],
  ["seeds", "public/materials/seeds.png", "1:1", material("two blank seed packets beside small green seedlings sprouting in a little pot")],
  ["soil", "public/materials/soil.png", "1:1", material("open bag of dark rich garden soil, unlabeled bag")],
  ["water_tank", "public/materials/water_tank.png", "1:1", material("cylindrical household water storage tank (cisterna) as used on Puerto Rican rooftops")],
  ["tools", "public/materials/tools.png", "1:1", material("hammer and a hand saw crossed together")],
  ["generic", "public/materials/generic.png", "1:1", material("simple open wooden crate filled with assorted building supplies (a few bricks, a roll of wire, a small bag)")],

  // 2. Program illustrations (landscape)
  ["roof_shelter", "public/brand/roof_shelter.png", "3:2", scene("A modest Puerto Rican house getting a new corrugated zinc roof; two stylized figures seen from behind working on the roof, a ladder leaning on the wall.")],
  ["reconstruction", "public/brand/reconstruction.png", "3:2", scene("Brick and cement block walls of a small home being rebuilt; a stylized figure seen from behind laying bricks, a wheelbarrow and cement bags nearby.")],
  ["heal_sow", "public/brand/heal_sow.png", "3:2", scene("A community garden with raised beds of young seedlings, a watering can, stylized figures seen from behind planting together.")],

  // 3. Hero + logo
  ["hero", "public/brand/hero.png", "21:9", scene("Wide panoramic view of a hillside barrio in recovery at sunrise: houses with fresh new zinc and painted roofs, lush green plants and gardens returning, a winding road, soft morning sky with warm sun rising over green mountains. Calm, hopeful.")],
  ["logo-mark", "public/brand/logo-mark.png", "1:1", "A simple, bold, minimal logo mark: a stylized house roof shape (inverted V / gable) above concentric water-mirror ripples, as if the roof reflects in calm water. Single clay #b4532a color on a flat cream #fbf7f1 background, centered with wide safe padding (mark occupies about 60% of the canvas). Geometric, flat vector, no texture on the mark, no gradients. No text or letters."],

  // 4. Demo evidence images (landscape)
  ["damage-roof", "public/demo/damage-roof.png", "4:3", demoPhoto(scene("Close view of a small house with a storm-damaged roof: a few bent and missing zinc sheets, a blue tarp partially covering it, debris cleared. Factual but calm, soft daylight."))],
  ["materials-delivered", "public/demo/materials-delivered.png", "4:3", demoPhoto(scene("Stacks of clay bricks and plain unlabeled cement bags neatly delivered on the concrete porch of a modest house, daylight."))],
  ["repair-done", "public/demo/repair-done.png", "4:3", demoPhoto(scene("The same kind of small house after repair: a bright new corrugated zinc roof, freshly painted walls, potted plants on the porch, clear blue sky."))],
];

async function generate(model, prompt, aspect, key) {
  const body = { model, prompt: `${prompt}\n\n${STYLE}`, aspect_ratio: aspect, n: 1 };
  if (model.startsWith("openai/")) {
    body.quality = "medium";
    body.output_format = "png";
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!res.ok || !json.data?.[0]?.b64_json) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  }
  return { buf: Buffer.from(json.data[0].b64_json, "base64"), usage: json.usage ?? null };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    console.log(JSON.stringify(JOBS.map(([k, f, a, p]) => ({ key: k, file: f, aspect: a, prompt: `${p}\n\n${STYLE}` })), null, 2));
    return;
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const only = new Set(args);
  const jobs = [];
  for (const job of JOBS) {
    const out = path.join(ROOT, job[1]);
    if (only.size ? only.has(job[0]) : !(await fs.stat(out).catch(() => null))) jobs.push(job);
  }
  console.log(`Generating ${jobs.length} image(s)`);

  const log = [];
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const [name, file, aspect, prompt] = queue.shift();
      let model = PRIMARY_MODEL;
      let result;
      try {
        result = await generate(model, prompt, aspect, key);
      } catch (e) {
        console.error(`[${name}] ${model} failed: ${e.message} -> trying fallback`);
        model = FALLBACK_MODEL;
        try {
          result = await generate(model, prompt, aspect, key);
        } catch (e2) {
          console.error(`[${name}] fallback failed: ${e2.message}`);
          log.push({ name, file, error: e2.message });
          continue;
        }
      }
      const out = path.join(ROOT, file);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, result.buf);
      console.log(`[${name}] ok via ${model} cost=${result.usage?.cost ?? "?"} -> ${file}`);
      log.push({ name, file, model, usage: result.usage });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  const total = log.reduce((s, l) => s + (l.usage?.cost ?? 0), 0);
  console.log(`Total reported cost: $${total.toFixed(4)}`);
  if (process.env.GEN_LOG) await fs.writeFile(process.env.GEN_LOG, JSON.stringify(log, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
