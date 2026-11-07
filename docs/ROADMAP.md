# Impacto — What's left to build (review of 2026-11-07, commit ac10ef6)

Status today: the full P0 demo slice works end to end on synthetic data (field intake → AI draft → coordinator publish → swipe pledge → received/delivered/used/verified → public timeline, weekly report). It is **not** safe for real beneficiaries or real donors yet. Items are ordered by priority within each tier.

Legend: **[S]** ≤ 2h · **[M]** half day · **[L]** 1–3 days

---

## Tier 0 — Before the demo (hours)

1. **Image assets** [S] — `public/materials/*`, `public/brand/*`, app icons are missing (404s; emoji fallbacks render). Needs an OpenAI key, ChatGPT image gen enabled in Codex, or hand-drawn SVGs. Also fill `manifest.webmanifest` `icons` (currently `[]`).
2. **Real AI in the field flow** [S] — `npx convex env set OPENAI_API_KEY …`. Without it, only the deterministic local extractor runs (good for the scripted sentence, weak for anything else). Test one real Spanish and one English voice note.
3. **Production Convex deployment** [S] — Vercel prod currently points at the **dev** deployment (`precise-camel-918`). Create a prod deployment + deploy key, set `CONVEX_DEPLOY_KEY` on Vercel, build command `npx convex deploy --cmd 'next build'`, seed prod demo data. Also add `NEXT_PUBLIC_CONVEX_URL` for Preview/Development envs (only Production is set).
4. **Demo reset button** [S] — coordinator-only "Reset demo" that calls `seed:resetDemo`, so rehearsals don't need the CLI.
5. **Copy polish** [S] — Spanish gender agreement ("10 bolsas de cemento verificados" → neutral wording); plural handling ("1 resultados verificados"); replace browser `confirm()` on pledge cancel with an accessible dialog.
6. **Rehearse on a phone** [S] — mic permissions on iOS Safari, swipe gestures, camera capture, the venue Wi-Fi DNS issue (`*.vercel.app` fails on this network — use cellular or a custom domain).

## Tier 1 — Required before any real use (security & privacy)

7. **Real authentication** [L] — today `sessions.signInAsDemo` lets *anyone* become a coordinator or field worker. Replace with Convex Auth or Clerk (Vercel Marketplace): email/OTP login, nonprofit-scoped invites, role assignment by an org admin, session expiry/refresh, sign-out everywhere. Keep demo personas behind a `DEMO_MODE` env flag only.
8. **Private file access** [M] — `ctx.storage.getUrl()` returns bearer URLs that anyone holding them can open. Field photos, voice audio, evidence originals and receipts are private but get exposed this way to coordinator clients (and any log/screenshot). Serve private files through an authenticated Convex HTTP action (`convex/http.ts`, does not exist yet) that checks the session + role per request.
9. **Encrypt sensitive fields at rest** [M] — `projectPrivate` (name, address, contact, notes) and `pledges.donorContact` are plaintext. App-level encryption (AES-GCM, key in Convex env / KMS) in a `"use node"` action layer, decrypt only for authorized roles.
10. **Beneficiary consent** [M] — no consent record exists. Add consent capture (who, when, what was explained, language, verbal/written) before private details or photos of a household are saved; ability to withdraw consent → delete private data.
11. **Voice audio goes to OpenAI unredacted** [M] — regex redaction only applies to the transcript *after* transcription; the raw audio (which may contain names/addresses) is sent as-is. Options: on-device/browser STT, a zero-retention provider agreement, or an explicit per-recording "OK to send to AI" toggle with a warning. Document data-processing terms.
12. **Real redaction for public images** [L] — evidence approval currently publishes the *original* file (`usePrivateAsPublic: true`) after a checklist. Build a redaction step: blur/crop tool in the browser that produces a separate `publicStorageId`; face-detection hint optional.
13. **Abuse protection on public mutations** [M] — `pledges.create` is unauthenticated with no throttling. Add `@convex-dev/rate-limiter` (per IP/contact), Vercel BotID on the pledge sheet, contact-format validation, and coordinator tools to void spam pledges.
14. **Data retention & deletion** [M] — policies + jobs: delete raw audio after transcript approval, purge private data N days after project completion, donor contact after pledge closes; "delete this household" admin action; export-my-data for donors.
15. **Audit log viewer** [S] — `auditEvents` are written but never shown. Coordinator/admin screen filtered by entity/actor, read-only, exportable.
16. **Authorization test suite** [M] — no tests exist. Add `convex-test` + Vitest: every public query against a private-field denylist, every role × function matrix, over-pledge race, stage ordering (delivered ≤ received …).

