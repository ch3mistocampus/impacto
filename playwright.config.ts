import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke test of the 3-minute judging demo (tests/e2e/README.md).
 *   E2E_BASE_URL       app under test (default http://localhost:3300, the usual dev server)
 *   E2E_CONVEX_FLAGS   extra flags for `npx convex run` resets, e.g. "--prod" for h4h.casa
 *   E2E_WEB_SERVER=1   start `pnpm build && pnpm start -p 3310` instead of reusing a running server
 */
const ownServer = process.env.E2E_WEB_SERVER === "1";
const baseURL = process.env.E2E_BASE_URL ?? (ownServer ? "http://localhost:3310" : "http://localhost:3300");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 5 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    locale: "es-CO",
    viewport: { width: 1280, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: ownServer
    ? { command: "pnpm build && pnpm start -p 3310", url: "http://localhost:3310", timeout: 10 * 60_000, reuseExistingServer: true }
    : undefined,
});
