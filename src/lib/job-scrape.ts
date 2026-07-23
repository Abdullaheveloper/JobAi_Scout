import type { Json, Tables } from "@/integrations/supabase/types";

export const JOB_ADAPTER_STEPS = [
  { key: "linkedin", label: "LinkedIn", source: "linkedin_apify" },
  { key: "indeed", label: "Indeed", source: "indeed_apify" },
  { key: "rss", label: "RSS Feeds", source: "rss" },
  { key: "company_career", label: "Company Careers", source: "company_career" },
] as const;
export const MIN_VISIBLE_MATCH_SCORE = 40;

export type JobAdapterKey = typeof JOB_ADAPTER_STEPS[number]["key"];
export type JobAdapterState = "waiting" | "running" | "completed" | "timed_out" | "failed" | "stopped";
export type JobScrapeSession = Tables<"job_scrape_sessions">;

const DEFAULT_STATUSES: Record<JobAdapterKey, JobAdapterState> = {
  linkedin: "waiting",
  indeed: "waiting",
  rss: "waiting",
  company_career: "waiting",
};

export function parseAdapterStatuses(value: Json | null | undefined): Record<JobAdapterKey, JobAdapterState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_STATUSES };
  return JOB_ADAPTER_STEPS.reduce((statuses, adapter) => {
    const candidate = value[adapter.key];
    statuses[adapter.key] = ["waiting", "running", "completed", "timed_out", "failed", "stopped"].includes(String(candidate))
      ? candidate as JobAdapterState
      : "waiting";
    return statuses;
  }, { ...DEFAULT_STATUSES });
}

export function isScrapeSessionActive(session: JobScrapeSession | null | undefined): boolean {
  return Boolean(session && ["pending", "running"].includes(session.session_status));
}

export function isVisibleJobMatch(score: number | null | undefined): boolean {
  return Number(score || 0) >= MIN_VISIBLE_MATCH_SCORE;
}

export function runningAdapterPosition(session: JobScrapeSession | null | undefined): number {
  if (!session?.current_adapter) return 0;
  const index = JOB_ADAPTER_STEPS.findIndex((adapter) => adapter.key === session.current_adapter);
  return index < 0 ? 0 : index + 1;
}

export function scrapeCompletionMessage(session: JobScrapeSession): string {
  if (session.session_status === "completed") {
    return `Job scraping completed. ${session.total_jobs_displayed} matching jobs found.`;
  }
  if (session.session_status === "partially_completed") {
    return "Scraping completed with some source errors. Successful results are available below.";
  }
  if (session.session_status === "failed") {
    return "The sources could not be reached this time. Review the source states and try again.";
  }
  if (session.session_status === "stopped") {
    return `Scraping stopped safely. ${session.total_jobs_displayed} matching jobs were kept.`;
  }
  const position = runningAdapterPosition(session);
  return position ? `Running adapter ${position} of ${JOB_ADAPTER_STEPS.length}.` : "Preparing the job sources...";
}
