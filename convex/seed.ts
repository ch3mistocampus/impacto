import { internalAction, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { materialMilestoneText } from "./projects";
import { DEMO_PROOF_JPEG_B64 } from "./lib/demoProofImages";
import { demoReceiptSvg } from "./lib/demoReceipt";
import { draftSummary, type WeeklySnapshot } from "./weekly";
import {
  DEMO_USERS,
  DONORS,
  FEEDBACK,
  MATERIALS,
  PROJECTS,
  type FieldWorkerKey,
  type Flow,
  type Role,
  type SeedNeed,
  type SeedProject,
} from "./seedData";

/**
 * SYNTHETIC demo data only (Espejo de Agua recovery program, Colombia — all fictional). Idempotent:
 *   - demo users are upserted (primary persona per role keeps its id => existing sessions keep working;
 *     extra field workers are matched by email). Sessions are never touched.
 *   - every project that isDemo OR was created by a demo user is wiped with all children
 *     (incl. fieldFollowUps + communityFeedback), plus demo weekly reports / general-fund rows / feedback
 *   - then the dataset in convex/seedData.ts is re-inserted with timelines spread over ~6 weeks.
 * Run: `npx convex run seed:run`  (or `seed:resetDemo` before a rehearsal).
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function fmtAmount(n: number, locale: "es" | "en") {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, locale === "es" ? "." : ",");
}

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

async function wipeProject(ctx: MutationCtx, projectId: Id<"projects">) {
  for (const r of await ctx.db.query("projectPrivate").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(100)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("fieldReports").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(100)) {
    if (r.audioStorageId) {
      try { await ctx.storage.delete(r.audioStorageId); } catch { /* already gone */ }
    }
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("photos").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(200)) {
    try { await ctx.storage.delete(r.storageId); } catch { /* already gone */ }
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("pledges").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(1000)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("evidence").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(500)) {
    for (const sid of new Set([r.privateStorageId, r.publicStorageId])) {
      if (!sid) continue;
      try { await ctx.storage.delete(sid); } catch { /* already gone */ }
    }
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("materialEvents").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(1000)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("materialNeeds").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(500)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("milestones").withIndex("by_project_time", (q) => q.eq("projectId", projectId)).take(1000)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("expenses").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(500)) {
    if (r.receiptStorageId) {
      try { await ctx.storage.delete(r.receiptStorageId); } catch { /* already gone */ }
    }
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("donations").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(500)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("fieldFollowUps").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(500)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db
    .query("communityFeedback")
    .withIndex("by_project_status", (q) => q.eq("projectId", projectId))
    .take(1000)) {
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db
    .query("auditEvents")
    .withIndex("by_entity", (q) => q.eq("entityType", "project").eq("entityId", projectId))
    .take(1000)) {
    await ctx.db.delete(r._id);
  }
  await ctx.db.delete(projectId);
}

// ---------------------------------------------------------------------------
// Weekly snapshot log (simulated timestamps, so past weeks show realistic activity)
// ---------------------------------------------------------------------------

type MatInfo = { itemKey: string; nameEs: string; nameEn: string; unit: string };
type Log = {
  pledges: { t: number; m: MatInfo; qty: number }[];
  events: { t: number; m: MatInfo; type: Doc<"materialEvents">["eventType"]; qty: number }[];
  donations: { t: number; currency: string; status: Doc<"donations">["status"]; amount: number }[];
  expenses: { t: number; currency: string; amount: number }[];
  evidenceApproved: number[];
  milestones: { t: number; type: Doc<"milestones">["type"]; verified: boolean }[];
  published: number[];
};

