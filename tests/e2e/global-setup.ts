import { resetAndCheck } from "./convex";

/** Reset twice in a row (idempotence) and check persona ids stay stable. */
export default async function globalSetup() {
  const a = resetAndCheck("global setup #1");
  const b = resetAndCheck("global setup #2");
  if (JSON.stringify(a.personaIds) !== JSON.stringify(b.personaIds)) {
    throw new Error(`[e2e] persona ids changed across resets: ${JSON.stringify(a.personaIds)} -> ${JSON.stringify(b.personaIds)}`);
  }
  process.env.E2E_PERSONA_IDS = JSON.stringify(a.personaIds);
}
