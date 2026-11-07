"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { AiNever, Button, Chip, Label, Section, VerifiedBy, formatDate, inputCls, useAction } from "./ui";
import { containsPrivate, type ReviewData, type ReviewReport } from "./types";

const TYPE_TONE: Record<string, "amber" | "sky" | "leaf" | "clay" | "neutral" | "brick"> = {
  pledge: "amber",
  received: "sky",
  used: "leaf",
  outcome: "leaf",
  paused: "brick",
  approved: "clay",
  published: "clay",
};

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
            <p role="alert" className="rounded-md bg-brick-soft px-2.5 py-1.5 text-xs font-medium text-brick">
              {t("coord.textWarnName")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="leaf" busy={busy === "ms"} disabled={!es.trim() || leak}>
              {t("coord.milestone.add")}
            </Button>
            {user && (
              <span className="ml-auto text-xs text-muted">
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
          <ol className="relative space-y-4 border-l-2 border-border pl-5">
            {timeline.map((m) => (
              <li key={m.milestoneId} className="relative">
                <span
                  aria-hidden
                  className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-surface ${
                    m.type === "used" || m.type === "outcome"
                      ? "bg-leaf"
                      : m.type === "received"
                        ? "bg-sky"
                        : m.type === "pledge"
                          ? "bg-amber"
                          : "bg-clay"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={TYPE_TONE[m.type] ?? "neutral"}>{t(`coord.ms.${m.type}` as DictKey)}</Chip>
                  <span className="text-xs text-muted">{formatDate(m.occurredAt, locale)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed">{pick(m.descriptionEs, m.descriptionEn)}</p>
                {m.status === "verified" && m.type !== "pledge" && (
                  <div className="mt-1">
                    {/* TODO(lane A): milestones don't expose the verifier's name; show the org-level badge. */}
                    <VerifiedBy text={t("badge.verified")} />
                  </div>
                )}
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
    <Section title={t("coord.pm.title")} aside={<Chip tone="amber">{t("coord.aiDraft")}</Chip>}>
      <p className="mb-3 text-sm text-muted">{t("coord.pm.note")}</p>
      <ol className="space-y-2">
        {items.map((m, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-amber/60 bg-amber-soft/30 px-3 py-2"
          >
            <span className="w-5 text-right text-xs tabular-nums text-muted">{i + 1}.</span>
            <span className="min-w-0 flex-1 text-sm">{pick(m.es, m.en)}</span>
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
