import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCareerProfileFromExperience,
  buildExperienceFieldMetadata,
  buildProfileUpdateFromExtracted,
  calculateExperienceYears,
  clampExperienceYears,
  collectCredentialsFromExtracted,
  confidenceForCvReplacementField,
  inferCurrentCompany,
  mergeCareerProfileSections,
  normalizeExperienceEntries,
  normalizeExtractedData,
  parseEducationString,
  resolveCvReplacementStatus,
  validateSalary,
} from "../../supabase/functions/_shared/cv-profile-merge.ts";

describe("CV full-replacement contract", () => {
  it("normalizes per-field confidence and rejects out-of-range scores", () => {
    const extracted = normalizeExtractedData({
      fullName: "ABDULLAH",
      skills: ["PYTHON", "SQL"],
      fieldStatus: { fullName: "present", skills: "present", portfolioUrl: "missing" },
      fieldConfidence: { fullName: 0.72, skills: 1.4, portfolioUrl: -0.2 },
    });

    expect(extracted.fieldStatus).toEqual({ fullName: "present", skills: "present", portfolioUrl: "missing" });
    expect(extracted.fieldConfidence).toEqual({ fullName: 0.72, skills: 1, portfolioUrl: 0 });
  });

  it("atomically replaces and clears every CV-managed field while excluding email", () => {
    const migration = readFileSync(
      "supabase/migrations/20260723000100_cv_profile_replacement_queue.sql",
      "utf8",
    );

    for (const field of [
      "full_name", "phone", "location", "bio", "skills", "desired_roles",
      "experience_years", "education", "current_company", "portfolio_url",
      "github_url", "linkedin_url",
    ]) {
      expect(migration).toContain(`${field} =`);
    }
    expect(migration).not.toMatch(/\bemail\s*=/);
    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("'source', 'cv_upload'");
    expect(migration).toContain("'lastUpdated'");
  });

  it("treats extracted values as present when fieldStatus is omitted", () => {
    const extracted = normalizeExtractedData({
      fullName: "Abdullah Waheed",
      skills: ["Python", "SQL"],
      phone: "+44 1234 567890",
    });

    expect(resolveCvReplacementStatus(extracted, "fullName", "Abdullah Waheed")).toBe("present");
    expect(resolveCvReplacementStatus(extracted, "skills", extracted.skills)).toBe("present");
    expect(resolveCvReplacementStatus(extracted, "phone", "+44 1234 567890")).toBe("present");
    expect(resolveCvReplacementStatus(extracted, "portfolioUrl", "")).toBe("missing");
    expect(confidenceForCvReplacementField(extracted, "fullName", "Abdullah Waheed")).toBeGreaterThanOrEqual(0.55);
  });

  it("respects explicit missing status even when a stale value exists", () => {
    const extracted = normalizeExtractedData({
      portfolioUrl: "https://example.com",
      fieldStatus: { portfolioUrl: "missing" },
    });

    expect(resolveCvReplacementStatus(extracted, "portfolioUrl", "https://example.com")).toBe("missing");
  });

  it("automatically applies the complete replacement after analysis", () => {
    const analyzer = readFileSync("supabase/functions/analyze-cv/index.ts", "utf8");
    expect(analyzer).toContain('userClient.rpc("approve_cv_profile_replacement"');
    expect(analyzer).toContain('status: "approved"');
    expect(analyzer).not.toContain("requires explicit approval");
  });

  it("keeps service-role writes free of the user Authorization header", () => {
    const analyzer = readFileSync("supabase/functions/analyze-cv/index.ts", "utf8");

    // Privileged client must not bind the caller JWT (that forces RLS as authenticated).
    expect(analyzer).toMatch(/createClient\(supabaseUrl,\s*serviceRoleKey\)/);
    expect(analyzer).not.toMatch(
      /createClient\(\s*supabaseUrl,\s*(?:supabaseKey|serviceRoleKey)\s*,\s*\{\s*global:\s*\{\s*headers:\s*\{\s*Authorization:\s*authHeader/,
    );

    // Approve still needs auth.uid() via a user-scoped anon client.
    expect(analyzer).toMatch(/createClient\(supabaseUrl,\s*anonKey,\s*\{\s*global:\s*\{\s*headers:\s*\{\s*Authorization:\s*authHeader/);
    expect(analyzer).toContain('admin.from("cv_profile_replacements").insert');
    expect(analyzer).toContain('userClient.rpc("approve_cv_profile_replacement"');
  });
});

describe("CV field-extraction prompt contract (Abdullah-style variance)", () => {
  const analyzer = readFileSync("supabase/functions/analyze-cv/index.ts", "utf8");

  it("documents education synonyms, multi-line merge, and never-drop-for-dates", () => {
    expect(analyzer).toMatch(/Academic Background/);
    expect(analyzer).toMatch(/Qualifications/);
    expect(analyzer).toMatch(/multi-line/i);
    expect(analyzer).toMatch(/NEVER drop or reject education because dates look inconsistent/i);
    expect(analyzer).toMatch(/2022 — 2026 Completed/);
  });

  it("documents bio synonyms and positional fallback under contact", () => {
    expect(analyzer).toMatch(/Professional Summary/);
    expect(analyzer).toMatch(/Career Objective/);
    expect(analyzer).toMatch(/About Me/);
    expect(analyzer).toMatch(/2–4 sentence paragraph|2-4 sentence paragraph|short 2/);
    expect(analyzer).toContain("positionalBioCandidate");
  });

  it("requires typed experience with projects-as-experience and internship company patterns", () => {
    expect(analyzer).toMatch(/"type": "job \| internship \| project"/);
    expect(analyzer).toMatch(/projectsAsExperienceFallback/);
    expect(analyzer).toMatch(/Internship from \[Company\]/);
    expect(analyzer).toMatch(/Kaizen Hive/);
    expect(analyzer).toContain("internshipCompanyHits");
    expect(analyzer).toContain("buildCareerProfileFromExperience");
  });
});

describe("CV experience / company merge helpers", () => {
  it("normalizes experience types and keeps project + internship entries", () => {
    const experience = normalizeExperienceEntries([
      {
        title: "AI Job Application Automation Agent",
        description: "Built an agentic workflow",
        dates: "2024",
        type: "project",
      },
      {
        title: "Artificial Intelligence Internship",
        company: "Kaizen Hive",
        url: "http://program.kaizenhive.com/verify-certificate?id=abc",
        type: "internship",
      },
    ]);

    expect(experience).toHaveLength(2);
    expect(experience?.[0]).toMatchObject({ type: "project", title: "AI Job Application Automation Agent" });
    expect(experience?.[1]).toMatchObject({ type: "internship", company: "Kaizen Hive" });
  });

  it("infers currentCompany from internship experience and certification text", () => {
    expect(inferCurrentCompany({
      experience: [{ title: "AI Intern", company: "Kaizen Hive", type: "internship" }],
    })).toBe("Kaizen Hive");

    expect(inferCurrentCompany({
      certifications: [
        "Google IT Automation with Python",
        "Internship: Artifical Intelligence Internship from Kaizen Hive|http://program.kaizenhive.com/verify-certificate?id=1",
      ],
    })).toBe("Kaizen Hive");
  });

  it("maps bio from cvSummary and company from internship during profile fill", () => {
    const extracted = normalizeExtractedData({
      cvSummary: "AI engineer focused on agentic systems and Python automation.",
      education: "BS Computer Science | 2022 — 2026 Completed — Example University; Intermediate | 2020 — 2022 — Example College",
      experience: [
        { title: "Campus Portal", type: "project", dates: "2024", description: "Built a portal" },
        {
          title: "Artificial Intelligence Internship",
          company: "Kaizen Hive",
          type: "internship",
          url: "http://program.kaizenhive.com/verify-certificate?id=1",
        },
      ],
      certifications: [
        "Internship: Artifical Intelligence Internship from Kaizen Hive|http://program.kaizenhive.com/verify-certificate?id=1",
      ],
    });

    expect(extracted.currentCompany).toBe("Kaizen Hive");
    expect(extracted.experience).toHaveLength(2);
    expect(extracted.education).toContain("BS Computer Science | 2022 — 2026 Completed");

    const { updatePayload, filledKeys } = buildProfileUpdateFromExtracted({}, extracted);
    expect(updatePayload.bio).toBe(extracted.cvSummary);
    expect(updatePayload.current_company).toBe("Kaizen Hive");
    expect(updatePayload.education).toContain("2022 — 2026 Completed");
    expect(filledKeys).toEqual(expect.arrayContaining(["bio", "current_company", "education", "cv_summary"]));
  });

  it("builds career_profile experiences/projects from typed experience entries", () => {
    const fromCv = buildCareerProfileFromExperience([
      { title: "Agentic Resume Tool", type: "project", description: "• Scraped jobs\n• Ranked matches", dates: "2024" },
      {
        title: "Artificial Intelligence Internship",
        company: "Kaizen Hive",
        type: "internship",
        url: "http://program.kaizenhive.com/verify-certificate?id=1",
      },
    ], {
      education: "BS Computer Science | 2022 — 2026 Completed — Example University",
      credentials: [{
        title: "Artificial Intelligence Internship",
        issuer: "Kaizen Hive",
        verificationLink: "http://program.kaizenhive.com/verify-certificate?id=1",
        type: "certification",
      }],
    });

    expect(fromCv?.projects).toHaveLength(1);
    expect(fromCv?.experiences).toHaveLength(1);
    expect(fromCv?.experiences?.[0]).toMatchObject({
      company: "Kaizen Hive",
      employmentType: "Internship",
    });
    expect(fromCv?.projects?.[0]).toMatchObject({ name: "Agentic Resume Tool" });
    expect(fromCv?.education?.length).toBeGreaterThan(0);
    expect(fromCv?.achievements?.length).toBeGreaterThan(0);

    const merged = mergeCareerProfileSections(
      {
        version: 1,
        experiences: [{ id: "old", company: "Acme", title: "Dev" }],
        projects: [],
        education: [{ id: "edu", degree: "Old", institution: "Old U" }],
        achievements: [
          { id: "manual", title: "User Award", source: "user" },
          { id: "old-cv", title: "Old Cert", source: "cv" },
        ],
        references: [],
      },
      fromCv!,
    );
    expect(merged.experiences).toHaveLength(1);
    expect(merged.experiences?.[0]).toMatchObject({ company: "Kaizen Hive" });
    expect(merged.projects).toHaveLength(1);
    expect(merged.education?.length).toBeGreaterThan(0);
    expect(merged.education?.[0]).toMatchObject({ degree: expect.stringContaining("Computer Science") });
    // Manual credentials kept; prior CV-sourced credentials replaced.
    expect(merged.achievements?.some((a) => a.title === "User Award")).toBe(true);
    expect(merged.achievements?.some((a) => a.title === "Old Cert")).toBe(false);
    expect(merged.achievements?.some((a) => String(a.title).includes("Artificial Intelligence"))).toBe(true);
  });
});

describe("Education parsing + experience calc + validation", () => {
  it("parses pipe-separated education into structured rows", () => {
    const entries = parseEducationString(
      "BS Computer Science | 2022 — 2026 Completed|3.1cgpa\nExample University; Intermediate | 2020 — 2022 — Example College",
    );
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0]).toMatchObject({
      degree: expect.stringMatching(/Computer Science/i),
      startYear: "2022",
      endYear: "2026",
      status: "Completed",
    });
  });

  it("prefers explicit experience years and otherwise auto-calculates with a breakdown note", () => {
    const explicit = calculateExperienceYears({
      explicitYears: 2.5,
      experience: [{ title: "Intern", type: "internship", dates: "3 months" }],
    });
    expect(explicit).toMatchObject({ years: 2.5, source: "explicit" });
    expect(explicit.note).toMatch(/stated experience/i);

    const calculated = calculateExperienceYears({
      experience: [
        { title: "AI Intern", type: "internship", dates: "3 months", company: "Kaizen Hive" },
        { title: "Portal", type: "project", dates: "6 months" },
        { title: "Tool", type: "project", dates: "3 months" },
      ],
    });
    expect(calculated.source).toBe("calculated");
    expect(calculated.years).toBe(1);
    expect(calculated.note).toMatch(/Auto-calculated from:/);
    expect(calculated.note).toMatch(/internship/);
    expect(calculated.note).toMatch(/project/);
  });

  it("unions overlapping dated intervals instead of double-counting", () => {
    const result = calculateExperienceYears({
      experience: [
        { title: "A", type: "job", dates: "2024-01 – 2024-06" },
        { title: "B", type: "job", dates: "2024-03 – 2024-08" },
      ],
    });
    // Jan–Aug 2024 = 8 months ≈ 0.7 years
    expect(result.years).toBe(0.7);
  });

  it("clamps experience to 0–40 and validates salary > 10000", () => {
    expect(clampExperienceYears(41)).toMatchObject({ valid: false, message: expect.stringMatching(/incorrect/i) });
    expect(clampExperienceYears(-1)).toMatchObject({ valid: false });
    expect(clampExperienceYears(3.2)).toMatchObject({ valid: true, value: 3.2 });
    expect(validateSalary("10000")).toMatchObject({ valid: false, message: expect.stringMatching(/10,000/) });
    expect(validateSalary("$80,000")).toMatchObject({ valid: true, value: 80000 });
    expect(validateSalary("")).toMatchObject({ valid: true, value: null });
  });

  it("collects credentials from certifications and internship verify URLs", () => {
    const extracted = normalizeExtractedData({
      experience: [{
        title: "Artificial Intelligence Internship",
        company: "Kaizen Hive",
        type: "internship",
        url: "http://program.kaizenhive.com/verify-certificate?id=1",
      }],
      certifications: [
        "Google IT Automation with Python",
        "Internship: Artificial Intelligence Internship from Kaizen Hive|http://program.kaizenhive.com/verify-certificate?id=1",
      ],
      credentials: [{ title: "Dean List Award", issuer: "Uni", type: "award" }],
    });
    const credentials = collectCredentialsFromExtracted(extracted);
    expect(credentials.some((c) => /Google IT/i.test(c.title || ""))).toBe(true);
    expect(credentials.some((c) => /Dean List/i.test(c.title || ""))).toBe(true);
    expect(credentials.some((c) => /kaizenhive\.com\/verify/i.test(c.verificationLink || ""))).toBe(true);
  });

  it("stores experience calc note in field_metadata without a new column", () => {
    const meta = buildExperienceFieldMetadata({}, "Auto-calculated from: 1 internship (3mo)");
    expect(meta.experience_years).toMatchObject({
      calcNote: "Auto-calculated from: 1 internship (3mo)",
      source: "cv_upload",
    });
  });

  it("auto-calculates experienceYears during normalize when CV omits an explicit total", () => {
    const extracted = normalizeExtractedData({
      experienceYears: 0,
      fieldStatus: { experienceYears: "missing" },
      experience: [
        { title: "Intern", type: "internship", dates: "3 months", company: "Kaizen" },
        { title: "Side project", type: "project", dates: "9 months" },
      ],
      education: "BS Computer Science | 2022 — 2026 Completed — Example University",
    });
    expect(extracted.experienceYears).toBe(1);
    expect(extracted.experienceCalcNote).toMatch(/Auto-calculated/);
    expect(extracted.educationEntries?.length).toBeGreaterThan(0);
    expect(extracted.fieldStatus?.experienceYears).toBe("present");
  });
});

describe("analyze-cv prompt contract for education/credentials upgrade", () => {
  const analyzer = readFileSync("supabase/functions/analyze-cv/index.ts", "utf8");

  it("documents structured educationEntries and credentials schema", () => {
    expect(analyzer).toMatch(/educationEntries/);
    expect(analyzer).toMatch(/Completed \| Ongoing/);
    expect(analyzer).toMatch(/verificationLink/);
    expect(analyzer).toMatch(/certification \| award \| publication/);
    expect(analyzer).toMatch(/Awards, Publications, Licenses, Achievements/);
    expect(analyzer).toContain("buildExperienceFieldMetadata");
    expect(analyzer).toContain("collectCredentialsFromExtracted");
  });
});
