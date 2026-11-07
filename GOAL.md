# Impacto — Goal & Build Contract

Full brief: `docs/BRIEF.md`. This file is what every agent builds against.

## The goal (one sentence)
A working, bilingual (ES-first) 3-minute demo where a **Spanish voice note becomes a reviewed project**, a **coordinator publishes it anonymously**, a **donor swipes to pledge 50 bricks** (shown as *pledged, not delivered*), and the **coordinator's receipt/use confirmation updates the public timeline and impact totals live** — without ever exposing beneficiary identity.

## Non-negotiables
1. **Privacy boundary:** beneficiary name/address/contact live only in `projectPrivate`. Public queries return explicit allowlisted fields. Private data never goes to AI.
2. **Ledger honesty:** requested / pledged / received / used / verified impact are always separate numbers. Use `convex/lib/ledger.ts`. Pledge ≠ delivery ≠ money.
3. **AI is a draft:** AI-extracted quantities are `aiSuggested: true`; unknown quantity ⇒ `requestedQty` undefined + `needsConfirmation: true`. Human review before publish.
4. **Server-side authz** in every non-public Convex function via `requireRole(ctx, args.sessionToken, [...])` from `convex/lib/auth.ts`.
5. **Bilingual:** every visible string through `useI18n().t(key)` (`src/lib/dict.ts`); DB pairs via `pick(es, en)`.
6. **Accessible:** every swipe has an equivalent large button; keyboard-operable.
7. **Synthetic data only**, labeled (`isDemo`, demo banner).

## Stack / conventions
- Next.js 16 App Router (read `node_modules/next/dist/docs/` before using APIs — it differs from training data), React 19, Tailwind v4, TypeScript.
- Convex (read `convex/_generated/ai/guidelines.md` first). Dev deployment: `precise-camel-918`.
- Demo auth: `useSession()` → `sessionToken`; pass it to every protected query/mutation.
- Design tokens in `src/app/globals.css` (clay / brick / leaf map to the three categories). Fonts: `font-display` (Fraunces), `font-sans` (Inter).
- Category keys: `roof_shelter`, `reconstruction`, `heal_sow`.

## Ownership (parallel agents — stay in your lane)
| Lane | Owns |
|---|---|
| A. Backend core | `convex/seed.ts`, `convex/public.ts`, `convex/pledges.ts`, `convex/coordinator.ts`, `convex/projects.ts` |
| B. Field intake + AI | `convex/field.ts`, `convex/ai.ts`, `src/app/field/**`, `src/components/field/**` |
| C. Public + donor UI | `src/app/page.tsx`, `src/app/donate/**`, `src/app/p/**`, `src/app/follow/**`, `src/components/public/**`, `src/components/donate/**` |
| D. Coordinator UI | `src/app/coordinator/**`, `src/components/coordinator/**` |
| E. Images (Codex) | `public/materials/*`, `public/brand/*`, `public/demo/*` |

Shared files (`convex/schema.ts`, `convex/lib/*`, `src/lib/*`, layout, globals.css): append-only; add dict keys under your lane prefix (`landing.*`, `donate.*`, `project.*`, `field.*`, `coord.*`).

## Public API contract (Lane A implements; C/D consume)
- `public.impactTotals()` → per category: `{ category, projectsPublished, itemsRequested, itemsPledged, itemsReceived, itemsUsedVerified, outcomesVerified }`
- `public.listPublishedProjects({ category? })` → allowlisted project cards
- `public.getProject({ projectId })` → allowlisted project + needs with ledger + verified timeline (milestones) + publicApproved photo URLs
- `public.donorDeck({ category?, itemKey? })` → material need cards: `{ needId, projectId, publicAlias, category, itemKey, nameEs, nameEn, unit, ledger, summaryEs, summaryEn, verified: boolean, photoUrl? }`
- `pledges.create({ needId, qty, mode, donorName, donorContact })` → `{ pledgeId, followToken }` — transactional over-pledge check, no auth required
- `pledges.cancel({ followToken })`, `public.followPledge({ followToken })`
- `coordinator.*` (role: coordinator): `inbox`, `getProjectForReview` (incl. private), `updateNeed`, `approveAndPublish({ projectId, publicAlias, titleEs/En, summaryEs/En })`, `pause`, `recordMaterialEvent({ needId, pledgeId?, eventType, qty, noteEs, noteEn })`, `listPledges`, `approvePhoto`, `addMilestone`
- `field.*` (role: field_worker): see Lane B

## Material itemKeys (for icons in `public/materials/<itemKey>.png`)
`bricks, cement_bag, zinc_sheet, wood_beam, nails, tarp, paint, rebar, seeds, soil, water_tank, tools`
