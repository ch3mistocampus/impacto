import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetAndCheck } from "./convex";

/**
 * Smoke test of the 3-minute judging script (docs/BRIEF.md), driven through the real UI:
 * field intake → coordinator publish → donor pledges 50 bricks → public shows "pledged, not
 * delivered" → coordinator received/delivered/used/verified → public + donor show verified → EN.
 *
 * The run creates its OWN project (unique alias + unique fictional private details) so it does not
 * depend on, or disturb, the seeded "Reconstrucción 021" the presenter uses. Demo data is reset
 * before (global setup) and after (afterAll) the run.
 */

const TAG = `${Date.now() % 100000}`.padStart(5, "0");
const ALIAS = `Reconstrucción E2E ${TAG}`;
/** Letters-only run code for private strings, so no token of the private name overlaps the alias. */
const CODE = TAG.replace(/\d/g, (d) => "QWERTYUIOP"[Number(d)]);
const PRIVATE = {
  name: `Familia Zetaprueba ${CODE}`,
  contact: `benef.${TAG}@example.invalid`,
  address: `Vereda Inventada Quetzal ${CODE}`,
  notes: `Notas privadas sintéticas ${TAG}`,
};
const DONOR = { name: `Donante Prueba ${TAG}`, contact: `donor.${TAG}@example.invalid` };
/** Strings that must never appear on a public page. */
const FORBIDDEN = [PRIVATE.name, "Zetaprueba", PRIVATE.contact, PRIVATE.address, "Quetzal", PRIVATE.notes, DONOR.contact];

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  const c = resetAndCheck("after the demo run");
  const before = process.env.E2E_PERSONA_IDS;
  if (before) expect(JSON.stringify(c.personaIds), "persona ids stable across a full demo run + reset").toBe(before);
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const SESSION_KEY = "impacto.session";
const sessionToken = (page: Page) => page.evaluate((k) => localStorage.getItem(k), SESSION_KEY);

/** The header's demo sign-in / role-switch disclosure trigger (signed out or signed in). */
const roleTrigger = (page: Page) =>
  page.getByRole("button", { name: /^(Entrar \(demo\)|Sign in \(demo\)|Cambiar rol|Switch role)$/ });

/** Sign out through the header (the "Salir" item inside the role menu). */
async function signOutIfNeeded(page: Page) {
  if (!(await sessionToken(page))) return;
  const out = page.getByRole("button", { name: /^(Salir|Sign out)$/ });
  if (!(await out.isVisible())) await roleTrigger(page).click();
  await out.click();
  await expect.poll(() => sessionToken(page)).toBeNull();
  await expect(page.getByRole("button", { name: /^(Entrar \(demo\)|Sign in \(demo\))$/ })).toBeVisible();
}

/** Sign in through the header's demo role switcher, then open `path`. */
async function signInAs(page: Page, role: "field_worker" | "coordinator" | "donor", path: string) {
  const before = await sessionToken(page);
  await roleTrigger(page).click();
  await page.locator(`button[data-role="${role}"]`).click();
  await expect.poll(() => sessionToken(page)).not.toBe(before);
  await expect(page.getByText(/^(Viendo como|Viewing as)/).first()).toBeVisible();
  await page.goto(path);
}

/** Number shown next to a <dt> label inside a scope (ledger grids use dt + dd siblings). */
function stageValue(scope: Locator, label: string | RegExp) {
  return scope.locator("dt").filter({ hasText: label }).first().locator("xpath=following-sibling::dd[1]");
}

async function expectStage(scope: Locator, label: string | RegExp, value: number | string) {
  await expect(stageValue(scope, label)).toHaveText(new RegExp(`^\\s*${value}\\s*$`));
}

const visitedPublic = new Set<string>();

/** Privacy: neither the rendered text nor the HTML of a public page contains private run data. */
async function assertNoPrivateData(page: Page) {
  visitedPublic.add(new URL(page.url()).pathname);
  const text = await page.locator("body").innerText();
  const html = await page.content();
  for (const s of FORBIDDEN) {
    expect(text, `public page ${page.url()} leaks "${s}"`).not.toContain(s);
    expect(html, `public page HTML ${page.url()} leaks "${s}"`).not.toContain(s);
  }
}

// ---------------------------------------------------------------------------
// the script
// ---------------------------------------------------------------------------

