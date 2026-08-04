import { describe, expect, it, vi } from "vitest";
import {
  buildUsageLimitError,
  countUsageInWindow,
  enforceUsageLimit,
  isAllowedByLimit,
  nextAvailableAt,
  periodDurationMs,
  resolveUsageLimit,
  type UsageLimitRow,
} from "../../supabase/functions/_shared/usage-limits.ts";

const USER = "user-1";
const OTHER = "user-2";

function makeDb(opts: {
  limits?: UsageLimitRow[];
  logs?: Array<{ created_at: string }>;
  insertError?: { message: string } | null;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  const limits = opts.limits ?? [];
  const logs = opts.logs ?? [];

  return {
    inserts,
    admin: {
      from(table: string) {
        if (table === "feature_usage_limits") {
          return {
            select() {
              return {
                or() {
                  return Promise.resolve({ data: limits, error: null });
                },
              };
            },
          };
        }
        if (table === "feature_usage_log") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        gte() {
                          return Promise.resolve({ data: logs, error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
            insert(row: Record<string, unknown>) {
              inserts.push(row);
              return {
                select() {
                  return {
                    single() {
                      if (opts.insertError) {
                        return Promise.resolve({ data: null, error: opts.insertError });
                      }
                      return Promise.resolve({
                        data: { id: `log-${inserts.length}` },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    },
  };
}

describe("resolveUsageLimit", () => {
  it("prefers user override over global default", () => {
    const rows: UsageLimitRow[] = [
      { user_id: null, feature: "job_scraping", max_count: 20, period: "day" },
      { user_id: USER, feature: "job_scraping", max_count: 2, period: "day" },
    ];
    expect(resolveUsageLimit("job_scraping", USER, rows)).toEqual({
      maxCount: 2,
      period: "day",
      source: "user",
    });
  });

  it("falls back to global default when override is removed", () => {
    const rows: UsageLimitRow[] = [
      { user_id: null, feature: "form_fill", max_count: 50, period: "month" },
      { user_id: OTHER, feature: "form_fill", max_count: 1, period: "day" },
    ];
    expect(resolveUsageLimit("form_fill", USER, rows)).toEqual({
      maxCount: 50,
      period: "month",
      source: "global",
    });
  });

  it("warns when falling through to unlimited", () => {
    const warn = vi.fn();
    const resolved = resolveUsageLimit("voice_bot", USER, [], warn);
    expect(resolved.source).toBe("unlimited");
    expect(Number.isFinite(resolved.maxCount)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toMatch(/allowing unlimited/i);
  });
});

describe("rolling window", () => {
  it("counts only events inside the rolling period", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const timestamps = [
      "2026-07-28T10:00:00.000Z", // in day
      "2026-07-27T11:00:00.000Z", // out of day
      "2026-07-01T00:00:00.000Z", // in month
    ];
    expect(countUsageInWindow(timestamps, now, "day")).toBe(1);
    expect(countUsageInWindow(timestamps, now, "month")).toBe(3);
  });

  it("computes next available from oldest blocking event", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const timestamps = [
      "2026-07-28T08:00:00.000Z",
      "2026-07-28T09:00:00.000Z",
    ];
    const next = nextAvailableAt(timestamps, now, "day", 2);
    expect(next?.toISOString()).toBe(
      new Date(new Date("2026-07-28T08:00:00.000Z").getTime() + periodDurationMs("day")).toISOString(),
    );
  });
});

describe("enforceUsageLimit (server-side)", () => {
  it("blocks the 3rd attempt when limit is 2/day", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin, inserts } = makeDb({
      limits: [{ user_id: USER, feature: "job_scraping", max_count: 2, period: "day" }],
      logs: [
        { created_at: "2026-07-28T10:00:00.000Z" },
        { created_at: "2026-07-28T11:00:00.000Z" },
      ],
    });

    const result = await enforceUsageLimit(admin, USER, "job_scraping", { now, record: true });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.status).toBe(429);
    expect(result.body.code).toBe("USAGE_LIMIT_REACHED");
    expect(result.body.limit).toBe(2);
    expect(result.body.period).toBe("day");
    expect(result.body.feature).toBe("job_scraping");
    expect(inserts).toHaveLength(0);
  });

  it("blocks immediately when limit is 0", async () => {
    const { admin, inserts } = makeDb({
      limits: [{ user_id: USER, feature: "voice_bot", max_count: 0, period: "day" }],
      logs: [],
    });
    const result = await enforceUsageLimit(admin, USER, "voice_bot", { record: true });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.body.limit).toBe(0);
    expect(result.body.error).toMatch(/disabled/i);
    expect(inserts).toHaveLength(0);
  });

  it("allows and records when under the limit", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin, inserts } = makeDb({
      limits: [{ user_id: null, feature: "automation", max_count: 2, period: "day" }],
      logs: [{ created_at: "2026-07-28T10:00:00.000Z" }],
    });
    const result = await enforceUsageLimit(admin, USER, "automation", { now, record: true });
    expect(result.allowed).toBe(true);
    expect(inserts).toEqual([{ user_id: USER, feature: "automation" }]);
  });

  it("uses global default after user override is absent (not unlimited)", async () => {
    const warn = vi.fn();
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin } = makeDb({
      limits: [{ user_id: null, feature: "form_fill", max_count: 1, period: "day" }],
      logs: [{ created_at: "2026-07-28T11:00:00.000Z" }],
    });
    const result = await enforceUsageLimit(admin, USER, "form_fill", { now, record: false, warn });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.body.limit).toBe(1);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("enforces different per-user overrides independently (each user can have distinct limits)", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const sharedLimits: UsageLimitRow[] = [
      { user_id: null, feature: "job_scraping", max_count: 20, period: "day" },
      { user_id: USER, feature: "job_scraping", max_count: 2, period: "day" },
      { user_id: OTHER, feature: "job_scraping", max_count: 5, period: "day" },
    ];
    const twoUses = [
      { created_at: "2026-07-28T10:00:00.000Z" },
      { created_at: "2026-07-28T11:00:00.000Z" },
    ];

    // User A (limit 2) is blocked after 2 uses…
    const { admin: adminA } = makeDb({ limits: sharedLimits, logs: twoUses });
    const blocked = await enforceUsageLimit(adminA, USER, "job_scraping", { now, record: true });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.body.limit).toBe(2);
      expect(blocked.body.code).toBe("USAGE_LIMIT_REACHED");
    }

    // …while User B (limit 5) with the same usage count is still allowed.
    const { admin: adminB, inserts } = makeDb({ limits: sharedLimits, logs: twoUses });
    const allowed = await enforceUsageLimit(adminB, OTHER, "job_scraping", { now, record: true });
    expect(allowed.allowed).toBe(true);
    if (allowed.allowed) {
      expect(allowed.resolved.source).toBe("user");
      expect(allowed.resolved.maxCount).toBe(5);
    }
    expect(inserts).toEqual([{ user_id: OTHER, feature: "job_scraping" }]);
  });

  it("resolveUsageLimit returns distinct maxCount per user for the same feature", () => {
    const rows: UsageLimitRow[] = [
      { user_id: null, feature: "voice_bot", max_count: 100, period: "day" },
      { user_id: USER, feature: "voice_bot", max_count: 3, period: "day" },
      { user_id: OTHER, feature: "voice_bot", max_count: 50, period: "month" },
    ];
    expect(resolveUsageLimit("voice_bot", USER, rows)).toEqual({
      maxCount: 3,
      period: "day",
      source: "user",
    });
    expect(resolveUsageLimit("voice_bot", OTHER, rows)).toEqual({
      maxCount: 50,
      period: "month",
      source: "user",
    });
    expect(resolveUsageLimit("voice_bot", "user-3", rows)).toEqual({
      maxCount: 100,
      period: "day",
      source: "global",
    });
  });

  it("records form_fill when record:true (fill-attempt metering)", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin, inserts } = makeDb({
      limits: [{ user_id: null, feature: "form_fill", max_count: 50, period: "day" }],
      logs: [],
    });
    const result = await enforceUsageLimit(admin, USER, "form_fill", { now, record: true });
    expect(result.allowed).toBe(true);
    expect(inserts).toEqual([{ user_id: USER, feature: "form_fill" }]);
  });

  it("throws when insert returns no row (silent RLS block)", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const admin = {
      from(table: string) {
        if (table === "feature_usage_limits") {
          return {
            select() {
              return {
                or() {
                  return Promise.resolve({
                    data: [{ user_id: null, feature: "form_fill", max_count: 50, period: "day" }],
                    error: null,
                  });
                },
              };
            },
          };
        }
        if (table === "feature_usage_log") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        gte() {
                          return Promise.resolve({ data: [], error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
            insert() {
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    await expect(
      enforceUsageLimit(admin, USER, "form_fill", { now, record: true }),
    ).rejects.toThrow(/insert returned no row/i);
  });

  it("does not insert when record:false (profile-load style check)", async () => {
    // extension-profile must not call this at all; if a read-only status check
    // ever uses record:false, it must not consume quota.
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin, inserts } = makeDb({
      limits: [{ user_id: null, feature: "form_fill", max_count: 50, period: "day" }],
      logs: [],
    });
    const result = await enforceUsageLimit(admin, USER, "form_fill", { now, record: false });
    expect(result.allowed).toBe(true);
    expect(inserts).toHaveLength(0);
  });

  it("prefers atomic RPC when admin.rpc is available", async () => {
    const warn = vi.fn();
    const rpc = vi.fn(async () => ({
      data: {
        allowed: false,
        used: 1,
        source: "global",
        maxCount: 1,
        period: "day",
        resetsAt: "2026-07-29T11:00:00.000Z",
      },
      error: null,
    }));
    const admin = {
      from() {
        throw new Error("from() should not be used when rpc is present");
      },
      rpc,
    };
    const result = await enforceUsageLimit(admin, USER, "form_fill", {
      now: new Date("2026-07-28T12:00:00.000Z"),
      record: true,
      warn,
    });
    expect(rpc).toHaveBeenCalledWith("enforce_and_record_feature_usage", {
      p_user_id: USER,
      p_feature: "form_fill",
      p_record: true,
      p_now: "2026-07-28T12:00:00.000Z",
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.body.code).toBe("USAGE_LIMIT_REACHED");
      expect(result.body.limit).toBe(1);
      expect(result.body.feature).toBe("form_fill");
    }
  });
});

describe("isAllowedByLimit / error payload", () => {
  it("treats max 0 as blocked and builds a clear error", () => {
    expect(isAllowedByLimit(0, 0)).toBe(false);
    const body = buildUsageLimitError({
      feature: "job_scraping",
      limit: 2,
      period: "day",
      used: 2,
      resetsAt: new Date("2026-07-29T08:00:00.000Z"),
    });
    expect(body.error).toMatch(/Job Scraping/);
    expect(body.error).toMatch(/daily limit/i);
  });
});