## Tier 2 — Functional gaps for a real pilot

### Donors
17. **Donor follow-up without localStorage** [M] — pledges are tracked only via follow tokens in one browser. Email (Resend via Marketplace) or SMS with the follow link; magic-link "my pledges" across devices.
18. **"Request donation instructions" has no content** [M] — the mode exists but the nonprofit never supplies instructions. Add nonprofit-approved drop-off points/hours/contacts (coarse, public-safe) per category, sent with the confirmation.
19. **Notifications** [M] — donor emails on received / delivered / verified; coordinator alerts on new pledges and new field reports; pledge-expiry reminders before the 14-day auto-expire.
20. **Donation certificates & institutional donor reports** [M] — P1 in the update; bilingual PDF per donor/period from verified records only.

### Coordinators
21. **Pledge management** [S] — cancel/void a pledge on the donor's behalf, extend expiry, mark partial receipts more explicitly, record "arrived without pledge" (walk-in materials).
22. **Add/split needs during review** [S] — `coordinator.addNeed` exists but has no UI; also need split/merge of AI line items.
23. **Signed handover workflow** [M] — today a "handover_doc" is just an uploaded file. Add an in-app signature capture (recipient + staff, no names shown publicly) to generate the handover record.
24. **Material catalog** [S] — itemKeys are hard-coded strings; make an editable catalog (names es/en, unit, icon, optional reference price) so new materials don't need code.
25. **Exports** [M] — CSV/PDF of ledger, financials and weekly reports (P1 in update).
26. **Automated weekly report draft** [S] — cron that generates the draft every Monday for coordinator review (generation exists; scheduling doesn't).
27. **Bilingual helper** [S] — "translate" button for coordinator-entered text (pause reasons, milestones, summaries) — pause currently stores only the Spanish reason publicly.

### Field workers
28. **Offline capture** [L] — no service worker; a report started without signal is lost. Queue drafts/photos/audio in IndexedDB and sync when online (don't claim offline support until this exists).
29. **Field progress view** [S] — field workers can't see delivery/verification progress on their projects after publication or add follow-up photos/notes.
30. **Household census & prioritization** [L] — update §2 lists community-led prioritization; nothing models it. Needs nonprofit input before design (AI must not prioritize).

### Public / community
31. **Community feedback** [M] — update §1 promises "feedback opportunities"; not built. Moderated, anonymous comments or "report a concern" per project, with no personal data published.
32. **Configurable outcome metrics** [M] — §6 `impactMetrics` per bucket (m² roofing, houses completed, gardens productive at follow-up, local labor share) with evidence requirements; not modeled.
33. **Small-community aggregation** [S] — suppress or coarsen public numbers when a region has very few projects (re-identification risk).
34. **PWA polish** [S] — icons, install prompt, offline fallback page, image lazy-loading/compression on public pages.

## Tier 3 — Platform & operations

35. **Multi-nonprofit / tenancy** [L] — schema has `nonprofitId`, but there's one seeded org and no org onboarding, settings, branding or admin role.
36. **Error monitoring & analytics** [S] — Sentry (Marketplace) + Vercel Analytics; error boundaries on each route.
37. **CI** [S] — GitHub Actions: typecheck, lint, Convex tests, `next build` on PRs; Vercel preview deploys with a preview Convex deployment.
38. **Accessibility audit** [M] — axe pass + screen-reader run of swipe deck, dialogs, wizard; contrast check in dark mode.
39. ~~**Custom domain**~~ ✅ **h4h.casa** (+ www) attached to the Vercel project; public, follows every production deploy. `*.vercel.app` URLs stay login-protected or blocked on some networks — share h4h.casa.
40. **Backups & environment hygiene** [S] — Convex prod backups, separate demo deployment, secrets inventory.

## Out of scope (explicitly, per brief)
Payments/Stripe, vendor purchasing, WhatsApp intake, maps/geolocation, automatic financial reconciliation, AI approval or prioritization.

## Needs nonprofit confirmation (not code)
- Who may view beneficiary names/addresses; consent wording in Spanish.
- What counts as verified receipt / delivery / use / completed impact; what evidence is required for each.
- Which photos/evidence are safe to publish and who approves.
- Drop-off instructions, approved suppliers, reference prices.
- Program targets (78 families, 31 critical, nine-month program) — confirm before showing anywhere; never mix with actuals.
- Data-retention period and whether raw audio may be sent to an AI provider.
