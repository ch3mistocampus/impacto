import type { DictKey } from "@/lib/dict";
import type { Role } from "@/lib/session";

/** Ids the tour deep-links to. Live = the seeded "Reconstrucción 021"; showcase = a finished public project. */
export type TourIds = {
  liveId: string | null;
  livePublished: boolean;
  showcaseId: string | null;
};

export type TourStep = {
  id: string;
  /** Demo role to switch to before this step (unset = keep the current one). */
  role?: Role;
  /** Where the step happens. Unset = stay on the current page. */
  path?: (ids: TourIds) => string | null;
  /** CSS selector to spotlight. Unset = centered intro/outro card. */
  target?: string;
  titleKey: DictKey;
  bodyKey: DictKey;
  tryKey?: DictKey;
  /** Flip ES ⇄ EN when the step opens. */
  flipLocale?: boolean;
  /** Autoplay dwell in ms. */
  ms?: number;
};

/** After the live project is published the ledger/timeline steps follow it; before, they use a finished project. */
const followId = (ids: TourIds) => (ids.livePublished && ids.liveId ? ids.liveId : ids.showcaseId);

export const TOUR_STEPS: TourStep[] = [
  { id: "intro", path: () => "/", titleKey: "tour.s.intro.title", bodyKey: "tour.s.intro.body", ms: 7000 },
  {
    id: "figures",
    path: () => "/",
    target: '[data-tour="impact-figures"]',
    titleKey: "tour.s.figures.title",
    bodyKey: "tour.s.figures.body",
  },
  {
    id: "capture",
    role: "field_worker",
    path: () => "/field/new",
    target: '[data-tour="capture"]',
    titleKey: "tour.s.capture.title",
    bodyKey: "tour.s.capture.body",
    tryKey: "tour.s.capture.try",
  },
  {
    id: "draft",
    role: "field_worker",
    path: (ids) => (ids.liveId ? `/field/${ids.liveId}` : null),
    target: '[data-tour="field-report"]',
    titleKey: "tour.s.draft.title",
    bodyKey: "tour.s.draft.body",
  },
  {
    id: "fieldPrivate",
    role: "field_worker",
    target: 'section[aria-labelledby="pv-private"]',
    titleKey: "tour.s.fieldPrivate.title",
    bodyKey: "tour.s.fieldPrivate.body",
    ms: 6500,
  },
  {
    id: "coordEvidence",
    role: "coordinator",
    path: (ids) => (ids.liveId ? `/coordinator/${ids.liveId}` : "/coordinator"),
    target: '[data-tour="coord-evidence"]',
    titleKey: "tour.s.coordEvidence.title",
    bodyKey: "tour.s.coordEvidence.body",
  },
  {
    id: "coordPrivate",
    role: "coordinator",
    target: '[data-tour="coord-private"]',
    titleKey: "tour.s.coordPrivate.title",
    bodyKey: "tour.s.coordPrivate.body",
    ms: 6000,
  },
  {
    id: "publish",
    role: "coordinator",
    target: '[data-tour="coord-publish"]',
    titleKey: "tour.s.publish.title",
    bodyKey: "tour.s.publish.body",
    tryKey: "tour.s.publish.try",
  },
  {
    id: "deck",
    role: "donor",
    path: () => "/donate?category=reconstruction",
    target: '[data-tour="donate-deck"]',
    titleKey: "tour.s.deck.title",
    bodyKey: "tour.s.deck.body",
    tryKey: "tour.s.deck.try",
  },
  {
    id: "sheet",
    role: "donor",
    target: "dialog[open]",
    titleKey: "tour.s.sheet.title",
    bodyKey: "tour.s.sheet.body",
    tryKey: "tour.s.sheet.try",
  },
  {
    id: "ledger",
    role: "coordinator",
    path: (ids) => {
      const id = followId(ids);
      return id ? `/coordinator/${id}` : "/coordinator";
    },
    target: "#mpanel-materials",
    titleKey: "tour.s.ledger.title",
    bodyKey: "tour.s.ledger.body",
  },
  {
    id: "timeline",
    path: (ids) => {
      const id = followId(ids);
      return id ? `/p/${id}` : "/transparency";
    },
    target: 'section[aria-labelledby="timeline-title"]',
    titleKey: "tour.s.timeline.title",
    bodyKey: "tour.s.timeline.body",
  },
  {
    id: "counters",
    path: () => "/transparency",
    target: 'section[aria-labelledby="counters-title"]',
    titleKey: "tour.s.counters.title",
    bodyKey: "tour.s.counters.body",
  },
  {
    id: "lang",
    target: '[data-tour="lang"]',
    titleKey: "tour.s.lang.title",
    bodyKey: "tour.s.lang.body",
    flipLocale: true,
    ms: 6000,
  },
  { id: "outro", titleKey: "tour.s.outro.title", bodyKey: "tour.s.outro.body", ms: 8000 },
];
