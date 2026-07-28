import { describe, expect, it, vi } from "vitest";
import { runUsageGuardedScrape } from "../../supabase/functions/_shared/scrape-usage-guard.ts";
import type { UsageLimitRow } from "../../supabase/functions/_shared/usage-limits.ts";

const USER = "user-scrape-1";

function makeDb(opts: {
  limits?: UsageLimitRow[];
  logs?: Array<{ created_at: string }>;
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

describe("runUsageGuardedScrape check order", () => {
  it("short-circuits with USAGE_LIMIT_REACHED and never invokes scrape/match when at limit", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin, inserts } = makeDb({
      limits: [{ user_id: USER, feature: "job_scraping", max_count: 1, period: "day" }],
      logs: [{ created_at: "2026-07-28T10:00:00.000Z" }],
    });
    const run = vi.fn(async () => ({ status: "completed" as const, session: { id: "s1" } }));

    const outcome = await runUsageGuardedScrape({
      admin,
      userId: USER,
      feature: "job_scraping",
      now,
      run,
    });

    expect(outcome.allowed).toBe(false);
    if (outcome.allowed) return;
    expect(outcome.status).toBe(429);
    expect(outcome.body.code).toBe("USAGE_LIMIT_REACHED");
    expect(outcome.body.feature).toBe("job_scraping");
    expect(run).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("blocks automation-triggered scrapes before orchestration when automation limit is hit", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin } = makeDb({
      limits: [{ user_id: USER, feature: "automation", max_count: 0, period: "day" }],
      logs: [],
    });
    const run = vi.fn(async () => ({ status: "completed" as const, session: { id: "s2" } }));

    const outcome = await runUsageGuardedScrape({
      admin,
      userId: USER,
      feature: "automation",
      now,
      run,
    });

    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) {
      expect(outcome.body.code).toBe("USAGE_LIMIT_REACHED");
      expect(outcome.body.feature).toBe("automation");
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("runs scrape then records usage only when under the limit", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const { admin, inserts } = makeDb({
      limits: [{ user_id: null, feature: "job_scraping", max_count: 5, period: "day" }],
      logs: [],
    });
    const run = vi.fn(async () => ({ status: "completed" as const, session: { id: "s3" } }));

    const outcome = await runUsageGuardedScrape({
      admin,
      userId: USER,
      feature: "job_scraping",
      now,
      run,
    });

    expect(outcome.allowed).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(inserts).toEqual([{ user_id: USER, feature: "job_scraping" }]);
  });

  it("does not record usage for conflict / no_query (session never started)", async () => {
    const { admin, inserts } = makeDb({
      limits: [{ user_id: null, feature: "job_scraping", max_count: 5, period: "day" }],
      logs: [],
    });
    const run = vi.fn(async () => ({ status: "conflict" as const, session: { id: "busy" } }));

    const outcome = await runUsageGuardedScrape({
      admin,
      userId: USER,
      feature: "job_scraping",
      run,
    });

    expect(outcome.allowed).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(inserts).toHaveLength(0);
  });
});
