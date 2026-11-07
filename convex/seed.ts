import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { materialMilestoneText } from "./projects";

/**
 * SYNTHETIC demo data only. Idempotent:
 *   - demo users are upserted by role (stable ids => existing sessions keep working)
 *   - every project that isDemo OR was created by a demo user is wiped with all children
 *   - then the demo projects are re-inserted.
 * Run: `npx convex run seed:run`  (or `seed:resetDemo` before a rehearsal).
 */

const DAY = 24 * 60 * 60 * 1000;
const DEMO_TRANSCRIPT =
  "La casa necesita unos doscientos ladrillos, quince bolsas de cemento y reparación del techo.";

type Role = Doc<"users">["role"];
type Cat = Doc<"projects">["category"];

const MATERIALS: Record<string, { es: string; en: string; unit: string }> = {
  bricks: { es: "Ladrillos", en: "Bricks", unit: "unidades" },
  cement_bag: { es: "Bolsas de cemento", en: "Cement bags", unit: "bolsas" },
  zinc_sheet: { es: "Planchas de zinc", en: "Zinc sheets", unit: "planchas" },
  wood_beam: { es: "Vigas de madera", en: "Wood beams", unit: "vigas" },
  nails: { es: "Cajas de clavos", en: "Boxes of nails", unit: "cajas" },
  tarp: { es: "Lonas", en: "Tarps", unit: "lonas" },
  paint: { es: "Galones de pintura", en: "Gallons of paint", unit: "galones" },
  rebar: { es: "Varillas de acero", en: "Rebar rods", unit: "varillas" },
  seeds: { es: "Paquetes de semillas", en: "Seed packets", unit: "paquetes" },
  soil: { es: "Sacos de tierra", en: "Bags of soil", unit: "sacos" },
  water_tank: { es: "Tanques de agua", en: "Water tanks", unit: "tanques" },
  tools: { es: "Juegos de herramientas", en: "Tool kits", unit: "juegos" },
};

type SeedNeed = {
  itemKey: keyof typeof MATERIALS;
  qty?: number; // undefined => needs confirmation
  status?: Doc<"materialNeeds">["status"];
  aiSuggested?: boolean;
  pledges?: { qty: number; mode: Doc<"pledges">["mode"]; status?: Doc<"pledges">["status"]; received?: number }[];
  receivedDirect?: number; // received outside any pledge
  used?: number;
};

type SeedProject = {
  alias: string;
  category: Cat;
  region: string;
  urgency: Doc<"projects">["urgency"];
  status: Doc<"projects">["status"];
  titleEs: string;
  titleEn: string;
  summaryEs: string;
  summaryEn: string;
  daysAgo: number;
  pauseReason?: string;
  transcript: string;
  private: { beneficiaryName: string; privateAddress: string; contact: string; privateNotes?: string };
  needs: SeedNeed[];
  outcomes?: { es: string; en: string }[];
};

