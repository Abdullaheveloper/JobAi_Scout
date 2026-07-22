export const JOB_ADAPTER_ORDER = ["linkedin", "indeed", "rss", "company_career"] as const;
export type JobAdapterKey = typeof JOB_ADAPTER_ORDER[number];
export type JobAdapterState = "waiting" | "running" | "completed" | "failed";

export type SequentialAdapter<T> = {
  key: JobAdapterKey;
  run: () => Promise<T>;
};

export type SequentialAdapterResult<T> = {
  key: JobAdapterKey;
  status: "completed" | "failed";
  value?: T;
  error?: Error;
};

// Provider-backed searches are capped at 50 seconds. RSS feeds and official
// company career pages can legitimately need longer to respond, so they get a
// 100-second adapter window without slowing LinkedIn or Indeed.
export const ADAPTER_MIN_COLLECTION_MS = 40_000;
export const ADAPTER_MAX_COLLECTION_MS = 50_000;
export const EXTENDED_ADAPTER_MAX_COLLECTION_MS = 100_000;

export function adapterCollectionTimeout(key: JobAdapterKey): number {
  return key === "rss" || key === "company_career"
    ? EXTENDED_ADAPTER_MAX_COLLECTION_MS
    : ADAPTER_MAX_COLLECTION_MS;
}

async function runWithDeadline<T>(key: JobAdapterKey, run: () => Promise<T>, shouldStop?: () => Promise<boolean> | boolean): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let stopPollId: ReturnType<typeof setInterval> | undefined;
  const timeoutMs = adapterCollectionTimeout(key);
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Adapter exceeded the ${timeoutMs / 1_000}-second time limit`)), timeoutMs);
  });
  const stopped = shouldStop
    ? new Promise<never>((_, reject) => {
      stopPollId = setInterval(async () => {
        if (await shouldStop()) reject(new Error("Scraping stopped by the user"));
      }, 1_000);
    })
    : null;
  try {
    return await Promise.race(stopped ? [run(), timeout, stopped] : [run(), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (stopPollId) clearInterval(stopPollId);
  }
}

export async function runSequentialAdapters<T>(
  adapters: SequentialAdapter<T>[],
  callbacks: {
    shouldStop?: () => Promise<boolean> | boolean;
    onStart?: (key: JobAdapterKey, index: number) => Promise<void> | void;
    onFinish?: (result: SequentialAdapterResult<T>, index: number) => Promise<void> | void;
  } = {},
): Promise<SequentialAdapterResult<T>[]> {
  const results: SequentialAdapterResult<T>[] = [];
  for (let index = 0; index < adapters.length; index += 1) {
    const adapter = adapters[index];
    if (await callbacks.shouldStop?.()) break;
    await callbacks.onStart?.(adapter.key, index);
    let result: SequentialAdapterResult<T>;
    try {
      result = { key: adapter.key, status: "completed", value: await runWithDeadline(adapter.key, adapter.run, callbacks.shouldStop) };
    } catch (error) {
      result = { key: adapter.key, status: "failed", error: error instanceof Error ? error : new Error("Adapter failed") };
    }
    results.push(result);
    await callbacks.onFinish?.(result, index);
  }
  return results;
}
