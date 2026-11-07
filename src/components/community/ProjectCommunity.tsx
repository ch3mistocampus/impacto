"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { btn } from "@/components/ui/tricolor";
import type { Id } from "../../../convex/_generated/dataModel";
import { CommunityVoices } from "./CommunityVoices";
import { FeedbackForm } from "./FeedbackForm";

/** Per-project approved community Q&A + a project-scoped feedback form (public project page). */
export function ProjectCommunity() {
  const { t } = useI18n();
  const params = useParams<{ projectId?: string; id?: string }>();
  const raw = params.projectId ?? params.id ?? "";
  // Same args as ProjectDetail's subscription, so Convex dedupes it.
  const project = useQuery(api.public.getProject, { projectId: raw });
  const [writing, setWriting] = useState(false);
  if (!project) return null;
  const projectId = project.project.projectId as Id<"projects">;
  const canWrite = project.project.status === "published";
  return (
    <section aria-labelledby="project-community" className="mt-14 max-w-3xl">
      <h2 id="project-community" className="font-display text-2xl font-normal sm:text-3xl">
        {t("community.projectVoices")}
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">{t("community.qaNote")}</p>
      <CommunityVoices projectId={projectId} limit={10} showProject={false} />
      <div className="mt-6">
        {!canWrite ? null : writing ? (
          <FeedbackForm fixedProjectId={projectId} />
        ) : (
          <button type="button" onClick={() => setWriting(true)} className={btn("secondary", "md")}>
            {t("community.projectVoicesCta")}
          </button>
        )}
      </div>
    </section>
  );
}
