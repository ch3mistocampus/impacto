/**
 * Bilingual UI strings. Every visible string goes here — Spanish first.
 * Agents: add keys under your own section prefix (landing.*, donate.*, field.*, coord.*, project.*)
 * to avoid merge conflicts. Keep keys sorted within your section.
 */
const d = <T extends Record<string, { es: string; en: string }>>(x: T) => x;

export const dict = d({
  // common
  "app.name": { es: "Impacto", en: "Impacto" },
  "app.tagline": {
    es: "Lo que la comunidad necesita, lo que se dona y lo que realmente llega.",
    en: "What communities need, what donors give, and what actually arrives.",
  },
  "app.demoBanner": {
    es: "Prototipo de hackathon — todos los datos son ficticios.",
    en: "Hackathon prototype — all data is synthetic.",
  },
  "nav.home": { es: "Inicio", en: "Home" },
  "nav.donate": { es: "Donar materiales", en: "Donate materials" },
  "nav.field": { es: "Campo", en: "Field" },
  "nav.coordinator": { es: "Coordinación", en: "Coordinator" },
  "nav.signIn": { es: "Entrar (demo)", en: "Sign in (demo)" },
  "nav.signOut": { es: "Salir", en: "Sign out" },
  "lang.toggle": { es: "English", en: "Español" },

  "role.field_worker": { es: "Trabajador de campo", en: "Field worker" },
  "role.coordinator": { es: "Coordinador/a", en: "Nonprofit coordinator" },
  "role.donor": { es: "Donante", en: "Donor" },
  "role.community": { es: "Comunidad", en: "Community viewer" },

  "category.roof_shelter": { es: "Techo y Refugio", en: "Roof and Shelter" },
  "category.reconstruction": { es: "Reconstrucción", en: "Reconstruction" },
  "category.heal_sow": { es: "Sanar y Sembrar", en: "Heal and Sow" },

  "ledger.requested": { es: "Solicitado", en: "Requested" },
  "ledger.pledged": { es: "Comprometido", en: "Pledged" },
  "ledger.received": { es: "Recibido", en: "Received" },
  "ledger.used": { es: "Usado (verificado)", en: "Used (verified)" },
  "ledger.available": { es: "Disponible para comprometer", en: "Available to pledge" },
  "ledger.needsConfirmation": { es: "Requiere confirmación", en: "Needs confirmation" },
  "ledger.pledgedNotDelivered": { es: "Comprometido, no entregado", en: "Pledged, not delivered" },

  "badge.verified": { es: "Verificado por la organización", en: "Verified by nonprofit" },
  "badge.aiDraft": { es: "Borrador de IA — revisar", en: "AI draft — review" },

  "common.save": { es: "Guardar", en: "Save" },
  "common.cancel": { es: "Cancelar", en: "Cancel" },
  "common.submit": { es: "Enviar", en: "Submit" },
  "common.loading": { es: "Cargando…", en: "Loading…" },
  "common.back": { es: "Atrás", en: "Back" },
  "common.next": { es: "Siguiente", en: "Next" },
});

export type DictKey = keyof typeof dict;
