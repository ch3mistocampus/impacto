"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { AiNever, Button, Chip, Label, Section, VerifiedBy, formatDate, inputCls, useAction } from "./ui";
import { StageSwatch, type Stage } from "@/components/ui/tricolor";
import { containsPrivate, type ReviewData, type ReviewReport } from "./types";

/** Pledges are gold (a promise); everything else is ink. Esmeralda is reserved for the verified mark. */
const TYPE_TONE: Record<string, "gold" | "navy" | "neutral"> = {
  pledge: "gold",
  received: "navy",
  used: "navy",
  outcome: "navy",
  paused: "navy",
  approved: "neutral",
  published: "neutral",
};
const TYPE_STAGE: Record<string, Stage> = { pledge: "pledged", received: "received", used: "used", outcome: "used" };

export function MilestonePanel({ data }: { data: ReviewData }) {
  const { t, pick, locale } = useI18n();
  const { sessionToken, user } = useSession();
  const add = useMutation(api.coordinator.addMilestone);
  const { busy, run } = useAction();
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  const name = data.private?.beneficiaryName;
  const leak = containsPrivate(es, name) || containsPrivate(en, name);
  const timeline = [...data.milestones].sort((a, b) => b.occurredAt - a.occurredAt);

  return (
    <div className="space-y-5">
      <ProposedMilestones
        reports={data.fieldReports}
        onUse={(m) => {
          setEs(m.es);
          setEn(m.en);
          document.getElementById("ms-es")?.focus();
        }}
      />
      <Section title={t("coord.milestone")}>
        <p className="mb-3 text-sm text-muted">{t("coord.milestone.note")}</p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sessionToken || !es.trim() || leak) return;
            const ok = await run(
              "ms",
              () =>
                add({
                  sessionToken,
                  projectId: data.project.projectId,
                  type: "outcome",
                  descriptionEs: es.trim(),
                  descriptionEn: en.trim(),
                }),
              t("coord.milestone.toast"),
              user ? `${t("coord.verifiedBy")} ${user.name}` : undefined,
            );
            if (ok) {
              setEs("");
              setEn("");
            }
          }}
        >
          <div>
            <Label htmlFor="ms-es">{t("coord.milestone.es")}</Label>
            <textarea id="ms-es" lang="es" rows={2} value={es} onChange={(e) => setEs(e.target.value)} className={inputCls} />
          </div>
          <div>
            <Label htmlFor="ms-en">{t("coord.milestone.en")}</Label>
            <textarea id="ms-en" lang="en" rows={2} value={en} onChange={(e) => setEn(e.target.value)} className={inputCls} />
          </div>
          {leak && (
            <p role="alert" className="rounded-[2px] border-l-2 border-red bg-red-soft px-2.5 py-1.5 text-[13px] font-semibold text-red">
              {t("coord.textWarnName")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="leaf" busy={busy === "ms"} disabled={!es.trim() || leak}>
              {t("coord.milestone.add")}
            </Button>
            {user && (
              <span className="ml-auto text-[13px] text-muted">
                {t("coord.youWillSign")} <strong className="text-foreground">{user.name}</strong>
              </span>
            )}
          </div>
        </form>
      </Section>

      <Section title={t("coord.timeline")}>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <ol className="-my-2 divide-y divide-border">
            {timeline.map((m) => (
              <li key={m.milestoneId} className="grid gap-x-5 gap-y-1 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                <span className="font-display text-[15px] italic text-muted sm:pt-0.5">{formatDate(m.occurredAt, locale)}</span>
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StageSwatch stage={TYPE_STAGE[m.type] ?? "requested"} size={8} />
                  <Chip tone={TYPE_TONE[m.type] ?? "neutral"}>{t(`coord.ms.${m.type}` as DictKey)}</Chip>
                </div>
                <p className="mt-1 text-[15px] leading-relaxed">{pick(m.descriptionEs, m.descriptionEn)}</p>
                {m.status === "verified" && m.type !== "pledge" && (
                  <div className="mt-1">
                    {/* TODO(lane A): milestones don't expose the verifier's name; show the org-level badge. */}
                    <VerifiedBy text={t("badge.verified")} />
                  </div>
                )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

type Proposed = { es: string; en: string };

function proposedFrom(reports: ReviewReport[]): Proposed[] {
  const out: Proposed[] = [];
  const seen = new Set<string>();
  for (const r of reports) {
    const list = (r.draftExtraction as { proposedMilestones?: unknown } | null)?.proposedMilestones;
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (!m || typeof m !== "object") continue;
      const es = String((m as Proposed).es ?? "").trim();
      const en = String((m as Proposed).en ?? "").trim();
      const key = `${es}|${en}`;
      if ((es || en) && !seen.has(key)) {
        seen.add(key);
        out.push({ es: es || en, en: en || es });
      }
    }
  }
  return out;
}

/** AI suggestions from the field report. Never verified on their own: "use" only copies into the form. */
export function ProposedMilestones({ reports, onUse }: { reports: ReviewReport[]; onUse?: (m: Proposed) => void }) {
  const { t, pick } = useI18n();
  const items = proposedFrom(reports);
  if (items.length === 0) return null;
  return (
    <Section
      title={t("coord.pm.title")}
      aside={
        <Chip tone="navy">
          {t("coord.aiDraft")}
        </Chip>
      }
    >
      <p className="mb-3 text-sm text-muted">{t("coord.pm.note")}</p>
      <ol className="divide-y divide-dotted divide-border border-y border-dashed border-rule/40">
        {items.map((m, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-3 py-2.5"
          >
            <span className="w-6 text-right font-display text-lg tabular-nums text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 text-[15px]">{pick(m.es, m.en)}</span>
            {onUse && (
              <Button size="sm" variant="ghost" onClick={() => onUse(m)}>
                {t("coord.pm.use")}
              </Button>
            )}
          </li>
        ))}
      </ol>
      <AiNever className="mt-3" />
    </Section>
  );
}
