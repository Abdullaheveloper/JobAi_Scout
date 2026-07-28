import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import { toast } from "@/hooks/use-toast";
import {
  formatUsageCount,
  formatUsageLimitReset,
  showUsageLimitToast,
  usageLimitTitle,
  usageLimitToastMessage,
} from "@/lib/usage-limits-client";

describe("formatUsageCount", () => {
  it("shows used of max for the period scope", () => {
    expect(formatUsageCount(2, 2, "day", "Job Scraping")).toBe("You've used 2 of 2 today");
  });

  it("shows disabled copy when max is 0", () => {
    expect(formatUsageCount(0, 0, "day", "Form Fill")).toMatch(/disabled/i);
  });
});

describe("formatUsageLimitReset", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  it("shows relative hours and minutes within 24h", () => {
    const resetsAt = new Date(now.getTime() + (6 * 60 + 12) * 60_000).toISOString();
    expect(formatUsageLimitReset(resetsAt, "day", { now, locale: "en-US" })).toBe("Resets in 6h 12m");
  });

  it("shows tomorrow at time when reset is next calendar day and beyond 24h", () => {
    const earlyMorning = new Date("2026-07-28T01:00:00.000Z");
    const tomorrowAfternoon = new Date("2026-07-29T15:00:00.000Z");
    expect(formatUsageLimitReset(tomorrowAfternoon.toISOString(), "day", { now: earlyMorning, locale: "en-US" }))
      .toMatch(/^Resets tomorrow at /);
  });

  it("falls back to period hint without resetsAt", () => {
    expect(formatUsageLimitReset(null, "month", { now })).toBe("Try again next month.");
  });
});

describe("usageLimitTitle", () => {
  it("includes the feature name", () => {
    expect(usageLimitTitle("Voice Assistant")).toBe("Voice Assistant limit reached");
  });
});

describe("usageLimitToastMessage", () => {
  it("states daily limit and try again tomorrow", () => {
    const { title, description } = usageLimitToastMessage({
      code: "USAGE_LIMIT_REACHED",
      feature: "job_scraping",
      featureLabel: "Job Scraping",
      limit: 5,
      period: "day",
      used: 5,
    });
    expect(title).toMatch(/usage limit/i);
    expect(description).toBe(
      "You've reached your daily limit for Job Scraping. Try again tomorrow.",
    );
  });

  it("states feature disabled when limit is 0", () => {
    const { description } = usageLimitToastMessage({
      code: "USAGE_LIMIT_REACHED",
      feature: "form_fill",
      limit: 0,
      period: "day",
      used: 0,
    });
    expect(description).toMatch(/disabled/i);
    expect(description).toMatch(/Form Fill/);
  });

  it("uses translator reset hints when t is provided", () => {
    const t = (key: string, opts?: Record<string, unknown>) => {
      if (key === "usageLimits.toastTitle") return "Limit hit";
      if (key === "usageLimits.period_day") return "daily";
      if (key === "usageLimits.reset_day") return "Try again tomorrow.";
      if (key === "usageLimits.reached") {
        return `You've reached your ${opts?.period} limit for ${opts?.feature}. ${opts?.reset}`;
      }
      if (key.startsWith("admin.usageFeature_")) return String(opts?.defaultValue || key);
      return String(opts?.defaultValue || key);
    };
    const { title, description } = usageLimitToastMessage(
      {
        code: "USAGE_LIMIT_REACHED",
        feature: "automation",
        limit: 2,
        period: "day",
        used: 2,
      },
      t,
    );
    expect(title).toBe("Limit hit");
    expect(description).toContain("Automation");
    expect(description).toContain("Try again tomorrow.");
  });
});

describe("showUsageLimitToast", () => {
  beforeEach(() => {
    vi.mocked(toast).mockClear();
  });

  it("shows a medium auto-dismissible toast (~7s)", () => {
    showUsageLimitToast({
      code: "USAGE_LIMIT_REACHED",
      feature: "voice_assistant",
      limit: 1,
      period: "day",
      used: 1,
    });
    expect(toast).toHaveBeenCalledOnce();
    expect(vi.mocked(toast).mock.calls[0][0]).toMatchObject({
      duration: 7000,
      title: expect.any(String),
      description: expect.stringMatching(/Voice Assistant/),
    });
  });
});
