import { describe, expect, it } from "vitest";
import { isScrapeSessionActive, isVisibleJobMatch, parseAdapterStatuses, runningAdapterPosition, scrapeCompletionMessage, type JobScrapeSession } from "@/lib/job-scrape";

function session(overrides: Partial<JobScrapeSession> = {}): JobScrapeSession {
  return {
    adapter_errors: {},
    adapter_statuses: { linkedin: "completed", indeed: "running", rss: "waiting", company_career: "waiting" },
    completed_at: null,
    created_at: "2026-07-20T00:00:00.000Z",
    current_adapter: "indeed",
    id: "session-1",
    location: null,
    search_query: "React",
    session_status: "running",
    started_at: "2026-07-20T00:00:00.000Z",
    total_jobs_displayed: 25,
    total_jobs_saved: 37,
    total_jobs_scraped: 42,
    updated_at: "2026-07-20T00:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  };
}

describe("job scrape UI state", () => {
  it("parses source states and reports the active position", () => {
    const current = session();
    expect(parseAdapterStatuses(current.adapter_statuses)).toEqual({ linkedin: "completed", indeed: "running", rss: "waiting", company_career: "waiting" });
    expect(isScrapeSessionActive(current)).toBe(true);
    expect(runningAdapterPosition(current)).toBe(2);
  });

  it("preserves timeout and manual-stop badge states", () => {
    expect(parseAdapterStatuses({
      linkedin: "timed_out",
      indeed: "completed",
      rss: "stopped",
      company_career: "stopped",
    })).toEqual({
      linkedin: "timed_out",
      indeed: "completed",
      rss: "stopped",
      company_career: "stopped",
    });
  });

  it("uses the required completion and partial-completion messages", () => {
    expect(scrapeCompletionMessage(session({ session_status: "completed", current_adapter: null }))).toBe("Job scraping completed. 25 matching jobs found.");
    expect(scrapeCompletionMessage(session({ session_status: "partially_completed", current_adapter: null }))).toContain("some source errors");
  });

  it("hides 39% jobs and includes the exact 40% boundary", () => {
    expect(isVisibleJobMatch(39)).toBe(false);
    expect(isVisibleJobMatch(40)).toBe(true);
    expect(isVisibleJobMatch(100)).toBe(true);
  });
});
