"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, Chip, Label, Section, VerifiedBy, formatDate, inputCls, useAction } from "./ui";
import { containsPrivate, type ReviewData } from "./types";

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
