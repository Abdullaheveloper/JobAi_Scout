export const JOB_ADAPTER_ORDER = ["linkedin", "indeed", "rss", "company_career"] as const;
export type JobAdapterKey = typeof JOB_ADAPTER_ORDER[number];
export type JobAdapterState = "waiting" | "running" | "completed" | "timed_out" | "failed" | "stopped";

export type SequentialAdapter<T> = {
  key: JobAdapterKey;
  run: (signal: AbortSignal) => Promise<T>;
  getPartial?: () => T | undefined;
};

export type SequentialAdapterResult<T> = {
  key: JobAdapterKey;
  status: "completed" | "timed_out" | "failed" | "stopped";
  value?: T;
  error?: Error;
};

export const ADAPTER_MAX_COLLECTION_MS = 90_000;

export function adapterCollectionTimeout(_key: JobAdapterKey): number {
  return ADAPTER_MAX_COLLECTION_MS;
}

async function runWithDeadline<T>(
  adapter: SequentialAdapter<T>,
  shouldStop?: () => Promise<boolean> | boolean,
  timeoutMs = adapterCollectionTimeout(adapter.key),
): Promise<SequentialAdapterResult<T>> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let stopPollId: ReturnType<typeof setInterval> | undefined;

  const task = adapter.run(controller.signal).then(
    (value): SequentialAdapterResult<T> => ({ key: adapter.key, status: "completed", value }),
    (error): SequentialAdapterResult<T> => ({
      key: adapter.key,
      status: "failed",
      error: error instanceof Error ? error : new Error("Adapter failed"),
    }),
  );
  const timeout = new Promise<SequentialAdapterResult<T>>((resolve) => {
    timeoutId = setTimeout(() => resolve({
      key: adapter.key,
      status: "timed_out",
      value: adapter.getPartial?.(),
      error: new Error(`Adapter exceeded the ${timeoutMs / 1_000}-second time limit`),
    }), timeoutMs);
  });
  const stopped = shouldStop
    ? new Promise<SequentialAdapterResult<T>>((resolve) => {
      stopPollId = setInterval(async () => {
        if (await shouldStop()) {
          resolve({
            key: adapter.key,
            status: "stopped",
            value: adapter.getPartial?.(),
            error: new Error("Scraping stopped by the user"),
          });
        }
      }, 500);
    })
    : null;

  try {
    const result = await Promise.race(stopped ? [task, timeout, stopped] : [task, timeout]);
    if (result.status === "timed_out" || result.status === "stopped") controller.abort(result.status);
    return result;
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
    timeoutMs?: number;
  } = {},
): Promise<SequentialAdapterResult<T>[]> {
  const results: SequentialAdapterResult<T>[] = [];
  for (let index = 0; index < adapters.length; index += 1) {
    const adapter = adapters[index];
    if (await callbacks.shouldStop?.()) break;
    await callbacks.onStart?.(adapter.key, index);
    const result = await runWithDeadline(adapter, callbacks.shouldStop, callbacks.timeoutMs);
    results.push(result);
    await callbacks.onFinish?.(result, index);
    if (result.status === "stopped") break;
  }
  return results;
}
