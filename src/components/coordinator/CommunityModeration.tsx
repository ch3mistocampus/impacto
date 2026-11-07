"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button, CategoryTag, Chip, Section, Skeleton, VerifiedBy, formatDate, inputCls, useAction } from "./ui";
import { LockGlyph } from "./CoordinatorGate";

type Row = FunctionReturnType<typeof api.community.listForModeration>["rows"][number];
type Filter = "pending" | "approved" | "hidden";
const FILTERS: Filter[] = ["pending", "approved", "hidden"];

/** Coordinator tab: moderate community feedback (approve/hide + bilingual answer). Every action is audited server-side. */
export function CommunityModeration() {
  const { t } = useI18n();
  const { sessionToken } = useSession();
  const data = useQuery(api.community.listForModeration, sessionToken ? { sessionToken } : "skip");
  const [filter, setFilter] = useState<Filter>("pending");

  if (data === undefined) return <Skeleton rows={3} />;
  const rows = data.rows.filter((r) => r.status === filter);
  const count = (f: Filter) => data.rows.filter((r) => r.status === f).length;

  return (
    <Section
      title={t("coord.cm.title")}
      aside={
        <div role="group" aria-label={t("coord.cm.title")} className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-9 rounded-[2px] px-3 text-sm ${
                filter === f ? "bg-navy font-semibold text-on-navy" : "text-muted hover:text-foreground"
              }`}
            >
              {t(`coord.cm.filter.${f}` as DictKey)} <span className="tabular-nums">({count(f)})</span>
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-4 max-w-prose text-sm text-muted">{t("coord.cm.note")}</p>
      {rows.length === 0 ? (
        <p className="border-y border-border px-4 py-10 text-center font-display text-lg italic text-muted">
          {t("coord.cm.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-rule">
          {rows.map((r) => (
            <ModerationItem key={r.feedbackId} row={r} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ModerationItem({ row }: { row: Row }) {
  const { t, locale } = useI18n();
  const { sessionToken } = useSession();
  const moderate = useMutation(api.community.moderate);
  const { busy, run } = useAction();
  const [es, setEs] = useState(row.responseEs ?? "");
  const [en, setEn] = useState(row.responseEn ?? "");
  const id = `cm-${row.feedbackId}`;

  const act = (status: "approved" | "hidden") =>
    sessionToken &&
    run(
      status,
      () =>
        moderate({
          sessionToken,
          feedbackId: row.feedbackId,
          status,
          ...(es.trim() ? { responseEs: es.trim() } : {}),
          ...(en.trim() ? { responseEn: en.trim() } : {}),
        }),
      t(status === "approved" ? "coord.cm.approved.toast" : "coord.cm.hidden.toast"),
    );

  return (
    <li className="py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Chip tone={row.kind === "concern" ? "gold" : "navy"}>{t(`community.kind.${row.kind}` as DictKey)}</Chip>
        {row.project ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <CategoryTag category={row.project.category} />
            <span className="text-muted">{row.project.publicAlias}</span>
          </span>
        ) : (
          <span className="text-sm text-muted">{t("community.general")}</span>
        )}
        <span className="text-[13px] text-muted">
          {formatDate(row.createdAt, locale)} · {t(`community.lang.${row.language}` as DictKey)}
        </span>
        {row.status !== "pending" && (
          <Chip tone={row.status === "approved" ? "emerald" : "neutral"}>
            {t(`coord.cm.status.${row.status}` as DictKey)}
          </Chip>
        )}
      </div>

      <blockquote lang={row.language} className="mt-2 font-display text-xl leading-snug">
        “{row.message}”
      </blockquote>
      {row.redacted && (
        <p className="mt-1.5">
          <Chip tone="gold">{t("coord.cm.redacted")}</Chip>
        </p>
      )}

      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-1.5">
          <dt className="text-muted">{t("coord.cm.author")}:</dt>
          <dd>{row.authorRole ? t(`role.${row.authorRole}` as DictKey) : t("coord.cm.anonymous")}</dd>
        </div>
        {row.contactPrivate && (
          <div className="flex items-center gap-1.5">
            <LockGlyph className="size-4" />
            <dt className="text-muted">{t("coord.cm.contact")}:</dt>
            <dd className="truncate font-semibold">{row.contactPrivate}</dd>
          </div>
        )}
      </dl>

      {row.respondedAt && (
        <p className="mt-2">
          <VerifiedBy text={`${t("coord.cm.answeredBy")} ${row.respondedByName ?? ""}`} at={row.respondedAt} />
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block" htmlFor={`${id}-es`}>
          <span className="mb-1 block text-sm font-semibold">{t("coord.cm.responseEs")}</span>
          <textarea id={`${id}-es`} lang="es" rows={2} maxLength={2000} value={es} onChange={(e) => setEs(e.target.value)} className={`${inputCls} py-2`} />
        </label>
        <label className="block" htmlFor={`${id}-en`}>
          <span className="mb-1 block text-sm font-semibold">{t("coord.cm.responseEn")}</span>
          <textarea id={`${id}-en`} lang="en" rows={2} maxLength={2000} value={en} onChange={(e) => setEn(e.target.value)} className={`${inputCls} py-2`} />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted">{t("coord.cm.responseHint")}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="verify" size="sm" busy={busy === "approved"} disabled={!!busy} onClick={() => act("approved")}>
          {row.status === "approved" ? t("coord.cm.saveAnswer") : t("coord.cm.approve")}
        </Button>
        {row.status !== "hidden" && (
          <Button variant="secondary" size="sm" busy={busy === "hidden"} disabled={!!busy} onClick={() => act("hidden")}>
            {t("coord.cm.hide")}
          </Button>
        )}
      </div>
    </li>
  );
}
