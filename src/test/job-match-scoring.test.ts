import { describe, expect, it } from "vitest";
import { calculateJobMatch } from "../../supabase/functions/_shared/job-match-scoring.ts";
import type { NormalizedJob } from "../../supabase/functions/_shared/job-types.ts";

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    title: "React Developer",
    company: "Example Labs",
    location: "Lahore, Pakistan",
    description: "Build frontend products with React and TypeScript. Requires 2 years of experience.",
    skills: ["React", "TypeScript"],
    job_type: "full-time",
    work_mode: "hybrid",
    experience_level: "mid-level",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    source: "linkedin_apify",
    source_job_id: "job-1",
    source_url: "https://example.com/jobs/1",
    recruiter_id: null,
    posted_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateJobMatch", () => {
  it("applies the documented 35/30/20/10/5 weights", () => {
    const result = calculateJobMatch(job(), {
      query: "React Developer",
      location: "Lahore",
      profile: { skills: ["React", "TypeScript"], desired_roles: ["Frontend Developer"], location: "Lahore", experience_years: 3 },
    });

    expect(result.score).toBe(100);
    expect(result.explanation.formula).toEqual({ title: 35, skills: 30, keywords: 20, location: 10, experience: 5 });
  });

  it("does not let unrelated profile terms dilute an exact user query", () => {
    const result = calculateJobMatch(job({ description: "React product work" }), {
      query: "React",
      location: "Lahore",
      profile: { skills: ["Python", "Go", "Rust"], desired_roles: ["Data Analyst"], experience_years: 3 },
    });

    expect(result.explanation.formula.title).toBe(35);
    expect(result.explanation.formula.keywords).toBe(20);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("always returns an integer in the 0 to 100 range", () => {
    const result = calculateJobMatch(job({ title: "Accountant", description: "Ledger reconciliation", skills: [] }), {
      query: "Machine Learning Engineer",
      location: "Karachi",
      profile: { skills: ["Python"], desired_roles: ["AI Engineer"], experience_years: 0 },
    });

    expect(Number.isInteger(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeLessThan(60);
  });
});
