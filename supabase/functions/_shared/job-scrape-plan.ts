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

export async function runSequentialAdapters<T>(
  adapters: SequentialAdapter<T>[],
  callbacks: {
    onStart?: (key: JobAdapterKey, index: number) => Promise<void> | void;
    onFinish?: (result: SequentialAdapterResult<T>, index: number) => Promise<void> | void;
  } = {},
): Promise<SequentialAdapterResult<T>[]> {
  const results: SequentialAdapterResult<T>[] = [];
  for (let index = 0; index < adapters.length; index += 1) {
    const adapter = adapters[index];
    await callbacks.onStart?.(adapter.key, index);
    let result: SequentialAdapterResult<T>;
    try {
      result = { key: adapter.key, status: "completed", value: await adapter.run() };
    } catch (error) {
      result = { key: adapter.key, status: "failed", error: error instanceof Error ? error : new Error("Adapter failed") };
    }
    results.push(result);
    await callbacks.onFinish?.(result, index);
  }
  return results;
}
