import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve("src/pages/JobBoard.tsx"), "utf8");
const navigation = readFileSync(resolve("src/components/DashboardLayout.tsx"), "utf8");
const routes = readFileSync(resolve("src/App.tsx"), "utf8");
const database = readFileSync(resolve("supabase/migrations/20260803000500_unified_job_search.sql"), "utf8");

describe("unified Search Job module", () => {
  it("uses one navigation destination and redirects the retired recruiter-jobs URL", () => {
    expect(navigation).toContain('t("nav.searchJob"');
    expect(navigation).not.toContain('url: "/dashboard/recruiter-jobs"');
    expect(routes).toContain('<Navigate to="/dashboard/jobs" replace />');
  });

  it("switches between database mode and current-session-only scraper mode", () => {
    expect(page).toContain('scraping && scrapeSession?.id ? "search_scrape_session_jobs" : "search_jobs_unified"');
    expect(page).toContain("setCollectedJobs([])");
    expect(page).toContain("setScrapeSession(null)");
    expect(page).toContain("onClick={scraping ? handleStopScraping : handleScrapeJobs}");
    expect(page).not.toMatch(/onKeyDown=\{[^}]*handleScrapeJobs/s);
  });

  it("combines recruiter and saved scraped jobs, calculates scores, and applies all filters", () => {
    expect(database).toContain("posting.recruiter_id IS NOT NULL OR saved.session_id IS NOT NULL");
    expect(database).toContain("profile_job_match_score");
    expect(database).toContain("viewer_score >= threshold");
    for (const filter of ["p_title", "p_company", "p_location", "p_job_type", "p_experience_level", "p_salary_min", "p_salary_max", "p_work_mode", "p_source_type", "p_posted_days", "p_min_match_score"]) {
      expect(database).toContain(filter);
    }
  });
});