test("judging demo: field → coordinator → donor → verified → English", async ({ page, context }) => {
  // Spanish first (the app's default), unless a step switches language.
  await context.addInitScript(() => {
    try {
      if (!localStorage.getItem("impacto.locale")) localStorage.setItem("impacto.locale", "es");
    } catch {}
  });

  let projectId = "";
  let followToken = "";

  await test.step("1. field worker: demo transcript → AI draft → private details → submit", async () => {
    await page.goto("/");
    await signInAs(page, "field_worker", "/field");
    await page.getByRole("link", { name: "Nuevo proyecto" }).click();
    await page.getByRole("button", { name: "Usar transcripción de demo" }).click();
    await page.getByRole("button", { name: "Analizar con IA" }).click();
    await expect(page.getByRole("heading", { name: "Revisa el borrador" })).toBeVisible({ timeout: 120_000 });
    projectId = new URL(page.url()).pathname.split("/").pop()!;

    // Review: bricks 200, cement 15, roof quantity left blank ("Requiere confirmación").
    const qty = page.getByRole("spinbutton", { name: "Cantidad" });
    await expect(qty).toHaveCount(3);
    const values = await qty.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(values).toContain("200");
    expect(values).toContain("15");
    expect(values).toContain("");
    await expect(page.getByLabel("Nombre (es)").nth(values.indexOf("200"))).toHaveValue(/ladrillo/i);
    await expect(page.getByLabel("Nombre (es)").nth(values.indexOf("15"))).toHaveValue(/cemento/i);
    await expect(page.getByText("Requiere confirmación")).toHaveCount(1);

    await page.getByLabel("Nombre de la persona beneficiaria").fill(PRIVATE.name);
    await page.getByLabel("Contacto (teléfono / correo)").fill(PRIVATE.contact);
    await page.getByLabel("Ubicación precisa").fill(PRIVATE.address);
    await page.getByLabel("Notas privadas").fill(PRIVATE.notes);
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page.getByText("Pendiente de revisión").first()).toBeVisible();
  });

  await test.step("2. coordinator: alias guard blocks the private name, then approve & publish", async () => {
    await signInAs(page, "coordinator", "/coordinator");
    const inbox = page.getByRole("tabpanel", { name: /Por revisar/ });
    await inbox.locator(`a[href="/coordinator/${projectId}"]`).click();
    await expect(page.getByRole("heading", { name: "Versión pública" })).toBeVisible();

    const alias = page.getByLabel("Alias público");
    const publish = page.getByRole("button", { name: "Aprobar y publicar" });
    await alias.fill(`Reconstrucción Zetaprueba ${TAG}`);
    await expect(page.getByText(/El alias contiene el nombre privado/)).toBeVisible();
    await expect(publish).toBeDisabled();
    await alias.fill(ALIAS);
    await expect(page.getByText(/El alias contiene el nombre privado/)).toHaveCount(0);

    const needs = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: /^Cantidad — / }) });
    await expect(needs).toHaveCount(3);
    for (const name of [/ladrillo/i, /cemento/i]) {
      const row = needs.filter({ has: page.getByRole("textbox", { name }) });
      await row.getByRole("button", { name: "Aprobar", exact: true }).click();
      await expect(row.getByRole("button", { name: "Aprobar", exact: true })).toHaveCount(0);
    }
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByRole("heading", { level: 1, name: ALIAS })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "Materiales" })).toBeVisible();
  });

  await test.step("3. donor (signed out): /donate → bricks card of this project → pledge 50", async () => {
    await signOutIfNeeded(page);
    await page.goto("/donate");
    await page.getByRole("group", { name: "Filtrar por categoría" }).getByRole("button", { name: "Reconstrucción" }).click();
    await page.getByRole("combobox", { name: "Material" }).selectOption({ label: "Ladrillos" });
    const deck = page.getByRole("region", { name: "Desliza la tarjeta" });
    const card = deck.locator("article").first();
    // Pass cards until this run's project is on top.
    for (let i = 0; i < 40; i++) {
      await expect(card).toBeVisible();
      if ((await card.innerText()).includes(ALIAS)) break;
      const before = await card.innerText();
      await deck.getByRole("button", { name: "Pasar" }).click();
      await expect.poll(async () => (await card.isVisible()) ? card.innerText() : "", { timeout: 10_000 }).not.toBe(before);
    }
    await expect(card).toContainText(ALIAS);
    await expect(card.getByRole("heading", { name: "Ladrillos" })).toBeVisible();
    await assertNoPrivateData(page);

    await deck.getByRole("button", { name: "Aportar" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const qtyInput = sheet.getByRole("spinbutton");
    await qtyInput.fill("50");
    await expect(qtyInput).toHaveValue("50");
    await sheet.getByLabel("Tu nombre").fill(DONOR.name);
    await sheet.getByLabel("Correo o teléfono").fill(DONOR.contact);
    await sheet.getByRole("button", { name: /^Comprometer 50 / }).click();
    await expect(sheet.getByRole("status").filter({ hasText: "Comprometido, no entregado" })).toBeVisible();
    const follow = sheet.getByRole("link", { name: "Seguir mi compromiso" });
    followToken = (await follow.getAttribute("href"))!.split("/").pop()!;
    expect(followToken).toBeTruthy();
    await assertNoPrivateData(page);
  });

  await test.step("4. public project page: pledged 50, received/delivered/verified 0", async () => {
    await page.goto(`/p/${projectId}`);
    await expect(page.getByRole("heading", { name: ALIAS }).first()).toBeVisible();
    const bricks = page.locator("article, li, section").filter({ has: page.getByRole("heading", { name: "Ladrillos" }) }).last();
    await expectStage(bricks, /^Comprometido$/, 50);
    await expectStage(bricks, /^Recibido$/, 0);
    await expectStage(bricks, /^Entregado$/, 0);
    await expectStage(bricks, /^Verificado$/, 0);
    await assertNoPrivateData(page);

    await page.goto(`/follow/${followToken}`);
    await expect(page.getByText("Comprometido, no entregado").first()).toBeVisible();
    await assertNoPrivateData(page);
  });

  let milestonesBefore = -1;
  await test.step("5. transparency counters (before)", async () => {
    await page.goto("/transparency");
    const v = stageValue(page.locator("section[aria-labelledby='counters-title']"), /hitos? verificados?/);
    await expect(v).toHaveText(/\d/);
    milestonesBefore = Number((await v.innerText()).replace(/\D/g, ""));
    await assertNoPrivateData(page);
  });

  await test.step("6. coordinator: received (linked pledge) → delivered → used → verified", async () => {
    await signInAs(page, "coordinator", `/coordinator/${projectId}`);
    const panel = page.getByRole("tabpanel", { name: "Materiales" });
    const bricks = panel.locator("article").filter({ has: page.getByRole("heading", { name: "Ladrillos", level: 3 }) });
    await expectStage(bricks, "Comprometido", 50);

    // received, linked to the donor's pledge
    await bricks.getByRole("button", { name: "Marcar recibido", exact: true }).click();
    const pledgeSelect = bricks.getByLabel("De qué compromiso");
    await expect(pledgeSelect.locator("option", { hasText: DONOR.name })).toHaveCount(1);
    await pledgeSelect.selectOption({ label: (await pledgeSelect.locator("option", { hasText: DONOR.name }).innerText()).trim() });
    await expect(bricks.locator("#rcv-qty")).toHaveValue("50");
    await bricks.locator("form").getByRole("button", { name: "Marcar recibido · 50" }).click();
    await expectStage(bricks, "Recibido", 50);

    // delivered (demo preset: synthetic staff note), used, verified
    for (const [step, stage] of [
      ["Marcar entregado al proyecto", "Entregado"],
      ["Marcar usado", "Usado"],
      ["Verificar uso", "Verificado"],
    ] as const) {
      await bricks.getByRole("button", { name: new RegExp(`^${step}\\s*50$`) }).click();
      const submit = bricks.locator("form").getByRole("button", { name: `${step} · 50` });
      await expect(submit).toBeEnabled();
      await submit.click();
      await expectStage(bricks, stage, 50);
    }
    await expectStage(bricks, "Recibido", 50);
    await signOutIfNeeded(page);
  });

  await test.step("7. public: verified 50 on timeline + totals; donor sees verified", async () => {
    await page.goto(`/p/${projectId}`);
    const bricks = page.locator("article, li, section").filter({ has: page.getByRole("heading", { name: "Ladrillos" }) }).last();
    await expectStage(bricks, /^Verificado$/, 50);
    await expectStage(bricks, /^Recibido$/, 50);
    await expect(page.getByText(/verific\w*.*50 ladrillos|50 ladrillos.*verific/i).first()).toBeVisible();
    await assertNoPrivateData(page);

    // The donor card's "Ver proyecto" link target.
    await page.goto(`/transparency/projects/${projectId}`);
    await expect(page.getByText(ALIAS).first()).toBeVisible();
    await expect(page.getByText(/50/).first()).toBeVisible();
    await assertNoPrivateData(page);

    await page.goto("/transparency");
    const v = stageValue(page.locator("section[aria-labelledby='counters-title']"), /hitos? verificados?/);
    await expect.poll(async () => Number((await v.innerText()).replace(/\D/g, ""))).toBeGreaterThan(milestonesBefore);
    await assertNoPrivateData(page);

    await page.goto("/donations");
    await expect(page.getByText(/Verificado como usado:\s*50 ladrillos/i).first()).toBeVisible();
    await assertNoPrivateData(page);
  });

  await test.step("8. switch to English", async () => {
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByText(/Verified as used:\s*50 bricks/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Donate materials" }).first()).toBeVisible();
    await page.goto(`/p/${projectId}`);
    const bricks = page.locator("article, li, section").filter({ has: page.getByRole("heading", { name: "Bricks" }) }).last();
    await expectStage(bricks, /^Verified$/, 50);
    await expectStage(bricks, /^Received$/, 50);
    await assertNoPrivateData(page);
    console.log(`[e2e] public pages checked for privacy: ${[...visitedPublic].join(", ")}`);
  });
});
