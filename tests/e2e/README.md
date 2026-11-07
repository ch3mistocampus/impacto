# E2E smoke test — judging demo

`tests/e2e/judging-demo.spec.ts` drives the real UI through the 3-minute judging script
(docs/BRIEF.md): field worker submits the demo transcript (with fictional private details) →
coordinator checks the alias privacy guard, approves bricks + cement and publishes → signed-out
donor pledges 50 bricks on `/donate` ("Comprometido, no entregado") → public page shows pledged 50 /
received 0 / delivered 0 / verified 0 → coordinator records received (linked to the pledge) →
delivered (synthetic staff note) → used → verified → public page, transparency counters and
`/donations` show "Verificado como usado: 50 ladrillos" → English toggle. Every public page visited
is checked for the run's private beneficiary name / address / contact and the donor's contact.

The run creates its own project (alias `Reconstrucción E2E <n>`); it does not touch the seeded
"Reconstrucción 021". Demo data is reset twice before the run (global setup, asserting
`demo:checkCanonical` each time and that persona ids are stable) and once after (afterAll, same checks).
Sessions are never wiped by a reset.

## Run locally (dev Convex `precise-camel-918`)

```bash
npx playwright install chromium   # once
pnpm test:e2e                     # uses the dev server already running on http://localhost:3300
```

No server on 3300? `E2E_WEB_SERVER=1 pnpm test:e2e` builds and starts one on port 3310.
Other targets: `E2E_BASE_URL=http://localhost:3000 pnpm test:e2e`.
Failure traces/screenshots land in `test-results/` (`pnpm exec playwright show-trace <trace.zip>`).

## Run against production (h4h.casa)

```bash
E2E_BASE_URL=https://h4h.casa E2E_CONVEX_FLAGS=--prod pnpm test:e2e
```

**This mutates prod demo data**: it resets the demo (`seed:resetDemo` on the prod deployment), creates
a project, a pledge and ledger events through the UI, then resets the demo again at the end.
`E2E_CONVEX_FLAGS=--prod` makes the reset/check CLI calls (`npx convex run --prod …`) target the same
deployment as the site; you need Convex CLI access to prod (logged in, or `CONVEX_DEPLOY_KEY` set).
The deployment must have `DEMO_MODE=true`. Don't run it while someone is presenting.

Useful by hand: `npx convex run demo:checkCanonical` (booleans + counts, no private data).
