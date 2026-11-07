import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("expire stale pledges", { hours: 1 }, internal.pledges.expireStale, {});

export default crons;
