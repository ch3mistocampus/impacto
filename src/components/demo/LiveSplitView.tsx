"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { MaterialGlyph } from "@/components/ui/MaterialGlyph";
import { Chip, STAGE_TEXT, STATUS_TONE, StageSwatch, intlLocale, type Stage } from "@/components/ui/tricolor";
import { FlashNumber, FlashOnMount } from "./Flash";

type Live = FunctionReturnType<typeof api.presenter.liveDemo>;
type Ledger = NonNullable<Live>["needs"][number]["ledger"];

const STAGES: Stage[] = ["requested", "pledged", "received", "delivered", "used", "verified"];

function stageValue(l: Ledger, s: Stage): number | null {
  switch (s) {
    case "requested":
      return l.requested;
    case "pledged":
      // Cumulative (active + fulfilled) so the six stages read left to right.
      return l.pledgedTotal;
    default:
      return l[s];
  }
}

function SixStages({ ledger }: { ledger: Ledger }) {
  const { t, locale } = useI18n();
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-3">
      {STAGES.map((s) => {
        const v = stageValue(ledger, s);
        return (
          <div key={s} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <StageSwatch stage={s} />
              {t(`demo.stage.${s}`)}
            </dt>
            <dd className={`font-display text-2xl leading-tight ${STAGE_TEXT[s]}`}>
              {v === null ? (
                <span className="text-sm font-sans font-semibold text-gold-ink">{t("demo.toConfirm")}</span>
              ) : (
                <FlashNumber value={v} locale={intlLocale(locale)} className="-ml-1" />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Panel({ title, n, children }: { title: string; n: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <h3 className="font-display text-xl font-normal">
          <span className="mr-2 text-muted">{n}</span>
          {title}
        </h3>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function InReview() {
  const { t } = useI18n();
  return (
    <div className="border border-dashed border-gold bg-gold-soft/40 p-4">
      <p className="font-semibold text-gold-ink">{t("demo.inReview")}</p>
      <p className="mt-1 text-sm text-muted">{t("demo.inReviewHint")}</p>
    </div>
  );
}

export function LiveSplitView({ live }: { live: Live | undefined }) {
  const { t, pick, locale } = useI18n();
  const isPublic = live && (live.status === "published" || live.status === "paused" || live.status === "completed");
  const pub = useQuery(api.public.getProject, live && isPublic ? { projectId: live.projectId } : "skip");
  // Timeline entries newer than this mount get a one-time highlight.
  const [mountedAt, setMountedAt] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountedAt(Date.now());
  }, []);

  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateTime = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });
  const coordBricks = live?.needs.find((n) => n.itemKey === "bricks");
  const pubBricks = pub?.needs.find((n) => n.itemKey === "bricks");
  const loading = live === undefined || (isPublic && pub === undefined);

  return (
    <section aria-labelledby="demo-live" className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="demo-live" className="font-display text-3xl font-normal">
          {t("demo.liveTitle")}
        </h2>
        {live && (
          <p className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{live.publicAlias}</span>
            <span className="text-muted">· {live.region}</span>
            <Chip tone={STATUS_TONE[live.status]}>{t(`demo.projectStatus.${live.status}`)}</Chip>
          </p>
        )}
      </div>
      <p className="mt-1 text-[15px] text-muted">{t("demo.liveLead")}</p>

      {loading ? (
        <p className="mt-4 text-muted">{t("common.loading")}</p>
      ) : live === null ? (
        <p className="mt-4 text-red">{t("demo.noLiveProject")}</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* (a) Donor-facing card */}
          <Panel n={1} title={t("demo.panelDonor")}>
            {!isPublic ? (
              <InReview />
            ) : !pubBricks ? (
              <p className="text-muted">{t("demo.notPledgeable")}</p>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <MaterialGlyph itemKey={pubBricks.itemKey} className="size-14 text-foreground" />
                  <div>
                    <p className="font-display text-2xl leading-tight">{pick(pubBricks.nameEs, pubBricks.nameEn)}</p>
                    <p className="text-sm text-muted">{live.publicAlias}</p>
                  </div>
                </div>
                <div className="mt-4 border-y border-border py-3">
                  <p className="text-sm text-muted">{t("demo.availableToPledge")}</p>
                  <p className="font-display text-5xl leading-none">
                    <FlashNumber value={pubBricks.ledger.availableToPledge} locale={intlLocale(locale)} className="-ml-1" />
                    <span className="ml-2 font-sans text-base text-muted">{pubBricks.unit}</span>
                  </p>
                </div>
                <div className="mt-4">
                  <SixStages ledger={pubBricks.ledger} />
                </div>
                {pubBricks.ledger.pledged > 0 && (
                  <p className="mt-4">
                    <Chip tone="gold">{t("ledger.pledgedNotDelivered")}</Chip>
                  </p>
                )}
              </div>
            )}
          </Panel>

          {/* (b) Coordinator ledger (aggregate, via presenter.liveDemo) */}
          <Panel n={2} title={t("demo.panelCoord")}>
            {!coordBricks ? (
              <p className="text-muted">{t("demo.noLiveProject")}</p>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-2xl leading-tight">{pick(coordBricks.nameEs, coordBricks.nameEn)}</p>
                  <Chip tone={coordBricks.status === "approved" ? "navy" : coordBricks.status === "draft" ? "gold" : "neutral"}>
                    {t(`demo.needStatus.${coordBricks.status}`)}
                  </Chip>
                </div>
                <div className="mt-4">
                  <SixStages ledger={coordBricks.ledger} />
                </div>
                <h4 className="mt-5 text-sm font-semibold">{t("demo.latestEvents")}</h4>
                {coordBricks.latestEvents.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{t("demo.noEvents")}</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
                    {coordBricks.latestEvents.map((e) => (
                      <li key={`${e.kind}-${e.at}-${e.qty}`}>
                        <FlashOnMount
                          active={mountedAt !== null && e.at > mountedAt}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2"
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                            {e.kind !== "returned" && <StageSwatch stage={e.kind === "pledge" ? "pledged" : e.kind} />}
                            <span className="font-semibold">{t(`demo.ev.${e.kind}` as DictKey)}</span>
                            <span className="tabular-nums">{e.qty.toLocaleString(intlLocale(locale))}</span>
                            {e.pledgeStatus && <span className="text-muted">({t(`demo.pledge.${e.pledgeStatus}`)})</span>}
                          </span>
                          <span className="text-xs text-muted">
                            {e.actorRole && `${t("demo.by")} ${t(`role.${e.actorRole}`)} · `}
                            <time dateTime={new Date(e.at).toISOString()}>{time.format(e.at)}</time>
                          </span>
                        </FlashOnMount>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Panel>

          {/* (c) Public timeline */}
          <Panel n={3} title={t("demo.panelPublic")}>
            {!isPublic || !pub ? (
              <InReview />
            ) : pub.timeline.length === 0 ? (
              <p className="text-muted">{t("demo.noTimeline")}</p>
            ) : (
              <ol className="space-y-0 border-l border-rule pl-4">
                {[...pub.timeline]
                  .sort((a, b) => b.occurredAt - a.occurredAt)
                  .slice(0, 8)
                  .map((m) => {
                    const stage = (STAGES as string[]).includes(m.type) ? (m.type as Stage) : m.type === "pledge" ? "pledged" : null;
                    return (
                      <li key={m.milestoneId}>
                        <FlashOnMount
                          active={mountedAt !== null && m.occurredAt > mountedAt}
                          className="relative -ml-1 px-1 py-2"
                        >
                          <span aria-hidden className="absolute top-3.5 -left-[13px] size-2 bg-foreground" />
                          <p className="flex items-center gap-2 text-[15px]">
                            {stage && <StageSwatch stage={stage} />}
                            {pick(m.descriptionEs, m.descriptionEn)}
                          </p>
                          <time dateTime={new Date(m.occurredAt).toISOString()} className="text-xs text-muted">
                            {dateTime.format(m.occurredAt)}
                          </time>
                        </FlashOnMount>
                      </li>
                    );
                  })}
              </ol>
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}
