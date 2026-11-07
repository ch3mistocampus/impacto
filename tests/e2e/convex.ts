import { execFileSync } from "node:child_process";

/** Runs a Convex function via the CLI against the deployment the test targets. */
export function convexRun<T = unknown>(fn: string, args: Record<string, unknown> = {}): T {
  const flags = (process.env.E2E_CONVEX_FLAGS ?? "").split(/\s+/).filter(Boolean);
  const out = execFileSync("npx", ["convex", "run", ...flags, fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  return JSON.parse(out) as T;
}

export type Canonical = {
  ok: boolean;
  checks: Record<string, boolean>;
  counts: Record<string, number>;
  personaIds: Record<string, string>;
};

/** Reset demo data and assert the canonical starting state. Returns the canonical report. */
export function resetAndCheck(label: string): Canonical {
  const t0 = Date.now();
  // A reset schedules a background action that attaches demo photos; a reset that starts while it
  // is still writing hits an OCC conflict. Wait and retry instead of failing the run.
  for (let attempt = 1; ; attempt++) {
    try {
      convexRun("seed:resetDemo");
      break;
    } catch (e) {
      const msg = String((e as { stderr?: string }).stderr ?? e);
      if (attempt >= 4 || !msg.includes("OptimisticConcurrencyControlFailure")) throw e;
      console.log(`[e2e] ${label}: reset hit an OCC conflict with demo photo attach, retrying (${attempt})`);
      execFileSync("sleep", ["5"]);
    }
  }
  const ms = Date.now() - t0;
  const c = convexRun<Canonical>("demo:checkCanonical");
  const failed = Object.entries(c.checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  console.log(`[e2e] ${label}: reset in ${ms} ms (CLI round trip), canonical=${c.ok}${failed.length ? ` failed=${failed.join(",")}` : ""}`);
  if (!c.ok) throw new Error(`[e2e] demo not canonical after ${label}: ${failed.join(", ")} ${JSON.stringify(c.counts)}`);
  return c;
}
