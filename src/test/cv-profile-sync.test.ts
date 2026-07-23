import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeExtractedData } from "../../supabase/functions/_shared/cv-profile-merge.ts";

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

  it("creates one pending proposal and exposes confidence-driven review data", () => {
    const migration = readFileSync(
      "supabase/migrations/20260723000100_cv_profile_replacement_queue.sql",
      "utf8",
    );
    expect(migration).toContain("one_pending_cv_profile_replacement_per_user");
    expect(migration).toContain("field_confidence JSONB");
    expect(migration).toContain("diff JSONB");
    expect(migration).toContain("approve_cv_profile_replacement");
  });
});
