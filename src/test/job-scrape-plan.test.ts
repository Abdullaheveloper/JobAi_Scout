import { describe, expect, it } from "vitest";
import { ADAPTER_MAX_COLLECTION_MS, EXTENDED_ADAPTER_MAX_COLLECTION_MS, JOB_ADAPTER_ORDER, adapterCollectionTimeout, runSequentialAdapters } from "../../supabase/functions/_shared/job-scrape-plan.ts";

describe("runSequentialAdapters", () => {
  it("allows RSS and company careers more time without extending provider searches", () => {
    expect(adapterCollectionTimeout("linkedin")).toBe(ADAPTER_MAX_COLLECTION_MS);
    expect(adapterCollectionTimeout("indeed")).toBe(ADAPTER_MAX_COLLECTION_MS);
    expect(adapterCollectionTimeout("rss")).toBe(EXTENDED_ADAPTER_MAX_COLLECTION_MS);
    expect(adapterCollectionTimeout("company_career")).toBe(EXTENDED_ADAPTER_MAX_COLLECTION_MS);
  });

  it("runs sources in the exact required order without overlap", async () => {
    const events: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const adapters = JOB_ADAPTER_ORDER.map((key) => ({
      key,
      run: async () => {
        events.push(`start:${key}`);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        active -= 1;
        events.push(`end:${key}`);
        return key;
      },
    }));

    const results = await runSequentialAdapters(adapters);

    expect(maximumActive).toBe(1);
    expect(events).toEqual([
      "start:linkedin", "end:linkedin",
      "start:indeed", "end:indeed",
      "start:rss", "end:rss",
      "start:company_career", "end:company_career",
    ]);
    expect(results.map((result) => result.status)).toEqual(["completed", "completed", "completed", "completed"]);
  });

  it("records one failure and continues with every later source", async () => {
    const attempted: string[] = [];
    const adapters = JOB_ADAPTER_ORDER.map((key) => ({
      key,
      run: async () => {
        attempted.push(key);
        if (key === "indeed") throw new Error("rate limited");
        return key;
      },
    }));

    const results = await runSequentialAdapters(adapters);

    expect(attempted).toEqual([...JOB_ADAPTER_ORDER]);
    expect(results.map(({ key, status }) => ({ key, status }))).toEqual([
      { key: "linkedin", status: "completed" },
      { key: "indeed", status: "failed" },
      { key: "rss", status: "completed" },
      { key: "company_career", status: "completed" },
    ]);
  });
});
