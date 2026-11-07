// Records the Impacto guided walkthrough video against the local dev server (dev Convex).
// Usage: node scripts/record-walkthrough.mjs <outDir> [baseUrl]
// Drives the guided tour + the real judging flow (field → publish → pledge 50 → verify → public → ES)
// and saves <outDir>/raw.webm + marks.json. It WRITES demo data: run `npx convex run seed:resetDemo`
// before and after (add --prod when recording against h4h.casa).
// Encode: ffmpeg -i raw.webm -vf scale=1920:1080,fps=30 -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4
import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = process.argv[2];
const B = process.argv[3] ?? "http://localhost:3300";
const W = 1600, H = 900;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
const T0 = Date.now();
const marks = [];
const mark = (label) => { const t = (Date.now() - T0) / 1000; marks.push({ label, t }); console.log(t.toFixed(1), label); };

await ctx.addInitScript(() => {
  try {
    if (!sessionStorage.getItem("rec.init")) {
      sessionStorage.setItem("rec.init", "1");
      localStorage.setItem("impacto.locale", "en");
      localStorage.removeItem("impacto.session");
    }
  } catch {}
  const install = () => {
    if (document.getElementById("rec-cursor")) return;
    const st = document.createElement("style");
    st.textContent = `
      nextjs-portal{display:none!important}
      #rec-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:26px;height:26px;
        transform:translate(-4px,-3px);transition:opacity .2s}
      #rec-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .rec-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;
        border-radius:50%;border:3px solid #e8b70b;animation:rec-r .55s ease-out forwards}
      @keyframes rec-r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(st);
    const c = document.createElement("div");
    c.id = "rec-cursor";
    c.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 10.5-6.6 1.2 3.9 7.3-2.7 1.4-3.9-7.4L4 19.5z" fill="#0b2a5b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    const pos = JSON.parse(sessionStorage.getItem("rec.pos") || "[800,450]");
    c.style.left = pos[0] + "px"; c.style.top = pos[1] + "px";
    document.body.appendChild(c);
    window.addEventListener("mousemove", (e) => {
      c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px";
      try { sessionStorage.setItem("rec.pos", JSON.stringify([e.clientX, e.clientY])); } catch {}
    }, true);
    window.addEventListener("mousedown", (e) => {
      const r = document.createElement("div"); r.className = "rec-ripple";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.appendChild(r); setTimeout(() => r.remove(), 700);
    }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
});

const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERR", e.message));
const wait = (ms) => page.waitForTimeout(ms);
let cur = [800, 450];
async function glide(x, y, steps = 28) {
  await page.mouse.move(x, y, { steps });
  cur = [x, y];
}
async function click(loc, { pause = 350 } = {}) {
  await loc.scrollIntoViewIfNeeded();
  const stable = async () => {
    let prev = null;
    for (let k = 0; k < 40; k++) {
      const b = await loc.boundingBox();
      if (b && prev && Math.abs(b.y - prev.y) < 0.5 && Math.abs(b.x - prev.x) < 0.5) return b;
      prev = b;
      await wait(120);
    }
    return prev;
  };
  let b = await stable();
  await glide(b.x + b.width / 2, b.y + b.height / 2);
  await wait(pause);
  b = await stable();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await wait(70); await page.mouse.up();
}
async function type(loc, text, delay = 55) {
  await click(loc);
  await loc.fill("");
  await loc.pressSequentially(text, { delay });
}
const tourNext = async (hold = 0) => { if (hold) await wait(hold); await click(page.locator("[data-tour-next]").filter({ visible: true })); };
const tourIs = (id) => page.waitForFunction((id) => window.__impactoTour?.step === id, id, { timeout: 30_000 });
async function scrollBy(dy, ms = 1400) {
  const n = 30;
  for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy / n); await wait(ms / n); }
}

let failed = null;
try {
// ---------------------------------------------------------------- title card
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400&display=swap" rel="stylesheet">`;
const card = (kicker, title, sub) => `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0;height:100%;background:#fff;color:#0b2a5b;font-family:Karla,sans-serif}
  .band{display:flex;height:10px}.band i{display:block}
  .wrap{height:calc(100% - 10px);display:grid;place-items:center;text-align:center}
  .k{font-family:'Source Serif 4',serif;font-style:italic;font-size:30px;color:#4a5875;opacity:0;animation:in .8s .1s forwards}
  h1{font-family:'Source Serif 4',serif;font-weight:400;font-size:132px;line-height:1;margin:18px 0 26px;opacity:0;animation:in .9s .35s forwards}
  p{font-size:28px;color:#33415c;max-width:30ch;margin:0 auto;line-height:1.4;opacity:0;animation:in .9s .8s forwards}
  @keyframes in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
</style></head><body><div class="band"><i style="flex:2;background:#e8b70b"></i><i style="flex:1;background:#0b2a5b"></i><i style="flex:1;background:#b3122a"></i></div>
<div class="wrap"><div><div class="k">${kicker}</div><h1>${title}</h1><p>${sub}</p></div></div></body></html>`;

mark("title");
await page.setContent(card("Impacto · with Espejo de Agua", "Every brick, counted.", "From a voice note in the field to verified impact. A guided walkthrough of the live app."));
await wait(4500);

// ---------------------------------------------------------------- 1. public
mark("intro");
await page.goto(B + "/?tour=1", { waitUntil: "networkidle" });
await tourIs("intro");
await glide(900, 520);
await tourNext(4200);
await tourIs("figures");
await tourNext(5000);

// ---------------------------------------------------------------- 2. field capture → AI draft
await tourIs("capture");
mark("capture");
await page.getByRole("button", { name: "Use demo transcript" }).waitFor();
await wait(3500);
await click(page.getByRole("button", { name: "Use demo transcript" }));
await wait(1800);
const analyze = page.getByRole("button", { name: "Analyze with AI" });
for (let k = 0; k < 3 && !(await analyze.isEnabled()); k++) { await click(page.getByRole("button", { name: "Use demo transcript" })); await wait(1200); }
await click(analyze);
mark("ai-wait-start");
await page.getByRole("heading", { name: "Review the draft" }).waitFor({ timeout: 180_000 });
mark("ai-wait-end");
await wait(1500);
await scrollBy(700, 2500);
await wait(2200);
await scrollBy(-700, 1200);
await tourNext(800);

// ---------------------------------------------------------------- 3. field: live project
await tourIs("draft");
mark("draft");
await tourNext(6000);
await tourIs("fieldPrivate");
await tourNext(5000);

// ---------------------------------------------------------------- 4. coordinator: review + publish
await tourIs("coordEvidence");
mark("coordinator");
await page.locator('[data-tour="coord-evidence"]').waitFor();
await tourNext(6000);
await tourIs("coordPrivate");
await tourNext(4500);
await tourIs("publish");
mark("publish");
await wait(1800);
const alias = page.getByLabel("Public alias");
await type(alias, "Reconstrucción Familia Ejemplo");
await wait(2600); // alias guard warning visible
await type(alias, "Reconstrucción 021");
await wait(900);
const needs = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: /^Quantity — / }) });
for (const name of [/brick/i, /cement/i]) {
  const row = needs.filter({ has: page.getByRole("textbox", { name }) });
  await click(row.getByRole("button", { name: "Approve", exact: true }));
  await wait(900);
}
const publishBtn = page.getByRole("button", { name: "Approve & publish" });
await click(publishBtn);
await page.getByRole("heading", { level: 1, name: "Reconstrucción 021" }).waitFor({ timeout: 30_000 });
await wait(2500);

