// Build the homepage before/after pairs from assets/before-after/{before,after}.
// Before = real Espejo de Agua photo (unchanged originals live in assets/espejo-de-agua/originals).
// After  = AI-generated illustration made from that photo; always labelled as such in the UI.
// Every output is a 4:3 WebP, 1200 px wide, so each pair lines up exactly in the compare slider.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "assets/before-after");
const out = path.join(root, "public/before-after");

/**
 * crop: 4:3 region to keep. blur: regions softened so no person is shown (privacy promise).
 * Pair 3 crops the left strip in both frames to drop a person standing at the edge.
 */
const PAIRS = [
  {
    name: "01-collapsed-zinc-roof",
    before: { file: "before/01-collapsed-zinc-roof.jpg", crop: { left: 0, top: 480, width: 1200, height: 900 }, blur: [{ left: 270, top: 750, width: 130, height: 130 }] },
    after: { file: "after/01-collapsed-zinc-roof.png", crop: { left: 180, top: 170, width: 1220, height: 915 } },
  },
  {
    name: "02-bare-bamboo-frame",
    before: { file: "before/02-bare-bamboo-frame.jpg" },
    after: { file: "after/02-bare-bamboo-frame.png" },
  },
  {
    name: "03-tarp-walled-shelters",
    before: { file: "before/03-tarp-walled-shelters.jpg", crop: { left: 80, top: 470, width: 1120, height: 840 } },
    after: { file: "after/03-tarp-walled-shelters.png", crop: { left: 90, top: 26, width: 1358, height: 1018 } },
  },
];

async function build({ file, crop, blur = [] }, dest) {
  let base = sharp(path.join(src, file)).rotate();
  if (crop) base = base.extract(crop);
  let buf = await base.toBuffer();
  for (const r of blur) {
    // Feathered ellipse: a blurred copy masked by a soft radial gradient, so there is no hard box edge.
    const { width, height } = await sharp(buf).metadata();
    const cx = r.left - (crop?.left ?? 0) + r.width / 2;
    const cy = r.top - (crop?.top ?? 0) + r.height / 2;
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="g">` +
        `<stop offset="0.55" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${r.width * 0.75}" ry="${r.height * 0.75}" fill="url(#g)"/></svg>`,
    );
    const soft = await sharp(buf).blur(10).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    buf = await sharp(buf).composite([{ input: soft }]).toBuffer();
  }
  await sharp(buf).resize({ width: 1200, height: 900, fit: "cover" }).webp({ quality: 80 }).toFile(dest);
  return (await fs.stat(dest)).size;
}

await fs.mkdir(out, { recursive: true });
for (const p of PAIRS) {
  const b = await build(p.before, path.join(out, `${p.name}-before.webp`));
  const a = await build(p.after, path.join(out, `${p.name}-after.webp`));
  console.log(`${p.name}: before ${Math.round(b / 1024)} KiB, after ${Math.round(a / 1024)} KiB`);
}