const PROJECTS: SeedProject[] = [
  {
    alias: "Proyecto de techo 014",
    category: "roof_shelter",
    region: "Utuado",
    urgency: "high",
    status: "published",
    titleEs: "Techo nuevo para una familia de cuatro",
    titleEn: "New roof for a family of four",
    summaryEs:
      "Las lluvias dañaron el techo de zinc de una vivienda en la montaña. Con planchas, clavos y lonas temporeras la familia puede volver a dormir seca.",
    summaryEn:
      "Heavy rains damaged the zinc roof of a mountain home. With sheets, nails and temporary tarps the family can sleep dry again.",
    daysAgo: 12,
    transcript: "El techo de zinc se levantó con el viento. Hacen falta como veinticuatro planchas y clavos.",
    private: { beneficiaryName: "Familia Ejemplo A", privateAddress: "Dirección de ejemplo 1 (sintética)", contact: "787-555-0101 (falso)" },
    needs: [
      { itemKey: "zinc_sheet", qty: 24, pledges: [{ qty: 10, mode: "will_buy", status: "fulfilled", received: 10 }, { qty: 6, mode: "have_materials" }], used: 8 },
      { itemKey: "nails", qty: 6, receivedDirect: 6, used: 6 },
      { itemKey: "tarp", qty: 4 },
    ],
  },
  {
    alias: "Reconstrucción 007",
    category: "reconstruction",
    region: "Jayuya",
    urgency: "high",
    status: "published",
    titleEs: "Reconstruir la pared de una casa afectada por deslizamiento",
    titleEn: "Rebuild a wall damaged by a landslide",
    summaryEs:
      "Un deslizamiento de tierra derrumbó la pared trasera de una casa. Se necesitan ladrillos, cemento y varillas para reconstruirla de forma segura.",
    summaryEn:
      "A landslide brought down the back wall of a home. Bricks, cement and rebar are needed to rebuild it safely.",
    daysAgo: 9,
    transcript: "La pared de atrás se cayó con el derrumbe. Necesitamos ladrillos, cemento y varillas.",
    private: { beneficiaryName: "Familia Ejemplo B", privateAddress: "Dirección de ejemplo 2 (sintética)", contact: "787-555-0102 (falso)" },
    needs: [
      { itemKey: "bricks", qty: 300, pledges: [{ qty: 50, mode: "have_materials" }] },
      { itemKey: "cement_bag", qty: 20, receivedDirect: 8, used: 5 },
      { itemKey: "rebar", qty: 12 },
      { itemKey: "wood_beam", qty: undefined, aiSuggested: true }, // needs confirmation
    ],
  },
  {
    alias: "Siembra y sana 003",
    category: "heal_sow",
    region: "Loíza",
    urgency: "medium",
    status: "published",
    titleEs: "Huerto comunitario junto al centro comunal",
    titleEn: "Community garden next to the community center",
    summaryEs:
      "Vecinos están recuperando un solar para sembrar alimentos. Faltan semillas, tierra y herramientas básicas.",
    summaryEn: "Neighbors are reclaiming a lot to grow food. Seeds, soil and basic tools are needed.",
    daysAgo: 20,
    transcript: "Queremos sembrar en el solar del centro comunal. Necesitamos semillas, tierra y herramientas.",
    private: { beneficiaryName: "Grupo Comunitario Ejemplo C", privateAddress: "Solar de ejemplo (sintético)", contact: "demo-c@example.org" },
    needs: [
      { itemKey: "seeds", qty: 40, receivedDirect: 25, used: 25 },
      { itemKey: "soil", qty: 30, pledges: [{ qty: 10, mode: "will_buy" }] },
      { itemKey: "tools", qty: 6, pledges: [{ qty: 3, mode: "have_materials", status: "fulfilled", received: 3 }], used: 3 },
    ],
    outcomes: [{ es: "Primeras 25 hileras sembradas en el huerto comunitario", en: "First 25 rows planted in the community garden" }],
  },
  {
    alias: "Siembra y sana 011",
    category: "heal_sow",
    region: "Ciales",
    urgency: "high",
    status: "published",
    titleEs: "Agua para el huerto de una escuela rural",
    titleEn: "Water for a rural school garden",
    summaryEs: "La escuela perdió su cisterna. Un tanque de agua permitirá regar el huerto escolar durante la sequía.",
    summaryEn: "The school lost its cistern. A water tank will keep the school garden watered through the dry season.",
    daysAgo: 5,
    transcript: "La escuela necesita dos tanques de agua para el huerto.",
    private: { beneficiaryName: "Escuela Ejemplo D", privateAddress: "Dirección de ejemplo 4 (sintética)", contact: "demo-d@example.org" },
    needs: [
      { itemKey: "water_tank", qty: 2 },
      { itemKey: "seeds", qty: 20 },
    ],
  },
  {
    alias: "Proyecto de techo 019",
    category: "roof_shelter",
    region: "Orocovis",
    urgency: "medium",
    status: "paused",
    pauseReason: "Pausado temporalmente mientras un ingeniero verifica la seguridad de la estructura.",
    titleEs: "Reparación de techo y lonas temporeras",
    titleEn: "Roof repair and temporary tarps",
    summaryEs: "Vivienda con filtraciones severas. Se instalarán lonas mientras se evalúa la estructura.",
    summaryEn: "Home with severe leaks. Tarps will be installed while the structure is assessed.",
    daysAgo: 15,
    transcript: "Se filtra el agua por todo el techo, hacen falta lonas y planchas.",
    private: { beneficiaryName: "Familia Ejemplo E", privateAddress: "Dirección de ejemplo 5 (sintética)", contact: "787-555-0105 (falso)" },
    needs: [
      { itemKey: "tarp", qty: 3, receivedDirect: 3, used: 3 },
      { itemKey: "zinc_sheet", qty: 18 },
    ],
  },
  {
    alias: "Reconstrucción 004",
    category: "reconstruction",
    region: "Comerío",
    urgency: "low",
    status: "completed",
    titleEs: "Escalera de acceso reconstruida",
    titleEn: "Access stairway rebuilt",
    summaryEs: "La escalera de acceso a varias casas quedó destruida. Ya fue reconstruida con cemento y varillas donadas.",
    summaryEn: "The access stairway to several homes was destroyed. It has been rebuilt with donated cement and rebar.",
    daysAgo: 40,
    transcript: "La escalera se rompió, nadie puede subir con seguridad.",
    private: { beneficiaryName: "Comunidad Ejemplo F", privateAddress: "Sector de ejemplo (sintético)", contact: "demo-f@example.org" },
    needs: [
      { itemKey: "cement_bag", qty: 10, status: "fulfilled", pledges: [{ qty: 10, mode: "will_buy", status: "fulfilled", received: 10 }], used: 10 },
      { itemKey: "rebar", qty: 8, status: "fulfilled", receivedDirect: 8, used: 8 },
    ],
    outcomes: [{ es: "Escalera reconstruida y en uso por 6 hogares", en: "Stairway rebuilt and in use by 6 households" }],
  },
  // The live-demo project: waits in the coordinator inbox.
  {
    alias: "Reconstrucción 021",
    category: "reconstruction",
    region: "Loíza",
    urgency: "high",
    status: "in_review",
    titleEs: "Reparación de vivienda: paredes y techo",
    titleEn: "Home repair: walls and roof",
    summaryEs:
      "Vivienda con paredes dañadas y techo con filtraciones. Se necesitan unos 200 ladrillos, 15 bolsas de cemento y materiales para el techo (cantidad por confirmar).",
    summaryEn:
      "Home with damaged walls and a leaking roof. About 200 bricks, 15 bags of cement and roofing materials (quantity to be confirmed) are needed.",
    daysAgo: 0,
    transcript: DEMO_TRANSCRIPT,
    private: {
      beneficiaryName: "Familia Ejemplo G",
      privateAddress: "Dirección de ejemplo 7 (sintética)",
      contact: "787-555-0107 (falso)",
      privateNotes: "Datos ficticios para la demostración.",
    },
    needs: [
      { itemKey: "bricks", qty: 200, status: "draft", aiSuggested: true },
      { itemKey: "cement_bag", qty: 15, status: "draft", aiSuggested: true },
      { itemKey: "zinc_sheet", qty: undefined, status: "draft", aiSuggested: true },
    ],
  },
];

