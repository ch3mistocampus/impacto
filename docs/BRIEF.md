# Impacto — Bilingual Recovery Transparency & Swipe-to-Donate

## Mission
A standalone, Spanish-first and English-accessible platform for Espejo de Agua and partners. Turn field observations into verified recovery projects, connect donors to tangible material needs, and show communities how donations translate into outcomes. Demo data must be clearly labeled. This is a hackathon prototype, not a live aid-distribution system.

## Core principles
- Four roles: Field worker, Nonprofit coordinator, Donor, Community viewer.
- Three categories: Roof and Shelter; Reconstruction; Heal and Sow.
- Private beneficiary identity and precise locations may be entered by authorized field workers **only after AI intake**, but are never shown publicly. Encrypt/protect sensitive records, restrict access by role, and do not send names, addresses, or identifiable photos to AI services by default.
- Bilingual Spanish/English throughout: navigation, form labels, AI prompts, transcripts, confirmation, donor cards. Keep original-language transcript; optionally show translation. Human review before publication.
- Separate **requested**, **pledged**, **received**, **used**, and **verified impact**; never conflate a pledge with a delivery or a financial commitment with money received.
- Never fabricate estimates or treat AI-generated material quantities as verified; require field review and nonprofit approval.

## Stack
- Next.js App Router + React + TypeScript + Tailwind CSS, mobile-first responsive web/PWA.
- Convex: database, reactive queries, mutations, actions, file storage, server-side authorization.
- Vercel hosting.
- Speech-to-text and structured extraction via a server-side AI API in a Convex action. For hackathon reliability, include a text-input fallback and prerecorded demo transcript. No secrets in client.
- Railway only if a real backend job cannot be handled by Convex actions; not required for MVP.

## Primary user journeys
### 1. Field worker: voice-to-project
1. Choose Español / English; tap **Nuevo proyecto / New project**.
2. Record a voice description or type it. Attach photos of damage and material needs.
3. AI transcribes and drafts title, category, situation, needs, materials (item, quantity, unit), urgency, and missing questions. AI must label uncertainty and preserve source transcript.
4. Worker reviews and corrects every field; unknown quantities remain blank and marked **needs confirmation**.
5. In a separate restricted section, worker enters beneficiary names, contact information, and precise location (optional). Private data is NOT included in public project data, AI requests, or donor-facing photos.
6. Save draft; submit to nonprofit review.

### 2. Nonprofit coordinator: verify and publish
1. Review incoming drafts and evidence; edit quantities, approve eligible material needs and publication-safe images.
2. Approve a project and choose a public alias (e.g. 'Roof repair project 014') without household names or exact locations.
3. Track each material's requested/pledged/received/used quantities. Record monetary donations separately with receipts, allocations, and expenses.
4. Confirm material delivery and use; add verified milestone notes and approved, privacy-safe photos.
5. Publish progress to donor and community views; can pause projects for safety or verification concerns.

### 3. Donor: swipe to contribute
1. Browse public material cards by category and optionally material type; no account required for browsing.
2. Each card: material photo/icon, item name, quantity needed, pledged, received, verified used, general project story, and nonprofit verification badge.
3. Swipe left to pass, right to open contribution sheet (also accessible with large buttons for keyboard/screen reader users).
4. Choose quantity (e.g. 50 bricks), then **I have materials**, **I will buy materials**, or **Request donation instructions**. No payments or invented purchase links in MVP.
5. Enter contact info only when pledging; show a confirmation and status **pledged, not delivered**.
6. Nonprofit confirms actual receipt and use; donor can follow an anonymized project timeline.
7. Avoid overpledging: compute available-to-pledge as requested minus active pledges and verified receipts, with transactional Convex mutation checks. Expired/canceled pledges release quantity.

### 4. Community member: transparent progress
- View public, aggregate recovery totals for Roof and Shelter, Reconstruction, Heal and Sow.
- View project timelines with initial need, approved requests, donations, deliveries, spending evidence, and verified outcomes.
- No map pins, exact addresses, names, or raw identifiable photos. Public impact counts only verified outcomes.