function snapshotFromLog(log: Log, start: number, end: number): WeeklySnapshot {
  const inR = (t: number) => t >= start && t < end;
  const mats = new Map<string, WeeklySnapshot["materials"][number]>();
  const mat = (m: MatInfo) => {
    let r = mats.get(m.itemKey);
    if (!r) mats.set(m.itemKey, (r = { ...m, pledged: 0, received: 0, delivered: 0, used: 0, verified: 0 }));
    return r;
  };
  let pledgesCreated = 0;
  for (const p of log.pledges) if (inR(p.t)) { pledgesCreated++; mat(p.m).pledged += p.qty; }
  for (const e of log.events) {
    if (!inR(e.t)) continue;
    if (e.type === "returned") mat(e.m).received -= e.qty;
    else mat(e.m)[e.type] += e.qty;
  }
  const fins = new Map<string, WeeklySnapshot["financials"][number]>();
  const fin = (c: string) => {
    let f = fins.get(c);
    if (!f) fins.set(c, (f = { currency: c, committed: 0, received: 0, allocated: 0, spent: 0 }));
    return f;
  };
  for (const d of log.donations) {
    if (!inR(d.t)) continue;
    if (d.status === "committed") fin(d.currency).committed += d.amount;
    else fin(d.currency).received += d.amount;
    if (d.status === "allocated") fin(d.currency).allocated += d.amount;
  }
  for (const e of log.expenses) if (inR(e.t)) fin(e.currency).spent += e.amount;
  let milestonesVerified = 0;
  let projectsPaused = 0;
  for (const m of log.milestones) {
    if (!inR(m.t) || !m.verified) continue;
    if (m.type === "verified" || m.type === "outcome") milestonesVerified++;
    if (m.type === "paused") projectsPaused++;
  }
  return {
    pledgesCreated,
    materials: [...mats.values()].sort((a, b) => a.itemKey.localeCompare(b.itemKey)),
    financials: [...fins.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    milestonesVerified,
    evidenceApproved: log.evidenceApproved.filter(inR).length,
    projectsPublished: log.published.filter(inR).length,
    projectsPaused,
  };
}

// ---------------------------------------------------------------------------
// Validation (fail loudly if the hand-written dataset breaks ledger rules)
// ---------------------------------------------------------------------------

function sumFlows(n: SeedNeed) {
  const flows: Flow[] = [...(n.pledges ?? []), ...(n.direct ? [n.direct] : [])];
  const s = { rec: 0, del: 0, used: 0, ver: 0 };
  for (const f of flows) {
    const rec = f.rec ?? 0, del = f.del ?? 0, used = f.used ?? 0, ver = f.ver ?? 0;
    if (del > rec || used > del || ver > used) throw new Error(`seed: stage order broken on ${n.itemKey}`);
    s.rec += rec; s.del += del; s.used += used; s.ver += ver;
  }
  return s;
}

function pledgeStatus(p: NonNullable<SeedNeed["pledges"]>[number]): Doc<"pledges">["status"] {
  if (p.status) return p.status;
  return (p.rec ?? 0) >= p.qty ? "fulfilled" : "active";
}

function validate(sp: SeedProject) {
  for (const n of sp.needs) {
    if (!sp.transcript.includes(n.quote)) throw new Error(`seed: quote not in transcript (${sp.key}): ${n.quote}`);
    const s = sumFlows(n);
    if (n.qty === undefined) {
      if (s.rec || n.pledges?.length) throw new Error(`seed: unconfirmed need with activity (${sp.key})`);
      continue;
    }
    const active = (n.pledges ?? []).filter((p) => pledgeStatus(p) === "active");
    if (active.some((p) => p.rec)) throw new Error(`seed: active pledge with receipts (${sp.key})`);
    const activeQty = active.reduce((a, p) => a + p.qty, 0);
    if (activeQty + s.rec > n.qty) throw new Error(`seed: over-pledged ${n.itemKey} (${sp.key})`);
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/**
 * Shared reset logic: used by the CLI (`seed:run`, `seed:resetDemo`) and by the coordinator
 * "Reset demo" button (`demo:resetDemoFromUI`, gated by DEMO_MODE). Sessions are never touched,
 * and demo users keep their ids, so signed-in demo sessions survive a reset.
 */
export async function seedAll(ctx: MutationCtx) {
  const now = Date.now();
  for (const sp of PROJECTS) validate(sp);

  // Nonprofit (upsert)
  let nonprofit = await ctx.db.query("nonprofits").withIndex("by_slug", (q) => q.eq("slug", "espejo-de-agua")).unique();
  const nonprofitId = nonprofit?._id ?? (await ctx.db.insert("nonprofits", { name: "Espejo de Agua", slug: "espejo-de-agua" }));
  nonprofit = await ctx.db.get(nonprofitId);

  // Demo users. The first entry per role is the signable primary (sessions.signInAsDemo uses
  // by_role .first(), i.e. the oldest row) — it keeps its id; extras are matched by email.
  const primaryKey = new Map<Role, string>();
  for (const u of DEMO_USERS) if (!primaryKey.has(u.role)) primaryKey.set(u.role, u.key);
  const extraEmails = new Set(DEMO_USERS.filter((u) => primaryKey.get(u.role) !== u.key).map((u) => u.email));
  const users = {} as Record<string, Id<"users">>;
  for (const u of DEMO_USERS) {
    const candidates = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", u.role)).take(50)).filter(
      (x) => x.isDemo,
    );
    const isPrimary = primaryKey.get(u.role) === u.key;
    const existing =
      candidates.find((x) => x.email === u.email) ??
      (isPrimary ? candidates.find((x) => !x.email || !extraEmails.has(x.email)) : undefined);
    const fields = {
      name: u.name,
      role: u.role,
      locale: "es" as const,
      nonprofitId: u.withNonprofit ? nonprofitId : undefined,
      email: u.email,
      isDemo: true,
    };
    if (existing) {
      await ctx.db.replace("users", existing._id, fields);
      users[u.key] = existing._id;
    } else {
      users[u.key] = await ctx.db.insert("users", fields);
    }
  }
  const demoUserIds = new Set<Id<"users">>(Object.values(users));
  const coordinator = users.ana;
  const donorUser = users.luis;
  const fw = (k: FieldWorkerKey) => users[k];

  // Wipe demo projects (isDemo, or created by a demo persona during rehearsals)
  let wiped = 0;
  for (const status of ["draft", "in_review", "published", "paused", "completed", "rejected"] as const) {
    const rows = await ctx.db.query("projects").withIndex("by_status", (q) => q.eq("status", status)).take(500);
    for (const p of rows) {
      if (p.isDemo || demoUserIds.has(p.createdBy)) {
        await wipeProject(ctx, p._id);
        wiped++;
      }
    }
  }
  // Demo weekly reports, general-fund contributions and general (no-project) feedback.
  for (const r of await ctx.db.query("weeklyReports").take(1000)) {
    if (r.isDemo || (r.generatedBy && demoUserIds.has(r.generatedBy))) await ctx.db.delete(r._id);
  }
  for (const d of await ctx.db.query("donations").withIndex("by_project", (q) => q.eq("projectId", undefined)).take(1000)) {
    if (demoUserIds.has(d.recordedBy)) await ctx.db.delete(d._id);
  }
  for (const status of ["pending", "approved", "hidden"] as const) {
    for (const f of await ctx.db.query("communityFeedback").withIndex("by_status", (q) => q.eq("status", status)).take(1000)) {
      if (f.isDemo || (f.authorUserId && demoUserIds.has(f.authorUserId))) await ctx.db.delete(f._id);
    }
  }

  const log: Log = { pledges: [], events: [], donations: [], expenses: [], evidenceApproved: [], milestones: [], published: [] };
  /** Mock proof files to store after the mutation (storage writes need an action). */
  const proofs: ProofJob[] = [];
  const projectIds: Record<string, { id: Id<"projects">; category: Doc<"projects">["category"] }> = {};
  let donorN = 0;
  let pledgeCount = 0;

  // Insert oldest first so _creationTime order (used by field/coordinator lists) matches the story.
  const ageDays = (sp: SeedProject) =>
    sp.status === "published" || sp.status === "paused" || sp.status === "completed" ? sp.daysAgo + 2 : sp.daysAgo;
  const ordered = [...PROJECTS].sort((a, b) => ageDays(b) - ageDays(a));

  for (const sp of ordered) {
    const createdBy = fw(sp.by);
    const isPublic = sp.status === "published" || sp.status === "paused" || sp.status === "completed";
    const publishedAt = isPublic ? now - sp.daysAgo * DAY : undefined;
    const createdAt = isPublic ? publishedAt! - 2 * DAY : now - sp.daysAgo * DAY - (sp.daysAgo === 0 ? HOUR : 0);
    const approvedAt = isPublic ? publishedAt! - 2 * HOUR : undefined;
    if (publishedAt) log.published.push(publishedAt);

    const projectId = await ctx.db.insert("projects", {
      publicAlias: sp.alias,
      category: sp.category,
      titleEs: sp.title.es,
      titleEn: sp.title.en,
      summaryEs: sp.summary.es,
      summaryEn: sp.summary.en,
      urgency: sp.urgency,
      status: sp.status,
      nonprofitId,
      region: sp.region,
      createdBy,
      approvedBy: isPublic ? coordinator : undefined,
      approvedAt,
      publishedAt,
      safetyPauseReasonPublic: sp.status === "paused" ? sp.pause?.es : undefined,
      isDemo: true,
      seededAt: createdAt,
    });
    projectIds[sp.key] = { id: projectId, category: sp.category };
    await ctx.db.insert("projectPrivate", { projectId, ...sp.private });

    // Field report, same shape as convex/ai.ts Extraction / field.extractionValidator.
    const missingQuestions = sp.missingQuestions ?? [];
    const draftExtraction = {
      source: "fallback" as const,
      notice: "Extracción sintética de demostración / Synthetic demo extraction",
      redactions: 0,
      titleEs: sp.title.es,
      titleEn: sp.title.en,
      category: sp.category,
      summaryEs: sp.summary.es,
      summaryEn: sp.summary.en,
      urgency: sp.urgency,
      damageDescriptionEs: sp.damage.es,
      damageDescriptionEn: sp.damage.en,
      materials: sp.needs.map((n) => ({
        itemKey: n.itemKey,
        nameEs: n.nameEs ?? MATERIALS[n.itemKey].es,
        nameEn: n.nameEn ?? MATERIALS[n.itemKey].en,
        quantity: n.qty ?? null,
        unit: n.unit ?? MATERIALS[n.itemKey].unit,
        confidence: (n.qty === undefined ? "low" : n.approximate ? "medium" : "high") as "low" | "medium" | "high",
        approximate: !!n.approximate,
        sourceQuote: n.quote,
      })),
      missingQuestions,
      proposedMilestones: sp.proposedMilestones,
      transcriptTranslated: sp.translated,
    };
    const reviewStatus: Doc<"fieldReports">["reviewStatus"] =
      sp.reviewStatus ?? (isPublic ? "approved" : sp.status === "draft" ? "draft" : "submitted");
    const reportId = await ctx.db.insert("fieldReports", {
      projectId,
      transcriptOriginal: sp.transcript,
      language: sp.language,
      transcriptTranslated: sp.translated,
      draftExtraction,
      aiStatus: "done",
      missingQuestions: [
        ...missingQuestions.map((q) => `${q.es} / ${q.en}`),
        ...(sp.coordinatorNote ? [sp.coordinatorNote] : []),
      ],
      reviewStatus,
      createdBy,
    });
    if (sp.photoSuggestion) {
      // Storage writes need an action; attach a synthetic private photo + AI suggestion right after.
      await ctx.scheduler.runAfter(0, internal.seed.attachDemoPhoto, { projectId, reportId });
    }

    const ms = async (
      type: Doc<"milestones">["type"],
      text: { es: string; en: string },
      at: number,
      verified = true,
      evidenceId?: Id<"evidence">,
      expenseId?: Id<"expenses">,
    ) => {
      log.milestones.push({ t: at, type, verified });
      await ctx.db.insert("milestones", {
        evidenceId,
        expenseId,
        projectId,
        type,
        status: verified ? "verified" : "pending",
        verifiedBy: verified ? coordinator : undefined,
        occurredAt: at,
        publicDescriptionEs: text.es,
        publicDescriptionEn: text.en,
      });
    };
    await ms("need_reported", { es: "Necesidad reportada por el equipo de campo", en: "Need reported by the field team" }, createdAt, isPublic);
    if (isPublic) {
      await ms("approved", { es: "Necesidades revisadas y aprobadas por Espejo de Agua", en: "Needs reviewed and approved by Espejo de Agua" }, approvedAt!);
      await ms("published", { es: `Proyecto publicado como «${sp.alias}»`, en: `Project published as “${sp.alias}”` }, publishedAt!);
    }

    // Actions that happen after publication, ordered by stage then spread evenly in time.
    type Act = { rank: number; run: (t: number) => Promise<void> };
    const acts: Act[] = [];

    for (const n of sp.needs) {
      const base = MATERIALS[n.itemKey];
      const m: MatInfo = { itemKey: n.itemKey, nameEs: n.nameEs ?? base.es, nameEn: n.nameEn ?? base.en, unit: n.unit ?? base.unit };
      const totals = sumFlows(n);
      const status: Doc<"materialNeeds">["status"] =
        n.status ??
        (!isPublic
          ? sp.status === "rejected" ? "rejected" : "draft"
          : n.qty !== undefined && totals.ver >= n.qty ? "fulfilled" : "approved");
      const needId = await ctx.db.insert("materialNeeds", {
        projectId,
        itemKey: n.itemKey,
        nameEs: m.nameEs,
        nameEn: m.nameEn,
        requestedQty: n.qty,
        unit: m.unit,
        needsConfirmation: n.qty === undefined,
        aiSuggested: !isPublic || n.qty === undefined,
        status,
        verifiedBy: status === "approved" || status === "fulfilled" ? coordinator : undefined,
      });
      if (!isPublic) continue;
      const needDoc = { nameEs: m.nameEs, nameEn: m.nameEn };
      const firstDone = { receipt: false, handover: false, usedNote: false };

      const evidence = async (
        kind: "receipt" | "handover" | "usedNote",
        eventId: Id<"materialEvents">,
        qty: number,
        t: number,
      ): Promise<{ id: Id<"evidence">; approved: boolean } | undefined> => {
        const st = n[kind];
        if (!st || firstDone[kind]) return undefined;
        firstDone[kind] = true;
        const approved = st === "approved";
        const reviewedAt = Math.min(now - HOUR, t + 3 * HOUR);
        if (approved) log.evidenceApproved.push(reviewedAt);
        const unitEs = `${qty} ${m.nameEs.toLowerCase()}`;
        const unitEn = `${qty} ${m.nameEn.toLowerCase()}`;
        const notes = {
          receipt: {
            type: "receipt" as const,
            es: `Factura de compra (sintética, datos de demostración): ${unitEs}, proveedor en ${sp.region}.`,
            en: `Purchase receipt (synthetic, demo data): ${unitEn}, supplier in ${sp.region}.`,
          },
          handover: {
            type: "handover_doc" as const,
            es: `Acta de entrega firmada (sintética, sin nombres): ${unitEs} entregados al proyecto.`,
            en: `Signed handover record (synthetic, no names): ${unitEn} delivered to the project.`,
          },
          usedNote: {
            type: "staff_note" as const,
            es: `Nota de campo (sintética): ${unitEs} instalados en obra; pendiente de verificación.`,
            en: `Field note (synthetic): ${unitEn} installed on site; pending verification.`,
          },
        }[kind];
        const id = await ctx.db.insert("evidence", {
          projectId,
          needId,
          materialEventId: eventId,
          type: notes.type,
          noteEs: notes.es,
          noteEn: notes.en,
          reviewStatus: approved ? "approved" : "pending",
          publicApproved: approved,
          uploadedBy: kind === "receipt" ? coordinator : createdBy,
          reviewedBy: approved ? coordinator : undefined,
          reviewedAt: approved ? reviewedAt : undefined,
        });
        await ctx.db.patch("materialEvents", eventId, { evidenceId: id });
        if (kind === "receipt") {
          proofs.push({
            evidenceId: id,
            approved,
            file: {
              kind: "receipt",
              supplier: "Ferretería Ejemplo (ficticia)",
              region: sp.region,
              number: `DEMO-${String(proofs.length + 1).padStart(4, "0")}`,
              t,
              lines: [{ label: m.nameEs, qty }],
            },
          });
        } else if (kind === "handover" && DEMO_PROOF_JPEG_B64[n.itemKey]) {
          proofs.push({ evidenceId: id, approved, file: { kind: "photo", itemKey: n.itemKey } });
        }
        return { id, approved };
      };

      /** Approved field photo for custody events that have no other evidence (mock proof). */
      const photoEvidence = async (
        type: "received" | "delivered",
        eventId: Id<"materialEvents">,
        qty: number,
        t: number,
      ): Promise<Id<"evidence"> | undefined> => {
        if (!DEMO_PROOF_JPEG_B64[n.itemKey]) return undefined;
        const txt = materialMilestoneText(type, qty, needDoc);
        const reviewedAt = Math.min(now - HOUR, t + 2 * HOUR);
        log.evidenceApproved.push(reviewedAt);
        const id = await ctx.db.insert("evidence", {
          projectId,
          needId,
          materialEventId: eventId,
          type: "delivery_photo",
          noteEs: `Foto del equipo de campo (sintética): ${txt.es.charAt(0).toLowerCase()}${txt.es.slice(1)}`,
          noteEn: `Field team photo (synthetic): ${txt.en.charAt(0).toLowerCase()}${txt.en.slice(1)}`,
          reviewStatus: "approved",
          publicApproved: true,
          uploadedBy: createdBy,
          reviewedBy: coordinator,
          reviewedAt,
        });
        await ctx.db.patch("materialEvents", eventId, { evidenceId: id });
        proofs.push({ evidenceId: id, approved: true, file: { kind: "photo", itemKey: n.itemKey } });
        return id;
      };

      const event = async (
        type: "received" | "delivered" | "used" | "verified",
        qty: number,
        t: number,
        pledgeId?: Id<"pledges">,
        donorNote?: string,
      ) => {
        log.events.push({ t, m, type, qty });
        const txt = materialMilestoneText(type, qty, needDoc);
        let eventId: Id<"materialEvents">;
        let evId: Id<"evidence"> | undefined;
        if (type === "verified") {
          const reviewedAt = Math.min(now - HOUR, t + HOUR);
          log.evidenceApproved.push(reviewedAt);
          evId = await ctx.db.insert("evidence", {
            projectId,
            needId,
            type: "staff_note",
            noteEs: `Nota de personal (sintética, datos de demostración): se verificó en sitio el uso de ${qty} ${m.nameEs.toLowerCase()}.`,
            noteEn: `Staff note (synthetic, demo data): on-site check confirmed use of ${qty} ${m.nameEn.toLowerCase()}.`,
            reviewStatus: "approved",
            publicApproved: true,
            uploadedBy: coordinator,
            reviewedBy: coordinator,
            reviewedAt,
          });
          eventId = await ctx.db.insert("materialEvents", {
            needId, projectId, pledgeId, eventType: type, qty, verifiedBy: coordinator, evidenceId: evId,
            noteEs: "Verificado en visita de seguimiento (demo)", noteEn: "Verified during a follow-up visit (demo)",
          });
          await ctx.db.patch("evidence", evId, { materialEventId: eventId });
        } else {
          eventId = await ctx.db.insert("materialEvents", {
            needId, projectId, pledgeId, eventType: type, qty, verifiedBy: coordinator,
            noteEs: donorNote ? `${txt.es} (${donorNote})` : txt.es,
            noteEn: donorNote ? `${txt.en} (${donorNote})` : txt.en,
          });
          const kind = type === "received" ? "receipt" : type === "delivered" ? "handover" : "usedNote";
          const created = await evidence(kind, eventId, qty, t);
          evId = created?.approved ? created.id : undefined;
          if (!created && (type === "received" || type === "delivered")) evId = await photoEvidence(type, eventId, qty, t);
        }
        await ms(type, txt, t, true, evId);
      };

      const flowActs = (f: Flow, ref: { id?: Id<"pledges"> }) => {
        if (f.rec) acts.push({ rank: 2, run: (t) => event("received", f.rec!, t, ref.id) });
        if (f.del) acts.push({ rank: 3, run: (t) => event("delivered", f.del!, t, ref.id) });
        if (f.used) acts.push({ rank: 4, run: (t) => event("used", f.used!, t, ref.id) });
        if (f.ver) acts.push({ rank: 5, run: (t) => event("verified", f.ver!, t, ref.id) });
      };

      for (const pl of n.pledges ?? []) {
        const ref: { id?: Id<"pledges"> } = {};
        const st = pledgeStatus(pl);
        const isLuis = pl.by === "luis";
        const donor = isLuis ? { name: "Donante Luis (demo)", contact: "luis.demo@example.org" } : DONORS[pl.by as number];
        const n0 = ++donorN;
        acts.push({
          rank: 1,
          run: async (t) => {
            pledgeCount++;
            log.pledges.push({ t, m, qty: pl.qty });
            ref.id = await ctx.db.insert("pledges", {
              needId,
              projectId,
              donorName: donor.name,
              donorContact: donor.contact,
              qty: pl.qty,
              mode: pl.mode,
              status: st,
              followToken: `demo-follow-${String(n0).padStart(2, "0")}-${crypto.randomUUID().slice(0, 8)}`,
              expiresAt: st === "expired" ? Math.min(t + 7 * DAY, now - HOUR) : now + 10 * DAY,
              donorUserId: isLuis ? donorUser : undefined,
              seededAt: t,
            });
            await ms("pledge", materialMilestoneText("pledge", pl.qty, needDoc), t);
          },
        });
        if (st === "canceled" || st === "expired") {
          acts.push({
            rank: 1.5,
            run: async (t) => {
              await ms("pledge", materialMilestoneText(st === "canceled" ? "pledge_canceled" : "pledge_expired", pl.qty, needDoc), t);
            },
          });
        }
        flowActs(pl, ref);
      }
      if (n.direct) flowActs(n.direct, {});
    }

    for (const c of sp.contributions ?? []) {
      acts.push({
        rank: 0.5,
        run: async (t) => {
          log.donations.push({ t, currency: c.currency, status: c.status, amount: c.amount });
          await ctx.db.insert("donations", {
            projectId,
            nonprofitId,
            amount: c.amount,
            currency: c.currency,
            status: c.status,
            donorName: c.donor,
            externalReference: `DEMO-${c.currency}-${String(log.donations.length).padStart(3, "0")}`,
            recordedBy: coordinator,
          });
        },
      });
    }
    for (const e of sp.expenses ?? []) {
      acts.push({
        rank: 2.5,
        run: async (t) => {
          const expenseId = await ctx.db.insert("expenses", {
            projectId,
            amount: e.amount,
            currency: e.currency,
            category: e.category,
            reviewStatus: e.approved ? "approved" : "pending",
            approvedBy: e.approved ? coordinator : undefined,
            approvedAt: e.approved ? t : undefined,
            recordedBy: coordinator,
            supplierRegion: e.supplierRegion,
            localLabor: e.localLabor,
          });
          // Mock receipt photo on file (unless the demo leaves it as a field to-do).
          let receiptEvidenceId: Id<"evidence"> | undefined;
          if (e.approved && !e.noReceipt) {
            const reviewedAt = Math.min(now - HOUR, t + HOUR);
            log.evidenceApproved.push(reviewedAt);
            receiptEvidenceId = await ctx.db.insert("evidence", {
              projectId,
              expenseId,
              type: "receipt",
              noteEs: `Recibo del gasto (sintético): ${fmtAmount(e.amount, "es")} ${e.currency} — ${e.category}`,
              noteEn: `Expense receipt (synthetic): ${fmtAmount(e.amount, "en")} ${e.currency} — ${e.category}`,
              reviewStatus: "approved",
              publicApproved: true,
              uploadedBy: createdBy,
              reviewedBy: coordinator,
              reviewedAt,
            });
            proofs.push({
              evidenceId: receiptEvidenceId,
              approved: true,
              expenseId,
              file: {
                kind: "receipt",
                supplier: e.localLabor ? "Recibo de pago de mano de obra" : "Proveedor Ejemplo (ficticio)",
                region: e.supplierRegion ?? sp.region,
                number: `DEMO-${String(proofs.length + 1).padStart(4, "0")}`,
                t,
                lines: [{ label: e.category, amount: e.amount }],
                total: e.amount,
                currency: e.currency,
              },
            });
          }
          if (e.approved) {
            log.expenses.push({ t, currency: e.currency, amount: e.amount });
            await ms(
              "expense",
              {
                es: `Gasto aprobado: ${fmtAmount(e.amount, "es")} ${e.currency} — ${e.category}`,
                en: `Expense approved: ${fmtAmount(e.amount, "en")} ${e.currency} — ${e.category}`,
              },
              t,
              true,
              receiptEvidenceId,
              expenseId,
            );
          }
        },
      });
    }
    for (const o of sp.outcomes ?? []) acts.push({ rank: 6, run: (t) => ms("outcome", o, t) });
    for (const f of sp.followUps ?? []) {
      acts.push({
        rank: 5.5,
        run: async (t) => {
          await ctx.db.insert("fieldFollowUps", {
            projectId,
            noteEs: f.es,
            noteEn: f.en,
            status: f.status,
            createdBy,
            reviewedBy: f.status === "approved" ? coordinator : undefined,
          });
          // Mirrors coordinator.reviewFollowUp: an approved follow-up becomes a public outcome milestone.
          if (f.status === "approved") await ms("outcome", f, t);
        },
      });
    }

    if (isPublic) {
      acts.sort((a, b) => a.rank - b.rank); // stable: keeps per-need order within a stage
      const start = publishedAt! + 4 * HOUR;
      const end =
        sp.status === "completed" ? now - (sp.endDaysAgo ?? 3) * DAY : sp.status === "paused" ? now - 3 * DAY : now - 2 * HOUR;
      const step = (end - start) / (acts.length + 1);
      for (let i = 0; i < acts.length; i++) await acts[i].run(Math.round(start + (i + 1) * step));
      if (sp.status === "paused" && sp.pause) {
        await ms("paused", { es: `Proyecto en pausa: ${sp.pause.es}`, en: `Project paused: ${sp.pause.en}` }, now - 2 * DAY);
      }
    }
  }

  // Community voice
  for (const f of FEEDBACK) {
    const p = f.project ? projectIds[f.project] : undefined;
    const answered = f.status === "approved" && f.response;
    await ctx.db.insert("communityFeedback", {
      projectId: p?.id,
      category: p?.category,
      kind: f.kind,
      message: f.message,
      language: f.language,
      status: f.status,
      contactPrivate: f.contactPrivate,
      responseEs: answered ? f.response!.es : undefined,
      responseEn: answered ? f.response!.en : undefined,
      respondedBy: answered ? coordinator : undefined,
      respondedAt: answered ? now - f.daysAgo * DAY + 6 * HOUR : undefined,
      authorUserId: f.byRosa ? users.rosa : undefined,
      isDemo: true,
      seededAt: now - f.daysAgo * DAY,
    });
  }

  // Weekly reports: 3 published (the 3 full weeks before this one) + 1 draft (current week).
  // Snapshots use the same aggregation as weekly.computeWeeklySnapshot, applied to the seeded
  // records at their simulated timeline dates (demo rows are all inserted "now").
  const weekEnd = now + 1;
  for (let w = 3; w >= 0; w--) {
    const periodEnd = weekEnd - w * 7 * DAY;
    const periodStart = periodEnd - 7 * DAY;
    const snapshot = snapshotFromLog(log, periodStart, periodEnd);
    const text = draftSummary(snapshot);
    const published = w > 0;
    await ctx.db.insert("weeklyReports", {
      nonprofitId,
      periodStart,
      periodEnd,
      snapshot,
      summaryEs: text.es,
      summaryEn: text.en,
      status: published ? "published" : "draft",
      generatedBy: coordinator,
      reviewedBy: published ? coordinator : undefined,
      publishedAt: published ? Math.min(now - HOUR, periodEnd + DAY) : undefined,
      isDemo: true,
    });
  }

  if (proofs.length > 0) await ctx.scheduler.runAfter(0, internal.seed.attachDemoProofs, { jobs: proofs });

  return {
    nonprofit: nonprofit?.name ?? "Espejo de Agua",
    wipedProjects: wiped,
    projects: PROJECTS.length,
    users: DEMO_USERS.length,
    pledges: pledgeCount,
  };
}

export const seedReturns = v.object({
  nonprofit: v.string(),
  wipedProjects: v.number(),
  projects: v.number(),
  users: v.number(),
  pledges: v.optional(v.number()),
});

export const run = internalMutation({
  args: {},
  returns: seedReturns,
  handler: async (ctx) => await seedAll(ctx),
});

/** Same as `run` — reset for demo rehearsal. */
export const resetDemo = internalMutation({
  args: {},
  returns: seedReturns,
  handler: async (ctx) => await seedAll(ctx),
});

// ---------------------------------------------------------------------------
// Synthetic private photo + photoSuggestions example (storage needs an action)
// ---------------------------------------------------------------------------

/** 48×32 synthetic PNG (sky / roof-line / brick pattern). No people, no places. */
const DEMO_PHOTO_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAIAAADbtmxLAAAAUklEQVR42mPYcOTaoEIMow4addCog0YdNOqgUQeR6KBpgwyMOmjoOehIRQAa2pLhhIboqWbUQUPPQQNrPaaaUQcNPQeN5rJRB42WQ6MOGmAHAQDWcdeXxuoemgAAAABJRU5ErkJggg==";

export const attachDemoPhoto = internalAction({
  args: { projectId: v.id("projects"), reportId: v.id("fieldReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bin = atob(DEMO_PHOTO_PNG_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const storageId = await ctx.storage.store(new Blob([bytes], { type: "image/png" }));
    const ok = await ctx.runMutation(internal.seed.insertDemoPhoto, { ...args, storageId });
    if (!ok) await ctx.storage.delete(storageId); // project was wiped by a newer reset
    return null;
  },
});

export const insertDemoPhoto = internalMutation({
  args: { projectId: v.id("projects"), reportId: v.id("fieldReports"), storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    const report = await ctx.db.get(args.reportId);
    if (!project || !report) return false;
    const photoId = await ctx.db.insert("photos", {
      projectId: args.projectId,
      storageId: args.storageId,
      visibility: "private",
      reviewStatus: "pending",
      captionEs: "Techo con tejas levantadas (imagen sintética de demostración)",
      captionEn: "Roof with lifted sheets (synthetic demo image)",
      uploadedBy: project.createdBy,
    });
    const suggestion = {
      photoId,
      model: "demo-sintetico",
      createdAt: Date.now(),
      privacyConcern: false,
      observationsEs: [
        "Se ven tejas de zinc dobladas y desprendidas en la parte trasera del techo.",
        "No se ven personas, nombres ni números de casa en la foto.",
      ],
      observationsEn: [
        "Bent and detached zinc sheets are visible on the back of the roof.",
        "No people, names or house numbers are visible in the photo.",
      ],
      observationsStatus: "pending" as const,
      materials: [
        {
          itemKey: "zinc_sheet", nameEs: "Tejas de zinc", nameEn: "Zinc roofing sheets", quantity: 15, unit: "tejas",
          confidence: "medium" as const,
          reasonEs: "Se cuentan unas 15 tejas dañadas en la imagen.", reasonEn: "About 15 damaged sheets can be counted in the image.",
          status: "pending" as const,
        },
        {
          itemKey: "tarp", nameEs: "Lonas impermeables", nameEn: "Waterproof tarps", quantity: 2, unit: "unidades",
          confidence: "low" as const,
          reasonEs: "Cubrir provisionalmente mientras llegan las tejas.", reasonEn: "Temporary cover until the sheets arrive.",
          status: "pending" as const,
        },
      ],
    };
    const ex = (report.draftExtraction ?? {}) as Record<string, unknown>;
    await ctx.db.patch("fieldReports", report._id, { draftExtraction: { ...ex, photoSuggestions: [suggestion] } });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Mock proof files (synthetic material photos + receipts) for seeded evidence
// ---------------------------------------------------------------------------

const proofFile = v.union(
  v.object({ kind: v.literal("photo"), itemKey: v.string() }),
  v.object({
    kind: v.literal("receipt"),
    supplier: v.string(),
    region: v.optional(v.string()),
    number: v.string(),
    t: v.number(),
    lines: v.array(v.object({ label: v.string(), qty: v.optional(v.number()), amount: v.optional(v.number()) })),
    total: v.optional(v.number()),
    currency: v.optional(v.string()),
  }),
);
const proofJob = v.object({
  evidenceId: v.id("evidence"),
  approved: v.boolean(),
  expenseId: v.optional(v.id("expenses")),
  file: proofFile,
});
type ProofJob = typeof proofJob.type;

export const attachDemoProofs = internalAction({
  args: { jobs: v.array(proofJob) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const job of args.jobs) {
      let storageId: Id<"_storage">;
      if (job.file.kind === "photo") {
        const b64 = DEMO_PROOF_JPEG_B64[job.file.itemKey];
        if (!b64) continue;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        storageId = await ctx.storage.store(new Blob([bytes], { type: "image/jpeg" }));
      } else {
        const f = job.file;
        const d = new Date(f.t);
        const svg = demoReceiptSvg({
          supplier: f.supplier,
          region: f.region,
          number: f.number,
          dateLabel: `Fecha: ${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`,
          lines: f.lines,
          total: f.total,
          currency: f.currency,
        });
        storageId = await ctx.storage.store(new Blob([svg], { type: "image/svg+xml" }));
      }
      const ok = await ctx.runMutation(internal.seed.setDemoProof, {
        evidenceId: job.evidenceId,
        approved: job.approved,
        expenseId: job.expenseId,
        storageId,
      });
      if (!ok) await ctx.storage.delete(storageId); // wiped by a newer reset
    }
    return null;
  },
});

export const setDemoProof = internalMutation({
  args: {
    evidenceId: v.id("evidence"),
    approved: v.boolean(),
    expenseId: v.optional(v.id("expenses")),
    storageId: v.id("_storage"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.evidenceId);
    if (!ev) return false;
    await ctx.db.patch("evidence", ev._id, {
      privateStorageId: args.storageId,
      publicStorageId: args.approved ? args.storageId : undefined,
    });
    if (args.expenseId) {
      const ex = await ctx.db.get(args.expenseId);
      if (ex) await ctx.db.patch("expenses", ex._id, { receiptStorageId: args.storageId });
    }
    return true;
  },
});
