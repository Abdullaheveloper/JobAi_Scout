import { describe, expect, it } from "vitest";
import { ADAPTER_MAX_COLLECTION_MS, JOB_ADAPTER_ORDER, adapterCollectionTimeout, runSequentialAdapters } from "../../supabase/functions/_shared/job-scrape-plan.ts";

describe("runSequentialAdapters", () => {
  it("gives every adapter the same 90-second hard limit", () => {
    for (const key of JOB_ADAPTER_ORDER) expect(adapterCollectionTimeout(key)).toBe(ADAPTER_MAX_COLLECTION_MS);
    expect(ADAPTER_MAX_COLLECTION_MS).toBe(90_000);
  });

  it("runs sources in the exact required order without overlap", async () => {
    const events: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const adapters = JOB_ADAPTER_ORDER.map((key) => ({
      key,
      run: async (_signal: AbortSignal) => {
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

  it("force-aborts at the deadline, keeps partial output, and continues", async () => {
    let aborted = false;
    const attempted: string[] = [];
    const results = await runSequentialAdapters([
      {
        key: "linkedin",
        run: (signal) => new Promise<string[]>((_resolve, reject) => {
          attempted.push("linkedin");
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        }),
        getPartial: () => ["partial-job"],
      },
      {
        key: "indeed",
        run: async () => {
          attempted.push("indeed");
          return ["next-job"];
        },
      },
    ], { timeoutMs: 5 });

    expect(aborted).toBe(true);
    expect(attempted).toEqual(["linkedin", "indeed"]);
    expect(results[0]).toMatchObject({ key: "linkedin", status: "timed_out", value: ["partial-job"] });
    expect(results[1]).toMatchObject({ key: "indeed", status: "completed", value: ["next-job"] });
  });

  it("marks the active adapter stopped and never starts queued adapters", async () => {
    let stop = false;
    const attempted: string[] = [];
    const finished: string[] = [];
    const results = await runSequentialAdapters([
      {
        key: "linkedin",
        run: (signal) => new Promise<string[]>((_resolve, reject) => {
          attempted.push("linkedin");
          stop = true;
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        }),
        getPartial: () => ["kept-job"],
      },
      { key: "indeed", run: async () => { attempted.push("indeed"); return []; } },
    ], {
      shouldStop: () => stop,
      onFinish: (result) => { finished.push(result.status); },
    });

    expect(attempted).toEqual(["linkedin"]);
    expect(finished).toEqual(["stopped"]);
    expect(results[0]).toMatchObject({ status: "stopped", value: ["kept-job"] });
  });

  it("records one failure and continues with every later source", async () => {
    const attempted: string[] = [];
    const adapters = JOB_ADAPTER_ORDER.map((key) => ({
      key,
      run: async (_signal: AbortSignal) => {
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
