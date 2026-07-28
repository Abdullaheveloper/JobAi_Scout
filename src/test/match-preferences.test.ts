import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIN_MATCH_THRESHOLD,
  MATCH_CATEGORIES,
  filterJobsByThreshold,
  normalizeMatchPreferences,
  resolveEffectiveWeights,
  shouldShowMatchPreferencesGate,
  sumMatchWeights,
  validateMatchPreferences,
} from "@/lib/match-preferences";
import { isVisibleJobMatch } from "@/lib/job-scrape";
import { calculateJobMatch } from "../../supabase/functions/_shared/job-match-scoring.ts";
import type { NormalizedJob } from "../../supabase/functions/_shared/job-types.ts";

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    title: "React Developer",
    company: "Example Labs",
    location: "Lahore, Pakistan",
    description: "Build frontend products with React and TypeScript. Requires 2 years of experience. BS Computer Science preferred. Salary range listed.",
    skills: ["React", "TypeScript"],
    job_type: "full-time",
    work_mode: "hybrid",
    experience_level: "mid-level",
    salary_min: 80000,
    salary_max: 120000,
    salary_currency: "PKR",
    source: "linkedin_apify",
    source_job_id: "job-1",
    source_url: "https://example.com/jobs/1",
    recruiter_id: null,
    posted_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

const baseProfile = {
  skills: ["React", "TypeScript"],
  desired_roles: ["Frontend Developer"],
  location: "Lahore",
  experience_years: 3,
  education: "Computer Science",
  expected_salary: "100000",
};

describe("match preferences validation", () => {
  it("rejects a total of 85% with a clear sum_not_100 code", () => {
    const result = validateMatchPreferences({ skills: 50, location: 35 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("sum_not_100");
      expect(result.total).toBe(85);
    }
  });

  it("accepts 100% with only 2 of 6 categories when Skills > 20", () => {
    const weights = { skills: 55, location: 45 };
    expect(Object.keys(weights).length).toBeLessThan(MATCH_CATEGORIES.length);
    expect(validateMatchPreferences(weights)).toEqual({ ok: true });
    expect(sumMatchWeights(weights)).toBe(100);
  });

  it("rejects Skills at or below 20%", () => {
    expect(validateMatchPreferences({ skills: 20, location: 80 }).ok).toBe(false);
    expect(validateMatchPreferences({ skills: 15, location: 85 }).ok).toBe(false);
    const low = validateMatchPreferences({ skills: 20, location: 80 });
    if (!low.ok) expect(low.code).toBe("skills_too_low");
  });

  it("accepts Skills strictly above 20% (21% boundary)", () => {
    expect(validateMatchPreferences({ skills: 21, location: 79 })).toEqual({ ok: true });
  });

  it("requires Skills to be present", () => {
    const result = validateMatchPreferences({ location: 60, experience: 40 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("skills_required");
  });
});

describe("first-run gate", () => {
  it("shows the gate for new users who have not set preferences", () => {
    const prefs = normalizeMatchPreferences({
      has_set_match_preferences: false,
      match_weights: {},
      min_match_threshold: 40,
    });
    expect(shouldShowMatchPreferencesGate(prefs)).toBe(true);
  });

  it("does not show the gate again after a successful save flag", () => {
    const prefs = normalizeMatchPreferences({
      has_set_match_preferences: true,
      match_weights: { skills: 40, location: 60 },
      min_match_threshold: 50,
    });
    expect(shouldShowMatchPreferencesGate(prefs)).toBe(false);
  });

  it("treats missing/pre-migration profile fields as unset (gate on, equal weights, 40 threshold)", () => {
    const prefs = normalizeMatchPreferences(null);
    expect(prefs.hasSetMatchPreferences).toBe(false);
    expect(prefs.minMatchThreshold).toBe(DEFAULT_MIN_MATCH_THRESHOLD);
    expect(shouldShowMatchPreferencesGate(prefs)).toBe(true);
    const equal = resolveEffectiveWeights({}, false);
    expect(sumMatchWeights(equal)).toBe(100);
    expect(Object.keys(equal).sort()).toEqual([...MATCH_CATEGORIES.map((c) => c.key)].sort());
  });
});

describe("weighted match scoring", () => {
  it("produces different orderings for the same job set under two weight distributions", () => {
    const skillHeavyJob = job({
      title: "React Engineer",
      skills: ["React", "TypeScript", "CSS"],
      location: "Karachi",
      description: "React TypeScript CSS specialist. No degree listed.",
      salary_min: null,
      salary_max: null,
    });
    const locationHeavyJob = job({
      title: "Office Coordinator",
      skills: ["Excel"],
      location: "Lahore, Pakistan",
      description: "On-site coordinator in Lahore.",
      salary_min: null,
      salary_max: null,
    });
    const profile = { ...baseProfile, skills: ["React", "TypeScript"], location: "Lahore" };

    const skillsFirst = {
      skills: 70,
      location: 30,
    };
    const locationFirst = {
      skills: 25,
      location: 75,
    };

    const skillsOrder = [skillHeavyJob, locationHeavyJob]
      .map((item) => ({
        title: item.title,
        score: calculateJobMatch(item, {
          query: "React",
          profile,
          matchWeights: skillsFirst,
          hasSetMatchPreferences: true,
        }).score,
      }))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.title);

    const locationOrder = [skillHeavyJob, locationHeavyJob]
      .map((item) => ({
        title: item.title,
        score: calculateJobMatch(item, {
          query: "React",
          profile,
          matchWeights: locationFirst,
          hasSetMatchPreferences: true,
        }).score,
      }))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.title);

    expect(skillsOrder[0]).toBe("React Engineer");
    expect(locationOrder[0]).toBe("Office Coordinator");
    expect(skillsOrder).not.toEqual(locationOrder);
  });

  it("falls back to equal category weights when preferences are unset", () => {
    const result = calculateJobMatch(job(), {
      query: "React Developer",
      location: "Lahore",
      profile: baseProfile,
      hasSetMatchPreferences: false,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Object.keys(result.explanation.formula).length).toBe(MATCH_CATEGORIES.length);
  });
});

describe("threshold filtering", () => {
  const jobs = [
    { id: "a", match_score: 35 },
    { id: "b", match_score: 40 },
    { id: "c", match_score: 55 },
    { id: "d", match_score: 70 },
  ];

  it("raising the threshold reduces how many jobs appear", () => {
    expect(filterJobsByThreshold(jobs, 40).map((j) => j.id)).toEqual(["b", "c", "d"]);
    expect(filterJobsByThreshold(jobs, 60).map((j) => j.id)).toEqual(["d"]);
  });

  it("lowering the threshold includes more jobs", () => {
    expect(filterJobsByThreshold(jobs, 30).map((j) => j.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("isVisibleJobMatch respects the caller's threshold (exclusion copy uses real number)", () => {
    expect(isVisibleJobMatch(39, 40)).toBe(false);
    expect(isVisibleJobMatch(40, 40)).toBe(true);
    expect(isVisibleJobMatch(49, 50)).toBe(false);
    expect(isVisibleJobMatch(50, 50)).toBe(true);
    const threshold = 55;
    const excluded = jobs.filter((j) => !isVisibleJobMatch(j.match_score, threshold));
    const message = `Excluded: ${excluded.length} below ${threshold}% match`;
    expect(message).toBe("Excluded: 2 below 55% match");
  });
});