// ---------------------------------------------------------------- 5. donor: swipe → pledge 50
await tourNext();
await tourIs("deck");
mark("donor");
const deck = page.getByRole("region", { name: "Swipe the card" });
await deck.locator("article").first().waitFor({ timeout: 30_000 });
await wait(2500);
await click(page.getByRole("combobox", { name: "Material" }));
await page.getByRole("combobox", { name: "Material" }).selectOption({ label: "Bricks" });
await wait(1500);
const top = deck.locator("article").first();
for (let k = 0; k < 20; k++) {
  if ((await top.innerText()).includes("Reconstrucción 021")) break;
  await click(deck.getByRole("button", { name: "Pass" }), { pause: 200 });
  await wait(1100);
}
await wait(1500);
await click(deck.getByRole("button", { name: "Give" }));
const sheet = page.locator("dialog[open]").filter({ visible: true });
await sheet.waitFor();
await tourIs("sheet"); // the tour advances by itself when the sheet opens
mark("pledge");
await wait(1500);
const qty = sheet.getByRole("spinbutton");
await click(qty);
await qty.fill("50");
await wait(500);
await type(sheet.getByLabel("Your name"), "Ana (demo donor)");
await type(sheet.getByLabel("Email or phone"), "ana@example.org");
await wait(500);
await click(sheet.getByRole("button", { name: /^Pledge 50 / }));
await sheet.getByRole("status").filter({ hasText: "Pledged, not delivered" }).waitFor();
await wait(4500);

// ---------------------------------------------------------------- 6. coordinator: received → verified
await click(sheet.locator("[data-tour-next]"));
await tourIs("ledger");
mark("ledger");
const panel = page.locator("#mpanel-materials").filter({ visible: true });
const bricks = panel.locator("article").filter({ has: page.getByRole("heading", { name: "Bricks", level: 3 }) });
await bricks.waitFor({ timeout: 30_000 });
await wait(4500); // let the narration read
await click(page.getByRole("button", { name: "Minimize" }));
await wait(600);
await bricks.scrollIntoViewIfNeeded();
await click(bricks.getByRole("button", { name: "Mark received", exact: true }));
const sel = bricks.getByLabel("From which pledge");
await sel.waitFor();
const opt = sel.locator("option", { hasText: "Ana (demo donor)" });
await sel.selectOption({ label: (await opt.innerText()).trim() });
await wait(1200);
await click(bricks.locator("form").getByRole("button", { name: "Mark received · 50" }));
await wait(1800);
for (const step of ["Mark delivered to project", "Mark used", "Verify use"]) {
  await click(bricks.getByRole("button", { name: new RegExp(`^${step}\\s*50$`) }));
  await wait(900);
  const submit = bricks.locator("form").getByRole("button", { name: `${step} · 50` });
  await click(submit);
  await wait(1800);
}
await wait(1500);
await click(page.locator("button[data-tour-card]"));
await wait(1200);

// ---------------------------------------------------------------- 7. public
await tourNext();
await tourIs("timeline");
mark("public");
await wait(3000);
await scrollBy(500, 2500);
await wait(2500);
await tourNext();
await tourIs("counters");
await tourNext(6000);
await tourIs("lang");
mark("spanish");
await tourNext(6500);
await tourIs("outro");
await wait(6000);

// ---------------------------------------------------------------- end card
mark("end");
await page.setContent(card("Impacto · con Espejo de Agua", "Cada ladrillo, contado.", "Try the guided tour at <b>h4h.casa</b> → “Guided tour”"));
await wait(5000);
mark("done");

} catch (e) { failed = e; console.log("FAILED", e.message.split("\n")[0]); await page.screenshot({ path: `${OUT}/err.png` }); }
const video = page.video();
await ctx.close();
await browser.close();
const src = await video.path();
fs.renameSync(src, `${OUT}/raw.webm`);
fs.writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks, null, 2));
console.log("saved", `${OUT}/raw.webm`);
