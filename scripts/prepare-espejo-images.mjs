// Decode every downloaded original, record dimensions, and prepare only selected site assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'docs/espejo-de-agua/image-catalog.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const outputs = {
  'logo-header.png': 'logo.png',
  'resguardo-ibanacuara-condiciones5.jpg': 'ibanacuara-roof.webp',
  // Road fissure replaces the workshop photo: the homepage promises no identifiable people.
  // Crop a 4:3 band around the crack, excluding the distant walkers and the camera timestamp.
  'terremoto-camino.jpg': 'earthquake-road.webp',
};
const crops = {
  'terremoto-camino.jpg': { left: 0, top: 470, width: 1053, height: 790 },
};
await fs.mkdir(path.join(root, 'public/espejo-de-agua'), { recursive: true });
for (const entry of manifest.images) {
  if (!entry.localPath) continue;
  const input = path.join(root, entry.localPath);
  const metadata = await sharp(input).metadata();
  entry.width = metadata.width;
  entry.height = metadata.height;
  const outputName = outputs[path.basename(input)];
  delete entry.webPath;
  delete entry.webBytes;
  if (!outputName) continue;
  entry.webPath = `/espejo-de-agua/${outputName}`;
  const output = path.join(root, 'public', entry.webPath);
  if (outputName.endsWith('.png')) {
    await fs.copyFile(input, output);
  } else {
    let img = sharp(input).rotate();
    const crop = crops[path.basename(input)];
    if (crop) img = img.extract(crop);
    await img.resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(output);
  }
  entry.webBytes = (await fs.stat(output)).size;
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const rows = manifest.images.filter(i => i.localPath);
const gallery = rows.map(i => `### ${path.basename(i.localPath)}\n\n![${path.basename(i.localPath)}](../../${i.localPath})\n\n${i.width} × ${i.height} · ${Math.round(i.bytes / 1024)} KiB · [Source image](${i.sourceUrl}) · [Source page](${i.sourcePages[0]})\n\n${i.intendedUse}${i.webPath ? ` Shown on the homepage from \`public${i.webPath}\`.` : ' Downloaded for future contextual use; not exposed by the app.'}`).join('\n\n');
await fs.writeFile(path.join(root, 'docs/espejo-de-agua/README.md'), `# Official Espejo de Agua imagery\n\nCataloged ${manifest.images.length} unique image URLs across the official homepage, gallery, emergency appeal, and Techo, Camino y Semilla project page. Downloaded ${rows.length} selected originals into \`assets/espejo-de-agua/originals\`. Retrieval date: ${manifest.retrievedAt}.\n\n[Full provenance catalog](./image-catalog.json) records source URLs, pages, captions, checksums, dimensions, and intended use. Originals are preserved unchanged. Only the reviewed logo and two photos are copied/optimized under \`public/espejo-de-agua\`; WebP copies retain the whole frame and omit embedded metadata.\n\n## Placement\n\nThe homepage archive section credits Espejo de Agua and links each image to its original source page. The roof photo keeps its Ibanacuara earthquake context, and the road photo keeps its earthquake-fissure context. Photos with identifiable people (such as the Mariela workshop) are kept only as archived originals and are not shown, matching the homepage privacy promise. These photos are never used as fictional project covers, donation material images, or verified delivery evidence. Other downloaded photos remain available for future organization or original-event sections.\n\n## Rights and attribution\n\n${manifest.rights} Preserve the publisher attribution and original context when reusing these files.\n\n## Refresh\n\nRun from the repository root with dependencies installed:\n\n\`\`\`sh\npython3 scripts/import-espejo-images.py\nnode scripts/prepare-espejo-images.mjs\n\`\`\`\n\nThe importer is limited to four named pages and twelve selected images on the official domain. It records other discovered images without downloading them.\n\n## Downloaded gallery\n\n${gallery}\n`);
console.log(JSON.stringify({ validatedOriginals: rows.length, siteAssets: rows.filter(i => i.webPath).map(({webPath, webBytes}) => ({webPath, webBytes})) }, null, 2));
