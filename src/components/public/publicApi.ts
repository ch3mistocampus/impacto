/** Public API shapes (Update 2, Lane A2) derived from the real Convex validators. */
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

type ProjectData = NonNullable<FunctionReturnType<typeof api.public.getProject>>;

export type ProjectCardData = FunctionReturnType<typeof api.public.listPublishedProjects>[number];
export type PublicEvidence = ProjectData["evidence"][number];
export type EvidenceType = PublicEvidence["type"];
export type Financial = ProjectData["financials"][number];
export type TransparencyDashboard = FunctionReturnType<typeof api.public.transparencyDashboard>;
export type WeeklyReport = FunctionReturnType<typeof api.public.listWeeklyReports>[number];
export type FollowPledgeData = NonNullable<FunctionReturnType<typeof api.public.followPledge>>;
