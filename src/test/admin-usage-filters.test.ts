import { describe, expect, it } from "vitest";
import { matchesUsageFilters, normalizedRatio } from "@/lib/admin-usage-filters";

const user = {
  fullName: "Abdullah Waheed",
  email: "abdullah@gmail.com",
  features: [
    { feature: "job_scraping" as const, used: 1, maxCount: 4 },
    { feature: "form_fill" as const, used: 0, maxCount: 10 },
    { feature: "chat_bot" as const, used: 5, maxCount: 5 },
    { feature: "voice_bot" as const, used: 1, maxCount: 2 },
    { feature: "automation" as const, used: 0, maxCount: null },
  ],
};

describe("admin usage real-time filters", () => {
  it("matches partial name and email case-insensitively", () => {
    expect(matchesUsageFilters(user, "AbD", {})).toBe(true);
    expect(matchesUsageFilters(user, "ABDULLAH@GMAIL", {})).toBe(true);
    expect(matchesUsageFilters(user, "rehman", {})).toBe(false);
  });

  it("requires exact used/limit ratios and combines filters", () => {
    expect(matchesUsageFilters(user, "abd", { job_scraping: "1 / 4", voice_bot: "1/2" })).toBe(true);
    expect(matchesUsageFilters(user, "abd", { chat_bot: "5/5", form_fill: "0/10" })).toBe(true);
    expect(matchesUsageFilters(user, "abd", { job_scraping: "1/5" })).toBe(false);
    expect(matchesUsageFilters(user, "abd", { automation: "0/10" })).toBe(false);
  });

  it("does not apply an empty ratio and rejects incomplete ratios", () => {
    expect(normalizedRatio("  ")).toBeNull();
    expect(normalizedRatio("1/4")).toBe("1/4");
    expect(matchesUsageFilters(user, "", { job_scraping: "1" })).toBe(false);
  });
});