const DEMO_USERS: { role: Role; name: string; email: string; withNonprofit: boolean }[] = [
  { role: "field_worker", name: "María (demo)", email: "maria.demo@example.org", withNonprofit: true },
  { role: "coordinator", name: "Coordinadora Ana (demo)", email: "ana.demo@example.org", withNonprofit: true },
  { role: "donor", name: "Donante Luis (demo)", email: "luis.demo@example.org", withNonprofit: false },
  { role: "community", name: "Vecina (demo)", email: "vecina.demo@example.org", withNonprofit: false },
];

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
    await ctx.db.delete(r._id);
  }
  for (const r of await ctx.db.query("donations").withIndex("by_project", (q) => q.eq("projectId", projectId)).take(500)) {
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

async function seedAll(ctx: MutationCtx) {
  const now = Date.now();

  // Nonprofit (upsert)
  let nonprofit = await ctx.db.query("nonprofits").withIndex("by_slug", (q) => q.eq("slug", "espejo-de-agua")).unique();
  const nonprofitId = nonprofit?._id ?? (await ctx.db.insert("nonprofits", { name: "Espejo de Agua", slug: "espejo-de-agua" }));
  nonprofit = await ctx.db.get(nonprofitId);

  // Demo users (upsert by role, stable ids)
  const userIds = {} as Record<Role, Id<"users">>;
  for (const u of DEMO_USERS) {
    const existing = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", u.role)).take(50)).find(
      (x) => x.isDemo,
    );
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
      userIds[u.role] = existing._id;
    } else {
      userIds[u.role] = await ctx.db.insert("users", fields);
    }
  }
  const demoUserIds = new Set<Id<"users">>(Object.values(userIds));

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

  const fieldWorker = userIds.field_worker;
  const coordinator = userIds.coordinator;
  let donorN = 1;

  for (const sp of PROJECTS) {
    const created = now - sp.daysAgo * DAY - 2 * DAY;
    const isPublic = sp.status === "published" || sp.status === "paused" || sp.status === "completed";
    const publishedAt = isPublic ? now - sp.daysAgo * DAY : undefined;
    const projectId = await ctx.db.insert("projects", {
      publicAlias: sp.alias,
      category: sp.category,
      titleEs: sp.titleEs,
      titleEn: sp.titleEn,
      summaryEs: sp.summaryEs,
      summaryEn: sp.summaryEn,
      urgency: sp.urgency,
      status: sp.status,
      nonprofitId,
      region: sp.region,
      createdBy: fieldWorker,
      approvedBy: isPublic ? coordinator : undefined,
      publishedAt,
      safetyPauseReasonPublic: sp.pauseReason,
      isDemo: true,
    });
    await ctx.db.insert("projectPrivate", { projectId, ...sp.private });

    const draftExtraction = {
      title: sp.titleEs,
      category: sp.category,
      urgency: sp.urgency,
      materials: sp.needs.map((n) => ({
        itemKey: n.itemKey,
        nameEs: MATERIALS[n.itemKey].es,
        qty: n.qty ?? null,
        unit: MATERIALS[n.itemKey].unit,
        uncertain: n.qty === undefined,
      })),
    };
    await ctx.db.insert("fieldReports", {
      projectId,
      transcriptOriginal: sp.transcript,
      language: "es",
      transcriptTranslated:
        sp.transcript === DEMO_TRANSCRIPT
          ? "The house needs about two hundred bricks, fifteen bags of cement and roof repair."
          : undefined,
      draftExtraction,
      aiStatus: "done",
      missingQuestions:
        sp.status === "in_review" ? ["¿Cuántas planchas de zinc se necesitan para el techo?"] : [],
      reviewStatus: isPublic ? "approved" : "submitted",
      createdBy: fieldWorker,
    });

    // Timeline: reported -> approved -> published
    let t = created;
    const ms = async (
      type: Doc<"milestones">["type"],
      es: string,
      en: string,
      at: number,
      verified = true,
    ) => {
      await ctx.db.insert("milestones", {
        projectId,
        type,
        status: verified ? "verified" : "pending",
        verifiedBy: verified ? coordinator : undefined,
        occurredAt: at,
        publicDescriptionEs: es,
        publicDescriptionEn: en,
      });
    };
    await ms("need_reported", "Necesidad reportada por el equipo de campo", "Need reported by the field team", t, isPublic);
    if (isPublic) {
      t = publishedAt! - 60_000;
      await ms("approved", "Necesidades revisadas y aprobadas por Espejo de Agua", "Needs reviewed and approved by Espejo de Agua", t);
      t = publishedAt!;
      await ms("published", `Proyecto publicado como «${sp.alias}»`, `Project published as “${sp.alias}”`, t);
    }

    // Needs, pledges, events
    const step = isPublic ? Math.max(1, Math.floor((sp.daysAgo * DAY) / 12)) : 1000;
    for (const n of sp.needs) {
      const m = MATERIALS[n.itemKey];
      const status = n.status ?? "approved";
      const needId = await ctx.db.insert("materialNeeds", {
        projectId,
        itemKey: n.itemKey,
        nameEs: m.es,
        nameEn: m.en,
        requestedQty: n.qty,
        unit: m.unit,
        needsConfirmation: n.qty === undefined,
        aiSuggested: n.aiSuggested ?? false,
        status,
        verifiedBy: status === "approved" || status === "fulfilled" ? coordinator : undefined,
      });
      const needDoc = { nameEs: m.es, nameEn: m.en };

      for (const pl of n.pledges ?? []) {
        t += step;
        const pledgeId = await ctx.db.insert("pledges", {
          needId,
          projectId,
          donorName: `Donante Ejemplo ${donorN}`,
          donorContact: `donante${donorN}@example.org`,
          qty: pl.qty,
          mode: pl.mode,
          status: pl.status ?? "active",
          followToken: `demo-follow-${donorN}-${crypto.randomUUID().slice(0, 8)}`,
          expiresAt: now + 14 * DAY,
        });
        donorN++;
        const txt = materialMilestoneText("pledge", pl.qty, needDoc);
        await ms("pledge", txt.es, txt.en, t);
        if (pl.received) {
          t += step;
          await ctx.db.insert("materialEvents", {
            needId, projectId, pledgeId, eventType: "received", qty: pl.received, verifiedBy: coordinator,
          });
          const r = materialMilestoneText("received", pl.received, needDoc);
          await ms("received", r.es, r.en, t);
        }
      }
      if (n.receivedDirect) {
        t += step;
        await ctx.db.insert("materialEvents", {
          needId, projectId, eventType: "received", qty: n.receivedDirect, verifiedBy: coordinator,
        });
        const r = materialMilestoneText("received", n.receivedDirect, needDoc);
        await ms("received", r.es, r.en, t);
      }
      if (n.used) {
        t += step;
        await ctx.db.insert("materialEvents", {
          needId, projectId, eventType: "used", qty: n.used, verifiedBy: coordinator,
        });
        const u = materialMilestoneText("used", n.used, needDoc);
        await ms("used", u.es, u.en, t);
      }
    }
    for (const o of sp.outcomes ?? []) {
      t += step;
      await ms("outcome", o.es, o.en, t);
    }
    if (sp.status === "paused" && sp.pauseReason) {
      await ms(
        "paused",
        `Proyecto en pausa: ${sp.pauseReason}`,
        "Project paused: temporarily paused while an engineer verifies the structure is safe.",
        Math.min(now, t + step),
      );
    }
  }

  return { nonprofit: nonprofit?.name ?? "Espejo de Agua", wipedProjects: wiped, projects: PROJECTS.length, users: DEMO_USERS.length };
}

const seedReturns = v.object({
  nonprofit: v.string(),
  wipedProjects: v.number(),
  projects: v.number(),
  users: v.number(),
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
