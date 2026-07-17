const ACTOR_WAIT_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 12_000;

async function apifyFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

export async function runApifyActor(actor: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) throw new Error("APIFY_API_TOKEN is missing");
  const actorId = actor.replace("/", "~");
  const start = await apifyFetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!start.ok) throw new Error(`Apify actor start failed (${start.status}): ${await start.text()}`);
  const run = (await start.json()).data;
  const deadline = Date.now() + ACTOR_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const poll = await apifyFetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${encodeURIComponent(token)}`);
    if (!poll.ok) throw new Error(`Apify actor status failed (${poll.status})`);
    const data = (await poll.json()).data;
    if (data.status === "SUCCEEDED") {
      const dataset = await apifyFetch(`https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items?token=${encodeURIComponent(token)}`);
      if (!dataset.ok) throw new Error(`Apify dataset fetch failed (${dataset.status})`);
      return await dataset.json();
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) throw new Error(`Apify actor ${data.status}: ${data.statusMessage || "No detail"}`);
  }
  throw new Error("Apify actor exceeded the 45 second collection limit");
}