## Example demo scenario (synthetic)
- Field worker records in Spanish: 'La casa necesita unos doscientos ladrillos, quince bolsas de cemento y reparación del techo.'
- AI drafts a reconstruction project: 200 bricks, 15 bags of cement, roof materials quantity unknown.
- Worker edits details, adds private beneficiary info, and submits.
- Nonprofit approves public project with an anonymous name and safe photo.
- Donor swipes on 'Bricks' and pledges 50. Dashboard shows **50 pledged; 0 received**.
- Coordinator marks 50 bricks received and later 50 used with evidence; timeline and public dashboard update live.
- Switch between Español and English to show bilingual UI.

## Data model (Convex collections, conceptual)
- users: authId, role, locale, nonprofitId
- projects: publicAlias, category, summaryEs, summaryEn, status, createdBy, approvedBy, publishedAt, safetyPauseReasonPublic
- projectPrivate: projectId, beneficiaryName, privateAddress, contact, privateNotes (strictly role-restricted)
- fieldReports: projectId, transcriptOriginal, language, draftExtraction, reviewStatus, createdBy
- photos: projectId, storageId, visibility (private/publicApproved), reviewStatus, captionEs, captionEn
- materialNeeds: projectId, itemKey, nameEs, nameEn, requestedQty, unit, verifiedBy, status
- pledges: needId, donorId, qty, mode, status, createdAt, expiresAt
- materialEvents: needId, pledgeId?, eventType (received/used/returned), qty, evidenceId?, verifiedBy, timestamp
- donations: projectId?, amount, currency, status, donorId?, externalReference? (do not pretend pledge equals payment)
- expenses: projectId, amount, currency, category, receiptStorageId, reviewStatus, approvedBy
- milestones: projectId, type, status, verifiedBy, occurredAt, publicDescriptionEs, publicDescriptionEn
- auditEvents: actorId, entityType, entityId, action, timestamp, beforeAfterSummary

Use indexes by project, status, category, and role as needed. Enforce role-based authorization in every Convex query/mutation/action, not just in the UI. Keep public query results as explicit allowlists; never return private data and filter on the client.

## Screens
1. Public landing page with three buckets and impact metrics.
2. Swipe donor deck + quantity pledge modal + success state.
3. Field report wizard: audio/text, photo upload, AI draft, review, private beneficiary details.
4. Nonprofit inbox: pending review, publish, donation and delivery verification.
5. Public project detail with need-to-impact timeline and material status.
6. Language toggle and accessible non-swipe actions throughout.

## Hackathon build order
**P0 — working end-to-end demo**
1. Seed synthetic project and needs; basic responsive layout, bilingual UI.
2. Convex schema and public/private authorization boundaries.
3. Field voice/text intake -> AI draft -> human edit -> submit.
4. Nonprofit approval -> public project.
5. Swipe card -> quantity pledge -> Convex live update.
6. Coordinator confirms receipt and use -> verified timeline and public metrics.

**P1 — if time permits**
- Photo upload and nonprofit image approval; safe images only.
- Donation/expense ledger and receipt attachment.
- Donor follow-up status, pledge cancellation/expiration, accessibility polish.

**Out of scope**
- Stripe/payment processing, real vendor purchases, Amazon integration, WhatsApp integration, geolocation/maps, automatic financial reconciliation, AI-only approval, real beneficiary data in demo.

## Three-minute judging demo
0:00–0:25 — Problem: aid needs and donation impact are fragmented; introduce the four users.
0:25–1:10 — Spanish voice note and photo -> AI structures a project -> worker corrects it, private details kept separate.
1:10–1:35 — Nonprofit reviews and publishes anonymous needs.
1:35–2:15 — Donor swipes to pledge 50 bricks, shows **pledged**, not delivered.
2:15–2:45 — Nonprofit confirms 50 received/used; public timeline and impact numbers update live.
2:45–3:00 — Switch to English; emphasize privacy, bilingual access, and accountability.

## Pitch
'Impacto connects what communities need, what donors give, and what actually reaches the ground. A field worker can describe damage in Spanish, AI turns it into a reviewed project, donors can swipe to fund tangible materials, and everyone can see verified progress—without exposing the people being helped.'

## Key questions for the nonprofit
- Who is authorized to view beneficiary names and addresses?
- Which evidence is safe to publish, and who approves it?
- What constitutes verified receipt, use, and completed impact?
- How do they currently source and distribute construction materials?
- Are there public material prices, supplier lists, or donation instructions they approve?
