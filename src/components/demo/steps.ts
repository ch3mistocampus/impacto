import type { DictKey } from "@/lib/dict";
import type { Locale } from "@/lib/i18n";
import type { Role } from "@/lib/session";

/** Ids of the live demo project; they change on every reset, so they come from presenter.liveDemo. */
export type LiveIds = { projectId: string; bricksNeedId: string | null } | null;

export type DemoStep = {
  n: number;
  /** Seconds from the start of the run. */
  from: number;
  to: number;
  titleKey: DictKey;
  points: DictKey[];
  role: Role;
  /** Optional locale switch performed by "Go". */
  locale?: Locale;
  noteKey?: DictKey;
  href: (live: LiveIds) => string;
  /** Whether the href is deep-linked to the live project (warn when it is missing). */
  needsLive: boolean;
  alt?: { labelKey: DictKey; href: (live: LiveIds) => string | null };
};

/** The judging script from docs/BRIEF.md ("Three-minute judging demo"). */
export const DEMO_STEPS: DemoStep[] = [
  {
    n: 1,
    from: 0,
    to: 25,
    titleKey: "demo.s1.title",
    points: ["demo.s1.p1", "demo.s1.p2", "demo.s1.p3"],
    role: "community",
    href: () => "/",
    needsLive: false,
  },
  {
    n: 2,
    from: 25,
    to: 70,
    titleKey: "demo.s2.title",
    points: ["demo.s2.p1", "demo.s2.p2", "demo.s2.p3"],
    role: "field_worker",
    href: () => "/field/new",
    needsLive: false,
    alt: { labelKey: "demo.s2.alt", href: (l) => (l ? `/field/${l.projectId}` : null) },
  },
  {
    n: 3,
    from: 70,
    to: 95,
    titleKey: "demo.s3.title",
    points: ["demo.s3.p1", "demo.s3.p2"],
    role: "coordinator",
    href: (l) => (l ? `/coordinator/${l.projectId}` : "/coordinator"),
    needsLive: true,
  },
  {
    n: 4,
    from: 95,
    to: 135,
    titleKey: "demo.s4.title",
    points: ["demo.s4.p1", "demo.s4.p2", "demo.s4.p3"],
    role: "donor",
    href: () => "/donate?category=reconstruction",
    needsLive: false,
  },
  {
    n: 5,
    from: 135,
    to: 165,
    titleKey: "demo.s5.title",
    points: ["demo.s5.p1", "demo.s5.p2"],
    role: "coordinator",
    href: (l) =>
      l ? `/coordinator/${l.projectId}${l.bricksNeedId ? `#need-${l.bricksNeedId}` : ""}` : "/coordinator",
    needsLive: true,
  },
  {
    n: 6,
    from: 165,
    to: 180,
    titleKey: "demo.s6.title",
    points: ["demo.s6.p1", "demo.s6.p2", "demo.s6.p3"],
    role: "community",
    locale: "en",
    noteKey: "demo.s6.note",
    href: (l) => (l ? `/p/${l.projectId}` : "/transparency"),
    needsLive: true,
  },
];

export const RUN_SECONDS = 180;

/** m:ss */
export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Which step the wall clock says we should be on (0-based). */
export function scheduledStep(elapsedSeconds: number) {
  const i = DEMO_STEPS.findIndex((s) => elapsedSeconds < s.to);
  return i === -1 ? DEMO_STEPS.length - 1 : i;
}
