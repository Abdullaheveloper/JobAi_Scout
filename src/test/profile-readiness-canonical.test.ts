import { describe, expect, it } from "vitest";
import { profileReadinessPercent } from "@/lib/profile-readiness";

describe("canonical profile readiness", () => {
  const localItems = [
    { key: "name", label: "Name", done: true },
    { key: "portfolio", label: "Portfolio", done: false },
  ];

  it("uses the live database score across all surfaces", () => {
    expect(profileReadinessPercent(localItems, 100)).toBe(100);
    expect(profileReadinessPercent(localItems, 85)).toBe(85);
  });

  it("uses the checklist only as a backward-compatible fallback", () => {
    expect(profileReadinessPercent(localItems)).toBe(50);
  });
});
