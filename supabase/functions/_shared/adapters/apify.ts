const REQUEST_TIMEOUT_MS = 12_000;

async function apifyFetch(url: string, init: RequestInit = {}, signal?: AbortSignal) {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: requestSignal });
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export async function runApifyActor(
  actor: string,
  input: Record<string, unknown>,
  options: { signal?: AbortSignal; onItems?: (items: Record<string, unknown>[]) => void } = {},
): Promise<Record<string, unknown>[]> {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) throw new Error("APIFY_API_TOKEN is missing");
  const actorId = actor.replace("/", "~");
  const start = await apifyFetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, options.signal);
  if (!start.ok) throw new Error(`Apify actor start failed (${start.status}): ${await start.text()}`);
  const run = (await start.json()).data;
  options.signal?.addEventListener("abort", () => {
    void fetch(`https://api.apify.com/v2/actor-runs/${run.id}/abort?token=${encodeURIComponent(token)}`, { method: "POST" })
      .catch(() => undefined);
  }, { once: true });

  while (!options.signal?.aborted) {
    await abortableDelay(3_000, options.signal);
    const poll = await apifyFetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${encodeURIComponent(token)}`, {}, options.signal);
    if (!poll.ok) throw new Error(`Apify actor status failed (${poll.status})`);
    const data = (await poll.json()).data;
    const datasetId = data.defaultDatasetId || run.defaultDatasetId;
    if (datasetId) {
      const dataset = await apifyFetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}`, {}, options.signal);
      if (dataset.ok) {
        const items = await dataset.json();
        if (Array.isArray(items)) options.onItems?.(items);
        if (data.status === "SUCCEEDED") return Array.isArray(items) ? items : [];
      } else if (data.status === "SUCCEEDED") {
        throw new Error(`Apify dataset fetch failed (${dataset.status})`);
      }
    }
    if (data.status === "SUCCEEDED") {
      return [];
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) throw new Error(`Apify actor ${data.status}: ${data.statusMessage || "No detail"}`);
  }
  throw new DOMException("Aborted", "AbortError");
}
