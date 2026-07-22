import { describe, expect, it } from "vitest";
import { buildLatestCvProfileSync, type ExtractedData } from "../../supabase/functions/_shared/cv-profile-merge.ts";

describe("buildLatestCvProfileSync", () => {
  it("replaces confirmed CV facts and clears confirmed missing AI-derived facts", () => {
    const extracted: ExtractedData = {
      fullName: "New Name",
      skills: ["TypeScript"],
      fieldStatus: { fullName: "present", phone: "missing", skills: "present" },
    };
    const sync = buildLatestCvProfileSync({
      full_name: "Old Name",
      phone: "03153217679",
      skills: ["React"],
      data_sources: { full_name: "ai", phone: "ai", skills: "ai" },
    }, extracted);

    expect(sync.updatePayload).toMatchObject({ full_name: "New Name", phone: null, skills: ["TypeScript"] });
    expect(sync.updatedKeys).toEqual(["full_name", "skills"]);
    expect(sync.clearedKeys).toEqual(["phone"]);
  });

  it("preserves preferences and leaves uncertain fields untouched", () => {
    const sync = buildLatestCvProfileSync({
      phone: "03153217679",
      desired_roles: ["Frontend Developer"],
      location: "Lahore",
      data_sources: { phone: "ai", desired_roles: "user", location: "user" },
    }, {
      fieldStatus: { phone: "uncertain" },
    });

    expect(sync.updatePayload).not.toHaveProperty("phone");
    expect(sync.updatePayload).not.toHaveProperty("desired_roles");
    expect(sync.updatePayload).not.toHaveProperty("location");
    expect(sync.uncertainKeys).toContain("phone");
  });
});
